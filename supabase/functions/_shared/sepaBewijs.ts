// Bewijsvoering online SEPA-machtiging: vastleggen (onveranderbaar), PDF, bevestigingsmail.
// Gebruikt door process-bav-wizard (doorlopend) en process-screening-aanvraag (eenmalig).
import { COMPANY, COMPANY_ADDRESS_FULL } from "./company.ts";
import { createMailGate } from "./mail.ts";
import { bouwMachtigingPdf } from "./sepaPdf.ts";
import {
  MACHTIGING_TEKST_VERSIE,
  isValidIban,
  maskeerIban,
  normaliseerIban,
  renderMachtigingstekst,
  mandaatkenmerkVoor,
  type DebiteurAdres,
  type MachtigingData,
  type MachtigingType,
} from "./sepaMachtiging.ts";

export const KLANTMELDING_INCASSANT_ONTBREEKT =
  `Aanmelden is tijdelijk niet mogelijk, bel ${COMPANY.phoneDisplay}`;

export function incassantIdOntbreekt(): boolean {
  return !String(COMPANY.incassantId ?? "").trim();
}

export function klantIp(req: Request): string | null {
  const cf = req.headers.get("cf-connecting-ip");
  if (cf?.trim()) return cf.trim();
  const xff = req.headers.get("x-forwarded-for");
  const eerste = xff?.split(",")[0]?.trim();
  return eerste || null;
}

export async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Controleert het rekeninghouderadres; geeft de ontbrekende veldnamen terug. */
export function ontbrekendeAdresvelden(a: Partial<DebiteurAdres> | null | undefined): string[] {
  const velden: (keyof DebiteurAdres)[] = ["straat", "huisnummer", "postcode", "plaats", "land"];
  return velden.filter((k) => !String(a?.[k] ?? "").trim());
}

export function bouwMachtigingData(input: {
  type: MachtigingType;
  bronId: string;
  reden: string;
  debiteurNaam: string;
  debiteurAdres: DebiteurAdres;
  iban: string;
}): MachtigingData {
  return {
    type: input.type,
    incassantNaam: COMPANY.legalName,
    incassantAdres: COMPANY_ADDRESS_FULL,
    incassantId: COMPANY.incassantId,
    mandaatkenmerk: mandaatkenmerkVoor(input.bronId),
    reden: input.reden,
    debiteurNaam: input.debiteurNaam.trim(),
    debiteurAdres: {
      straat: input.debiteurAdres.straat.trim(),
      huisnummer: input.debiteurAdres.huisnummer.trim(),
      postcode: input.debiteurAdres.postcode.trim().toUpperCase(),
      plaats: input.debiteurAdres.plaats.trim(),
      land: input.debiteurAdres.land.trim(),
    },
    iban: normaliseerIban(input.iban),
  };
}

export interface BewijsRecord {
  id: string;
  mandaatkenmerk: string;
  akkoord_op: string;
  ip_adres: string | null;
  tekst_versie: string;
  tekst_hash: string;
  getoonde_tekst: string;
}

/** Schrijft het bewijsrecord. Gooit bij elke fout: dan faalt de aanvraag. */
// deno-lint-ignore no-explicit-any
export async function legBewijsVast(supabase: any, req: Request, opts: {
  dienst: "bav" | "screening";
  bronTabel: string;
  bronId: string;
  data: MachtigingData;
  clientAkkoordOp?: string | null;
  paginaUrl?: string | null;
}): Promise<BewijsRecord> {
  if (incassantIdOntbreekt()) throw new Error("incassant_id_ontbreekt");
  if (!isValidIban(opts.data.iban)) throw new Error("iban_ongeldig");
  const getoond = renderMachtigingstekst(opts.data);
  const hash = await sha256Hex(getoond);
  let clientTijd: string | null = null;
  if (opts.clientAkkoordOp) {
    const d = new Date(opts.clientAkkoordOp);
    if (!isNaN(d.getTime())) clientTijd = d.toISOString();
  }
  const { data, error } = await supabase.from("sepa_machtiging_bewijs").insert({
    dienst: opts.dienst,
    bron_tabel: opts.bronTabel,
    bron_id: opts.bronId,
    mandaatkenmerk: opts.data.mandaatkenmerk,
    type: opts.data.type,
    incassant_naam: opts.data.incassantNaam,
    incassant_id: opts.data.incassantId,
    reden: opts.data.reden,
    debiteur_naam: opts.data.debiteurNaam,
    debiteur_adres: opts.data.debiteurAdres,
    iban: opts.data.iban,
    tekst_versie: MACHTIGING_TEKST_VERSIE,
    getoonde_tekst: getoond,
    tekst_hash: hash,
    client_akkoord_op: clientTijd,
    ip_adres: klantIp(req),
    user_agent: (req.headers.get("user-agent") ?? "").slice(0, 500) || null,
    pagina_url: (opts.paginaUrl ?? "").slice(0, 1000) || null,
  }).select("id, mandaatkenmerk, akkoord_op, ip_adres, tekst_versie, tekst_hash, getoonde_tekst").single();
  if (error || !data) throw new Error(`Bewijsrecord SEPA-machtiging: ${error?.message ?? "onbekend"}`);
  return data as BewijsRecord;
}

/**
 * PDF opslaan in bucket sepa-machtigingen + bevestigingsmail met PDF als bijlage.
 * Faalt nooit hard: fouten worden gelogd in lead_notification_log.
 */
// deno-lint-ignore no-explicit-any
export async function verstuurMachtigingBevestiging(supabase: any, req: Request, opts: {
  fnName: string;
  leadType: string;
  record: BewijsRecord;
  data: MachtigingData;
  email: string;
  aanhef: string;
  bedragOfReden: string;
}): Promise<void> {
  const { record, data } = opts;
  const subject = "Bevestiging SEPA-machtiging ZP Zaken";
  const log = async (status: "sent" | "failed", extra: { resend_message_id?: string | null; error_message?: string | null }) => {
    try {
      await supabase.from("lead_notification_log").insert({
        lead_type: opts.leadType,
        lead_id: null,
        recipient: opts.email,
        subject,
        status,
        resend_message_id: extra.resend_message_id ?? null,
        error_message: extra.error_message ?? null,
        metadata: { soort: "sepa_machtiging", mandaatkenmerk: record.mandaatkenmerk, bewijs_id: record.id },
      });
    } catch (e) { console.error("log insert failed:", e); }
  };

  try {
    const pdfBytes = await bouwMachtigingPdf(data, {
      getoondeTekst: record.getoonde_tekst,
      akkoordOp: record.akkoord_op,
      ipAdres: record.ip_adres,
      tekstVersie: record.tekst_versie,
      tekstHash: record.tekst_hash,
    });

    const pad = `${record.mandaatkenmerk}.pdf`;
    const up = await supabase.storage.from("sepa-machtigingen")
      .upload(pad, new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" }), { contentType: "application/pdf", upsert: false });
    if (up.error) console.error("SEPA-PDF upload mislukt:", up.error.message);

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) { await log("failed", { error_message: "RESEND_API_KEY ontbreekt" }); return; }

    const typeTekst = data.type === "doorlopend" ? "doorlopende" : "eenmalige";
    const html = `
      <p>Beste ${opts.aanhef},</p>
      <p>Hierbij bevestigen wij de ${typeTekst} SEPA-machtiging die u op ${new Date(record.akkoord_op).toLocaleString("nl-NL", { timeZone: "Europe/Amsterdam" })} elektronisch heeft afgegeven aan ${data.incassantNaam}.</p>
      <table cellpadding="4" style="font-family:Arial,sans-serif;font-size:14px">
        <tr><td><strong>Kenmerk machtiging</strong></td><td>${record.mandaatkenmerk}</td></tr>
        <tr><td><strong>Type</strong></td><td>${data.type === "doorlopend" ? "Doorlopende machtiging" : "Eenmalige machtiging"}</td></tr>
        <tr><td><strong>Incassant-ID</strong></td><td>${data.incassantId}</td></tr>
        <tr><td><strong>IBAN</strong></td><td>${maskeerIban(data.iban)}</td></tr>
        <tr><td><strong>Bedrag / reden</strong></td><td>${opts.bedragOfReden}</td></tr>
      </table>
      <p>Bent u het niet eens met een afschrijving? Dan kunt u deze laten terugboeken. Neem hiervoor binnen 8 weken na afschrijving contact op met uw bank.</p>
      <p>De volledige machtiging vindt u als PDF in de bijlage.</p>
      <p>Met vriendelijke groet,<br/>${data.incassantNaam}<br/>${COMPANY.phoneDisplay} · ${COMPANY.email}</p>`;

    const gate = createMailGate(opts.fnName, req);
    const plan = gate.plan({ to: opts.email, subject, html });
    if (!plan.send) { await log("failed", { error_message: `niet verzonden: ${plan.reason}` }); return; }

    let b64 = "";
    for (let i = 0; i < pdfBytes.length; i += 0x8000) b64 += String.fromCharCode(...pdfBytes.subarray(i, i + 0x8000));
    b64 = btoa(b64);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: plan.from, to: plan.to, subject: plan.subject, html: plan.html,
        attachments: [{ filename: `SEPA-machtiging-${record.mandaatkenmerk}.pdf`, content: b64 }],
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { await log("failed", { error_message: `Resend ${res.status}: ${JSON.stringify(body)}` }); return; }
    await log("sent", { resend_message_id: body?.id ?? null });
    const upd = await supabase.from("sepa_machtiging_bewijs")
      .update({ bevestigingsmail_id: body?.id ?? "onbekend", bevestigingsmail_verzonden_op: new Date().toISOString() })
      .eq("id", record.id);
    if (upd.error) console.error("bewijs mail-kolommen bijwerken mislukt:", upd.error.message);
  } catch (e) {
    console.error("SEPA-bevestiging mislukt:", e);
    await log("failed", { error_message: e instanceof Error ? e.message : String(e) });
  }
}

// Verzendcheck voor nieuwe klantmails: leest klantmail_instellingen altijd vers uit de database.
// Elke nieuwe klantmail gaat alleen via magKlantmailVersturen plus createMailGate.
// deno-lint-ignore-file no-explicit-any
import { schakelaarStaatAan, vulPlaceholders, type KlantmailData } from "./klantmailTekst.ts";
import { createMailGate } from "./mail.ts";

export async function magKlantmailVersturen(db: any, sleutel: string): Promise<{ mag: boolean; rij: any }> {
  const { data, error } = await db.from("klantmail_instellingen").select("sleutel,actief,status,onderwerp,tekst").eq("sleutel", sleutel).maybeSingle();
  if (error || !data) return { mag: false, rij: null };
  return { mag: schakelaarStaatAan(data), rij: data };
}

export async function logKlantmail(db: any, rij: Record<string, unknown>) {
  try { await db.from("klantmail_log").insert(rij); } catch (_e) { /* log mag de run niet stoppen */ }
}

/** Zelfde logica als mailCertificaat: e-mail van de lead, anders van een persoon van de onderneming. */
export async function klantOntvanger(db: any, ondernemingId: string | null, leadId: string | null): Promise<{ email: string | null; voornaam: string | null }> {
  if (leadId) {
    const { data: l } = await db.from("leads").select("email,voornaam").eq("id", leadId).maybeSingle();
    if (l?.email?.trim()) return { email: l.email.trim(), voornaam: l.voornaam ?? null };
  }
  if (ondernemingId) {
    const { data: po } = await db.from("persoon_onderneming").select("personen(voornaam,email_weergave)").eq("onderneming_id", ondernemingId);
    const p = (po || []).map((x: any) => x.personen).find((x: any) => x?.email_weergave);
    if (p) return { email: String(p.email_weergave).trim(), voornaam: p.voornaam ?? null };
  }
  return { email: null, voornaam: null };
}

/** Polisnummer: eerst een geldige policy van de onderneming, anders het nieuwste certificaatnummer uit klant_certificaten. */
export async function polisnummerVoor(db: any, ondernemingId: string | null): Promise<string | null> {
  if (!ondernemingId) return null;
  const { data: pol } = await db.from("policies").select("certificate_number").eq("onderneming_id", ondernemingId).eq("status", "geldig")
    .not("certificate_number", "is", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (pol?.certificate_number) return String(pol.certificate_number);
  const { data: kc } = await db.from("klant_certificaten").select("certificaatnummer").eq("onderneming_id", ondernemingId)
    .not("certificaatnummer", "is", null).order("aanvraagdatum", { ascending: false, nullsFirst: false }).limit(1).maybeSingle();
  return kc?.certificaatnummer ? String(kc.certificaatnummer) : null;
}

/**
 * Verstuurt een nieuwe klantmail alleen als de schakelaar aan staat (vers gelezen) en createMailGate het toelaat.
 * Bij uit: geen mail, wel een logregel 'niet_verzonden_schakelaar_uit'. Geeft de mailstatus terug.
 */
export async function verstuurKlantmail(db: any, req: Request | null, fnName: string, sleutel: string,
  ontvanger: string | null, data: KlantmailData, meta: Record<string, unknown>, options: { dryRun?: boolean; idempotencyKey?: string; attachments?: { filename: string; content: string }[]; classifyDelivery?: boolean } = {}): Promise<string> {
  const log = (rij: Record<string, unknown>) => options.dryRun ? Promise.resolve() : logKlantmail(db, rij);
  const { mag, rij } = await magKlantmailVersturen(db, sleutel);
  if (!mag) { await log({ sleutel, status: "niet_verzonden_schakelaar_uit", ontvanger, ...meta }); return "niet_verzonden_schakelaar_uit"; }
  if (!ontvanger) { await log({ sleutel, status: "niet_verzonden_geen_ontvanger", ...meta }); return "niet_verzonden_geen_ontvanger"; }
  let onderwerp: string, tekst: string;
  try { onderwerp = vulPlaceholders(rij.onderwerp ?? "", data); tekst = vulPlaceholders(rij.tekst ?? "", data); }
  catch (e) { await log({ sleutel, status: "niet_verzonden_tekstfout", ontvanger, ...meta, details: { fout: String(e) } }); return "niet_verzonden_tekstfout"; }
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html = tekst.split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, "<br/>")}</p>`).join("");
  const plan = createMailGate(fnName, req).plan({ to: ontvanger, subject: onderwerp, html });
  if (!plan.send) { await log({ sleutel, status: `niet_verzonden_${plan.reason ?? "gate"}`, ontvanger, ...meta }); return "niet_verzonden_gate"; }
  const key = (globalThis as any).Deno?.env?.get("RESEND_API_KEY");
  if (!key) { await log({ sleutel, status: "mislukt", ontvanger, ...meta, details: { fout: "geen mailsleutel" } }); return "mislukt"; }
  if (options.dryRun) return "zou_verzenden";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, ...(options.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : {}) },
    body: JSON.stringify({ from: plan.from, to: plan.to, bcc: plan.bcc, subject: plan.subject, html: plan.html, ...(options.attachments ? { attachments: options.attachments } : {}) }),
  });
  await res.text().catch(() => "");
  // Provider 5xx/timeouts may have accepted the mail: never enable a resend for an uncertain delivery.
  const status = res.ok ? "verzonden" : options.classifyDelivery ? (res.status >= 500 || res.status === 408 ? "mail_onzeker" : "mail_mislukt") : "mislukt";
  await logKlantmail(db, { sleutel, status, ontvanger, ...meta, details: { http: res.status, naar: plan.to } });
  return status;
}

// Beheer: document naar klant versturen vanaf de klantkaart (teamlid met 2FA).
// Exact alleen lezen (GET SalesInvoices + documenten). Nooit automatisch mailen:
// alleen actie "versturen" met bevestigd=true na een voorbeeld verstuurt.
// Elke verzending: CRM-notitie (crm_notitie_toevoegen, ook audit) + activiteiten_log.
// Factuur van voor 13-10-2026 (AFAS): crm_taak 'afas_factuur_opvragen' + interne mail soort 'afas_factuur' (Sandra).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import { ensureValidToken } from "../_shared/exactToken.ts";
import { haalFactuurPdf } from "../_shared/exactFactuurPdf.ts";
import { createMailGate } from "../_shared/mail.ts";
import { verstuurInterneMelding } from "../_shared/interneMelding.ts";
import { PORTAL_FACTUREN_VANAF } from "../_shared/klantAccounts.ts";

const json = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const esc = (v: unknown) => String(v ?? "").replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[c] ?? c);
const SITE = "https://www.zpzaken.nl";

const Body = z.object({
  actie: z.enum(["facturen", "voorbeeld", "versturen", "afas_melding"]),
  onderneming_id: z.string().uuid(),
  soort: z.enum(["factuur", "verzekeringskaart"]).optional(),
  invoice_id: z.string().regex(/^[0-9a-f-]{36}$/i).optional(),
  kaart_pad: z.string().regex(/^\/documenten\/[A-Za-z0-9._-]+\.pdf$/).optional(),
  kaart_titel: z.string().max(200).optional(),
  ontvanger: z.string().email().max(255).optional(),
  periode: z.string().trim().min(3).max(100).optional(),
  bevestigd: z.boolean().optional(),
});

function aal(token: string): string | null {
  try { const p = token.split(".")[1].replaceAll("-", "+").replaceAll("_", "/"); return JSON.parse(atob(p.padEnd(Math.ceil(p.length / 4) * 4, "="))).aal ?? null; } catch { return null; }
}
const exactDatum = (v: unknown) => { const ms = Number(String(v ?? "").match(/-?\d+/)?.[0] ?? 0); return ms ? new Date(ms).toISOString().slice(0, 10) : null; };
const nlDatum = (d: string | null) => d ? d.split("-").reverse().join("-") : "-";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
  const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);
  if (aal(auth.slice(7).trim()) !== "aal2") return json({ error: "mfa_required" }, 403);
  const { data: team } = await admin.rpc("is_team_member", { _user_id: user.id });
  if (team !== true) return json({ error: "forbidden" }, 403);

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return json({ error: "validation", details: parsed.error.flatten().fieldErrors }, 400);
  const b = parsed.data;

  const { data: ond } = await admin.from("ondernemingen").select("id,naam,exact_relatie_code,exact_account_id,factuur_email,is_test").eq("id", b.onderneming_id).maybeSingle();
  if (!ond) return json({ error: "onderneming_niet_gevonden" }, 404);
  const { data: po } = await admin.from("persoon_onderneming").select("persoon_id").eq("onderneming_id", ond.id);
  const pIds = (po ?? []).map((x: { persoon_id: string }) => x.persoon_id);
  const { data: pers } = pIds.length ? await admin.from("personen").select("id,email_weergave").in("id", pIds) : { data: [] };
  const adressen = [...new Set([ond.factuur_email, ...(pers ?? []).map((p: { email_weergave: string | null }) => p.email_weergave)].filter(Boolean).map((e) => String(e).trim().toLowerCase()))];
  const { data: contr } = await admin.from("klant_contracten").select("abonnement_nr").eq("onderneming_id", ond.id);
  const abonnementen = [...new Set((contr ?? []).map((c: { abonnement_nr: string | null }) => c.abonnement_nr).filter(Boolean))].join(", ");

  // Exact: alleen lezen.
  async function exact() {
    const { data: cfg } = await admin.from("exact_config").select("*").maybeSingle();
    if (!cfg?.is_actief || !cfg?.divisie_code) throw new Error("exact_niet_beschikbaar");
    const token = await ensureValidToken(admin, cfg);
    return { base: cfg.base_url || "https://start.exactonline.nl", div: cfg.divisie_code, token };
  }

  if (b.actie === "facturen") {
    if (!ond.exact_account_id) return json({ facturen: [], adressen, reden: "geen_exact_account", relatiecode: ond.exact_relatie_code });
    const e = await exact();
    const filter = `InvoiceTo eq guid'${ond.exact_account_id}' and Status eq 50`;
    const r = await fetch(`${e.base}/api/v1/${e.div}/salesinvoice/SalesInvoices?$filter=${encodeURIComponent(filter)}&$select=InvoiceID,InvoiceNumber,InvoiceDate,AmountFC,Description,Type&$orderby=InvoiceDate desc`, { headers: { Authorization: `Bearer ${e.token}`, Accept: "application/json" } });
    if (!r.ok) return json({ error: "exact_api_error", http: r.status }, 502);
    const j = await r.json();
    // deno-lint-ignore no-explicit-any
    const rows: any[] = j?.d?.results ?? j?.d ?? [];
    const ids = rows.map((x) => x.InvoiceID);
    const { data: plan } = ids.length ? await admin.from("factuur_planning").select("exact_invoice_id,periode_start,periode_eind").in("exact_invoice_id", ids) : { data: [] };
    const per = new Map((plan ?? []).map((p: { exact_invoice_id: string; periode_start: string; periode_eind: string }) => [p.exact_invoice_id, p]));
    return json({
      relatiecode: ond.exact_relatie_code, adressen, afas_grens: PORTAL_FACTUREN_VANAF,
      facturen: rows.map((x) => ({ id: x.InvoiceID, nummer: String(x.InvoiceNumber ?? ""), datum: exactDatum(x.InvoiceDate), bedrag: Number(x.AmountFC ?? 0), omschrijving: x.Description ?? "", soort: Number(x.Type) === 8021 ? "creditnota" : "factuur", periode_start: per.get(x.InvoiceID)?.periode_start ?? null, periode_eind: per.get(x.InvoiceID)?.periode_eind ?? null })),
    });
  }

  const { data: prof } = await admin.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
  const naamTeam = prof?.full_name || user.email || "ZP Zaken";

  if (b.actie === "afas_melding") {
    if (!b.periode) return json({ error: "periode_verplicht" }, 400);
    const omschrijving = `Factuur uit AFAS opvragen: ${ond.naam ?? "-"}, relatiecode ${ond.exact_relatie_code ?? "-"}, abonnement ${abonnementen || "-"}, periode ${b.periode}`;
    const { data: taak, error } = await admin.from("crm_taken").insert({ onderneming_id: ond.id, soort: "afas_factuur_opvragen", team: "facturatie", status: "open", omschrijving, aangemaakt_door: user.id, aangemaakt_door_naam: naamTeam, is_test: ond.is_test ?? false, details: { relatiecode: ond.exact_relatie_code, abonnement_nr: abonnementen, periode: b.periode, toegewezen_aan: "sandra@onefellow.nl" } }).select("id").single();
    if (error) return json({ error: "taak_mislukt", detail: error.message }, 500);
    const html = `<p>${esc(naamTeam)} vraagt een factuur uit het oude systeem (AFAS) op.</p><ul><li><strong>Klant:</strong> ${esc(ond.naam)}</li><li><strong>Relatiecode:</strong> ${esc(ond.exact_relatie_code)}</li><li><strong>Abonnementnummer:</strong> ${esc(abonnementen || "-")}</li><li><strong>Gevraagde periode:</strong> ${esc(b.periode)}</li></ul><p>Stuur de pdf naar ${esc(naamTeam)}, dan verstuurt zij hem naar de klant.</p>`;
    await verstuurInterneMelding(admin, req, "klant-document-versturen", { leadType: "afas-factuur-opvragen", subject: `AFAS-factuur opvragen: ${ond.naam ?? ""} (${ond.exact_relatie_code ?? "-"})`, html, soort: "afas_factuur", metadata: { onderneming_id: ond.id, taak_id: taak.id } });
    await userClient.rpc("crm_notitie_toevoegen", { _onderneming_id: ond.id, _persoon_id: null, _soort: "overig", _tekst: `Factuur uit AFAS opgevraagd bij Sandra (periode ${b.periode}).`, _details: { taak_id: taak.id, bron: "klant-document-versturen" } });
    return json({ ok: true, taak_id: taak.id });
  }

  // voorbeeld / versturen
  if (!b.soort) return json({ error: "soort_verplicht" }, 400);
  const ontvanger = (b.ontvanger ?? adressen[0] ?? "").toLowerCase();
  if (!ontvanger || !adressen.includes(ontvanger)) return json({ error: "onbekend_adres", melding: "Kies een e-mailadres dat bij deze klant bekend is.", adressen }, 400);

  let bijlage: { bytes: Uint8Array; naam: string } | null = null;
  let omschrijving = "";
  if (b.soort === "factuur") {
    if (!b.invoice_id || !ond.exact_account_id) return json({ error: "factuur_verplicht" }, 400);
    const e = await exact();
    const r = await fetch(`${e.base}/api/v1/${e.div}/salesinvoice/SalesInvoices(guid'${b.invoice_id}')?$select=InvoiceID,InvoiceTo,InvoiceNumber,Status,InvoiceDate`, { headers: { Authorization: `Bearer ${e.token}`, Accept: "application/json" } });
    const inv = r.ok ? (await r.json())?.d : null;
    if (!inv || String(inv.InvoiceTo).toLowerCase() !== String(ond.exact_account_id).toLowerCase() || Number(inv.Status) !== 50) return json({ error: "factuur_hoort_niet_bij_klant" }, 403);
    const pdf = await haalFactuurPdf(e.base, e.div, e.token, inv.InvoiceNumber);
    if (!pdf.ok) return json({ error: "pdf_niet_gevonden", reden: pdf.reden }, 502);
    bijlage = { bytes: pdf.bytes, naam: `factuur-${inv.InvoiceNumber}.pdf` };
    omschrijving = `factuur ${inv.InvoiceNumber} van ${nlDatum(exactDatum(inv.InvoiceDate))}`;
  } else {
    if (!b.kaart_pad) return json({ error: "kaart_verplicht" }, 400);
    const r = await fetch(`${SITE}${b.kaart_pad}`);
    const bytes = r.ok ? new Uint8Array(await r.arrayBuffer()) : new Uint8Array();
    if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") return json({ error: "kaart_niet_gevonden" }, 502);
    bijlage = { bytes, naam: b.kaart_pad.split("/").pop()! };
    omschrijving = b.kaart_titel ? `verzekeringskaart (${b.kaart_titel})` : "verzekeringskaart";
  }
  const subject = b.soort === "factuur" ? `Je ${omschrijving.split(" van ")[0]} van ZP Zaken` : "Je verzekeringskaart van ZP Zaken";
  const html = `<p>Beste klant,</p><p>Zoals gevraagd sturen we je in de bijlage je ${esc(omschrijving)} voor ${esc(ond.naam)}.</p><p>Heb je vragen? Beantwoord deze mail of bel 020 - 457 3077.</p><p>Met vriendelijke groet,<br>${esc(naamTeam)}<br>ZP Zaken</p>`;

  if (b.actie === "voorbeeld" || b.bevestigd !== true) {
    return json({ voorbeeld: true, aan: ontvanger, adressen, onderwerp: subject, html, bijlage: { naam: bijlage.naam, kb: Math.round(bijlage.bytes.length / 1024) } });
  }

  const gate = createMailGate("klant-document-versturen", req);
  const plan = gate.plan({ to: ontvanger, subject, html });
  const key = Deno.env.get("RESEND_API_KEY") ?? "";
  if (!plan.send || !key) return json({ error: "mail_niet_beschikbaar" }, 503);
  let b64 = ""; for (let i = 0; i < bijlage.bytes.length; i += 0x8000) b64 += String.fromCharCode(...bijlage.bytes.subarray(i, i + 0x8000));
  const res = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: plan.from, to: plan.to, subject: plan.subject, html: plan.html, reply_to: "info@zpzaken.nl", attachments: [{ filename: bijlage.naam, content: btoa(b64) }] }) });
  const rb = await res.json().catch(() => ({}));
  await admin.from("lead_notification_log").insert({ lead_type: "klant-document", recipient: plan.to.join(","), subject: plan.subject, status: res.ok ? "sent" : "failed", resend_message_id: rb?.id ?? null, error_message: res.ok ? null : `Resend ${res.status}`, metadata: { onderneming_id: ond.id, soort: b.soort, bijlage: bijlage.naam, redirected: plan.redirected } });
  if (!res.ok) return json({ error: "verzenden_mislukt" }, 502);
  const tekst = `${b.soort === "factuur" ? "Factuur" : "Verzekeringskaart"} verstuurd naar ${ontvanger}: ${omschrijving}${plan.redirected ? " (testomgeving, omgeleid)" : ""}.`;
  await userClient.rpc("crm_notitie_toevoegen", { _onderneming_id: ond.id, _persoon_id: null, _soort: "overig", _tekst: tekst, _details: { bron: "klant-document-versturen", soort: b.soort, invoice_id: b.invoice_id ?? null, bijlage: bijlage.naam, ontvanger } });
  await admin.from("activiteiten_log").insert({ actie_type: "document_verstuurd", omschrijving: `${ond.naam}: ${tekst}`, uitgevoerd_door: user.id, uitgevoerd_door_naam: naamTeam, klant_email: ontvanger });
  return json({ ok: true, redirected: plan.redirected });
});

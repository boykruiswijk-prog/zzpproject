// Dagelijkse controle (werkdagen 07:15 NL) op Exact-concepten zonder factuurnummer. STRIKT ALLEEN GET naar Exact.
// - 404 / niet gevonden → markeer exact_invoice_verwijderd_op (leads) of exact_verwijderd_op (factuur_planning); ID blijft bewaard.
// - Bestaat nog maar langer dan 2 werkdagen open → herinnering.
// - Mislukte Exact-boekingen van gisteren uit lead_notification_log.
// Eén interne ochtendmail (soort exact_boeking) alleen bij afwijkingen. Testrecords overslaan. Nooit klantmail.
// Toegang: x-cron-secret (Vault, verify_cron_secret) of supervisor/admin met MFA.
// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";
import { ensureValidToken, refreshAccessToken } from "../_shared/exactToken.ts";
import { requireSupervisor } from "../_shared/teamAuth.ts";
import { verstuurInterneMelding } from "../_shared/interneMelding.ts";
import { ADMINISTRATIE, EXACT_BOEKING_SOORT, euro, mailEnkel, type Regel } from "../_shared/exactBoekingMelding.ts";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret" };
const json = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const SITE = "https://zpzaken.nl";
const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const nlDatum = (d: Date) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Amsterdam" }).format(d);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Aantal werkdagen (ma-vr) na startdatum tot en met vandaag. */
export function werkdagenSinds(startIso: string, vandaag: string): number {
  const d = new Date(`${nlDatum(new Date(startIso))}T12:00:00Z`); const eind = new Date(`${vandaag}T12:00:00Z`);
  let n = 0;
  while (d < eind) { d.setUTCDate(d.getUTCDate() + 1); const w = d.getUTCDay(); if (w !== 0 && w !== 6) n++; }
  return n;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const body = await req.json().catch(() => ({}));
  const cron = req.headers.get("x-cron-secret");
  if (cron) {
    const { data: ok } = await admin.rpc("verify_cron_secret", { p_secret: cron });
    if (ok !== true) return json({ error: "geen_toegang" }, 401);
  } else {
    const auth = await requireSupervisor(req, admin);
    if (auth instanceof Response) return json({ error: "geen_toegang" }, auth.status);
  }
  const actie = String(body?.actie ?? "controle");

  // Eenmalige testmail op basis van de Logineering-factuur. Schrijft niets naar Exact.
  if (actie === "testmail") {
    const { data: l } = await admin.from("leads").select("id,voornaam,achternaam,bedrijfsnaam,exact_account_id,exact_invoice_id,exact_invoice_amount,exact_invoice_created_at,ingangsdatum")
      .eq("exact_invoice_id", "013c8fe3-c568-41a6-8a3e-f3b9729c27b3").maybeSingle();
    if (!l) return json({ error: "Logineering-factuur niet gevonden" }, 404);
    const { data: o } = await admin.from("ondernemingen").select("id,naam,exact_relatie_code").eq("exact_account_id", l.exact_account_id).limit(1).maybeSingle();
    const r: Regel = {
      soort: "Verkoopfactuur (concept) aangemaakt", ok: true, tijd: l.exact_invoice_created_at ?? new Date().toISOString(),
      klantnaam: `${l.voornaam ?? ""} ${l.achternaam ?? ""}`.trim(), bedrijfsnaam: o?.naam ?? l.bedrijfsnaam ?? "onbekend",
      relatiecode: String(o?.exact_relatie_code ?? "onbekend"), documentId: l.exact_invoice_id,
      inclBtw: Number(l.exact_invoice_amount), exclBtw: Number(l.exact_invoice_amount),
      periode: "activatiefactuur (eerste periode)", omschrijving: "VOORBEELD op basis van de bestaande Logineering-factuur",
      klantkaart: o ? `${SITE}/admin/klanten/${o.id}` : `${SITE}/admin/leads/${l.id}`, isConcept: true,
    };
    const m = mailEnkel(r, "Teamlid (voorbeeld)", true);
    const res = await verstuurInterneMelding(admin, req, "exact-concept-controle:testmail", {
      leadType: "exact-boeking-test", leadId: l.id, subject: "TEST melding Exact-boeking", html: m.html,
      soort: EXACT_BOEKING_SOORT, metadata: { is_test: true, no_customer_mail: true, voorbeeld_van: l.exact_invoice_id },
    });
    const { data: log } = await admin.from("lead_notification_log").select("id,recipient,status,created_at").eq("lead_type", "exact-boeking-test").order("created_at", { ascending: false }).limit(5);
    return json({ resultaten: res, log });
  }

  if (cron) {
    // Cron draait 05:15 en 06:15 UTC op werkdagen; alleen de run om 07:xx NL telt.
    const uurNL = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Amsterdam", hour: "2-digit", hour12: false }).format(new Date()));
    if (uurNL !== 7) return json({ overgeslagen: true, uur_nl: uurNL });
  }

  const { data: cfg } = await admin.from("exact_config").select("*").limit(1).maybeSingle();
  if (!cfg?.is_actief || !cfg.divisie_code) return json({ error: "exact_niet_actief" }, 400);
  const baseUrl = cfg.base_url || "https://start.exactonline.nl";
  const div = String(cfg.divisie_code).trim();
  let token = await ensureValidToken(admin, cfg);
  async function bestaat(id: string): Promise<{ status: "bestaat" | "verwijderd" | "fout"; nummer?: string | null; fout?: string }> {
    const url = `${baseUrl}/api/v1/${div}/salesinvoice/SalesInvoices(guid'${id}')?$select=InvoiceID,InvoiceNumber,Status`;
    for (let p = 0; p < 3; p++) {
      const r = await fetch(url, { method: "GET", headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
      if (r.status === 401 && p === 0) { token = await refreshAccessToken(admin, cfg); continue; }
      if (r.status === 429) { await sleep(20_000); continue; }
      await sleep(600);
      if (r.status === 404) return { status: "verwijderd" };
      if (!r.ok) return { status: "fout", fout: `HTTP ${r.status}` };
      const d = (await r.json().catch(() => null))?.d;
      const inv = d?.results ? d.results[0] : d?.InvoiceID ? d : null;
      return inv ? { status: "bestaat", nummer: inv.InvoiceNumber ? String(inv.InvoiceNumber) : null } : { status: "verwijderd" };
    }
    return { status: "fout", fout: "Exact bleef bezet (429)" };
  }

  const vandaag = nlDatum(new Date());
  const nu = new Date().toISOString();
  const nieuwVerwijderd: any[] = []; const langOpen: any[] = []; const fouten: any[] = [];

  const { data: leads } = await admin.from("leads")
    .select("id,voornaam,achternaam,bedrijfsnaam,exact_invoice_id,exact_invoice_amount,exact_invoice_created_at,created_at,exact_invoice_verwijderd_op,exact_invoice_status")
    .not("exact_invoice_id", "is", null).is("exact_invoice_number", null).eq("is_test", false).limit(300);
  for (const l of (leads ?? []).filter((x: any) => Number(x.exact_invoice_status ?? 0) !== 50 && !x.exact_invoice_verwijderd_op)) {
    const c = await bestaat(l.exact_invoice_id);
    const rij = { naam: `${l.voornaam ?? ""} ${l.achternaam ?? ""}`.trim(), bedrijf: l.bedrijfsnaam, id: l.exact_invoice_id, bedrag: Number(l.exact_invoice_amount), sinds: l.exact_invoice_created_at ?? l.created_at, link: `${SITE}/admin/leads/${l.id}` };
    if (c.status === "verwijderd") {
      await admin.from("leads").update({ exact_invoice_verwijderd_op: nu, exact_invoice_gecontroleerd_op: nu }).eq("id", l.id).is("exact_invoice_verwijderd_op", null);
      nieuwVerwijderd.push(rij);
    } else if (c.status === "bestaat") {
      await admin.from("leads").update({ exact_invoice_gecontroleerd_op: nu }).eq("id", l.id);
      if (!c.nummer && werkdagenSinds(rij.sinds, vandaag) > 2) langOpen.push({ ...rij, werkdagen: werkdagenSinds(rij.sinds, vandaag) });
    } else fouten.push({ ...rij, fout: c.fout });
  }

  const { data: plannen } = await admin.from("factuur_planning")
    .select("id,klant_contract_id,periode_start,periode_eind,bedrag,exact_invoice_id,concept_op,aangemaakt_op,exact_verwijderd_op")
    .eq("status", "concept_aangemaakt").not("exact_invoice_id", "is", null).is("exact_invoice_number", null).is("exact_verwijderd_op", null).eq("is_test", false).limit(500);
  for (const p of plannen ?? []) {
    const { data: kc } = await admin.from("klant_contracten").select("onderneming_id, ondernemingen(naam)").eq("id", p.klant_contract_id).maybeSingle();
    const rij = { naam: (kc as any)?.ondernemingen?.naam ?? "onbekend", bedrijf: `periode ${p.periode_start} t/m ${p.periode_eind}`, id: p.exact_invoice_id, bedrag: Number(p.bedrag), sinds: p.concept_op ?? p.aangemaakt_op, link: kc?.onderneming_id ? `${SITE}/admin/klanten/${kc.onderneming_id}` : `${SITE}/admin/facturatieplanning` };
    const c = await bestaat(p.exact_invoice_id);
    if (c.status === "verwijderd") {
      await admin.from("factuur_planning").update({ exact_verwijderd_op: nu }).eq("id", p.id).is("exact_verwijderd_op", null);
      nieuwVerwijderd.push(rij);
    } else if (c.status === "bestaat") {
      if (!c.nummer && werkdagenSinds(rij.sinds, vandaag) > 2) langOpen.push({ ...rij, werkdagen: werkdagenSinds(rij.sinds, vandaag) });
    } else fouten.push({ ...rij, fout: c.fout });
  }

  // Mislukte Exact-boekingen van gisteren (NL-datum).
  const gisteren = nlDatum(new Date(Date.now() - 86400000));
  const { data: logs } = await admin.from("lead_notification_log").select("created_at,subject,metadata")
    .eq("lead_type", "exact-boeking").gte("created_at", new Date(Date.now() - 2 * 86400000).toISOString()).limit(1000);
  const gezien = new Set<string>(); const mislukt: any[] = [];
  for (const g of logs ?? []) {
    if (nlDatum(new Date(g.created_at)) !== gisteren) continue;
    for (const a of (g.metadata?.acties ?? []) as any[]) {
      if (a.ok) continue;
      const k = `${g.subject}|${a.soort}|${a.id}|${String(g.created_at).slice(0, 16)}`;
      if (gezien.has(k)) continue; gezien.add(k); mislukt.push({ soort: a.soort, id: a.id, onderwerp: g.subject, tijd: g.created_at });
    }
  }
  const { count: nogOpenVerwijderd } = await admin.from("leads").select("id", { count: "exact", head: true })
    .not("exact_invoice_verwijderd_op", "is", null).is("exact_invoice_number", null).eq("is_test", false);

  const rapport = { vandaag, nieuw_verwijderd: nieuwVerwijderd, langer_dan_2_werkdagen_open: langOpen, mislukt_gisteren: mislukt, controle_fouten: fouten };
  if (!nieuwVerwijderd.length && !langOpen.length && !mislukt.length && !fouten.length) return json({ ...rapport, mail: "geen afwijkingen, geen mail" });

  const tabel = (titel: string, rijen: any[], kolommen: [string, (r: any) => string][]) => !rijen.length ? "" :
    `<h3 style="margin:16px 0 4px">${titel} (${rijen.length})</h3><table style="border-collapse:collapse;font-size:13px"><tr>${kolommen.map(([h]) => `<th style="text-align:left;padding:4px 8px;border-bottom:2px solid #ccc">${h}</th>`).join("")}</tr>${rijen.map((r) => `<tr>${kolommen.map(([, f]) => `<td style="padding:4px 8px;border-bottom:1px solid #eee">${f(r)}</td>`).join("")}</tr>`).join("")}</table>`;
  const basis: [string, (r: any) => string][] = [["Klant", (r) => esc(r.naam)], ["Bedrijf / periode", (r) => esc(r.bedrijf ?? "")], ["Exact-ID", (r) => esc(r.id)], ["Bedrag", (r) => esc(euro(r.bedrag))], ["Klaargezet", (r) => esc(nlDatum(new Date(r.sinds)))], ["", (r) => `<a href="${esc(r.link)}">klantkaart</a>`]];
  const html = `<p>Ochtendcontrole Exact-concepten, administratie ${ADMINISTRATIE}. Alleen afwijkingen staan hieronder.</p>
${tabel("Concept is in Exact verwijderd", nieuwVerwijderd, basis)}
${nieuwVerwijderd.length ? `<p>Deze concepten bestaan niet meer in Exact. In het beheer staan ze nu in Vandaag te doen als "Concept is in Exact verwijderd, opnieuw klaarzetten of bewust laten vervallen". Het oude ID is bewaard.</p>` : ""}
${tabel("Langer dan 2 werkdagen open", langOpen, [...basis.slice(0, 5), ["Werkdagen", (r) => String(r.werkdagen)], basis[5]])}
${langOpen.length ? `<p><strong>Wat te doen:</strong> Controleer en verwerk dit in Exact via Verkoop &gt; Facturen &gt; Verwerken.</p>` : ""}
${tabel("Mislukte Exact-boekingen van gisteren", mislukt, [["Soort", (r) => esc(r.soort)], ["ID", (r) => esc(r.id ?? "-")], ["Melding", (r) => esc(r.onderwerp)]])}
${tabel("Kon niet worden gecontroleerd", fouten, [...basis.slice(0, 3), ["Reden", (r) => esc(r.fout)]])}
${nogOpenVerwijderd ? `<p style="color:#555">In totaal staan ${nogOpenVerwijderd} verwijderde concepten nog open in Vandaag te doen.</p>` : ""}
<p style="color:#777;font-size:12px">Interne controlemelding van het ZP Zaken-platform. De controle leest alleen in Exact en wijzigt daar niets.</p>`;
  const subject = `Exact-controle ${vandaag}: ${[nieuwVerwijderd.length && `${nieuwVerwijderd.length} verwijderd`, langOpen.length && `${langOpen.length} lang open`, mislukt.length && `${mislukt.length} mislukt`, fouten.length && `${fouten.length} niet gecontroleerd`].filter(Boolean).join(", ")}`;
  const res = await verstuurInterneMelding(admin, req, "exact-concept-controle", {
    leadType: "exact-controle", subject, html, soort: EXACT_BOEKING_SOORT,
    metadata: { nieuw_verwijderd: nieuwVerwijderd.map((r) => r.id), lang_open: langOpen.map((r) => r.id), mislukt: mislukt.length },
  });
  return json({ ...rapport, mail: res });
});

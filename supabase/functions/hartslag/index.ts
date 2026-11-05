// A31 Puls / Hartslag (elk kwartier via cron) en A30 Lasso / Opvolger-ronde in dezelfde run.
// Maakt nooit een lead, klantmail of CRM-notitie aan; de formulierroute wordt alleen gepingd.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { cronOfSupervisor } from "../_shared/cronOfSupervisor.ts";
import { HARTSLAG_PAGINAS, beoordeelPagina, beoordeelMail, beoordeelExact, type Meting } from "../_shared/hartslag.ts";
import { bouwOpvolgMail, OPVOLGER_SOORT, type OpvolgItem } from "../_shared/opvolger.ts";
import { verstuurInterneMelding } from "../_shared/interneMelding.ts";

const SITE = "https://zpzaken.nl";

async function metTimeout(url: string, init: RequestInit = {}, ms = 10_000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try { return await fetch(url, { ...init, signal: c.signal }); } finally { clearTimeout(t); }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const auth = await cronOfSupervisor(req, admin);
  if (auth instanceof Response) return auth;

  const metingen: Meting[] = [];
  for (const p of HARTSLAG_PAGINAS) {
    try {
      const r = await metTimeout(`${SITE}${p.pad}`, { headers: { "User-Agent": "ZP-Hartslag/1.0" } });
      metingen.push(beoordeelPagina(p.pad, r.status, await r.text(), p.tekst));
    } catch (e) { metingen.push({ onderdeel: `pagina ${p.pad}`, ok: false, reden: e instanceof Error && e.name === "AbortError" ? "time-out" : "niet bereikbaar" }); }
  }
  try {
    const r = await metTimeout(`${url}/functions/v1/submit-public-form`, { method: "POST", headers: { "Content-Type": "application/json", apikey: Deno.env.get("SUPABASE_ANON_KEY") ?? "" }, body: JSON.stringify({ ping: true }) });
    const b = await r.json().catch(() => ({}));
    metingen.push(r.ok && b?.ping === true ? { onderdeel: "formulierroute", ok: true, reden: "ping ok" } : { onderdeel: "formulierroute", ok: false, reden: `status ${r.status}` });
  } catch { metingen.push({ onderdeel: "formulierroute", ok: false, reden: "niet bereikbaar" }); }

  const uur = new Date(Date.now() - 3_600_000).toISOString();
  const { data: mail, error: mailFout } = await admin.from("email_send_log").select("recipient_email, template_name, status, created_at").gte("created_at", uur).limit(1000);
  metingen.push(mailFout ? { onderdeel: "mailverzending", ok: false, reden: "log niet leesbaar" } : beoordeelMail(mail ?? []));
  const tweeUur = new Date(Date.now() - 7_200_000).toISOString();
  const { data: sync, error: syncFout } = await admin.from("exact_sync_log").select("status, created_at").gte("created_at", tweeUur).limit(1000);
  metingen.push(syncFout ? { onderdeel: "exact-koppeling", ok: false, reden: "log niet leesbaar" } : beoordeelExact(sync ?? []));

  try {
    const token = Deno.env.get("SCHERM_TOKEN") ?? "";
    const r = await metTimeout(`${url}/functions/v1/scherm-data`, { headers: { "x-scherm-token": token, apikey: Deno.env.get("SUPABASE_ANON_KEY") ?? "" } });
    await r.text();
    metingen.push(r.status === 200 ? { onderdeel: "scherm-data", ok: true, reden: "200" } : { onderdeel: "scherm-data", ok: false, reden: `status ${r.status}` });
  } catch { metingen.push({ onderdeel: "scherm-data", ok: false, reden: "niet bereikbaar" }); }

  await admin.from("hartslag_metingen").insert(metingen.map((m) => ({ onderdeel: m.onderdeel, ok: m.ok, reden: m.reden.slice(0, 120) })));
  await admin.rpc("hartslag_opruimen");
  const fout = metingen.filter((m) => !m.ok).length;
  await admin.from("machine_activiteit").insert({ station: "kwaliteit", actie: "agent_run", bron: "hartslag", status: fout ? "fout" : "klaar",
    tekst: fout ? `Hartslag: ${fout} van ${metingen.length} controles fout` : `Hartslag: alle ${metingen.length} controles in orde` });

  // Lasso / Opvolger: gebundelde interne mail, nooit naar klanten.
  let opvolg: Record<string, unknown> = {};
  const { data: ronde, error: rondeFout } = await admin.rpc("opvolger_ronde");
  if (rondeFout) console.error("opvolger_ronde", rondeFout.message);
  else {
    const items = (ronde?.items ?? []) as OpvolgItem[];
    const m = bouwOpvolgMail(items);
    if (m) await verstuurInterneMelding(admin, req, "hartslag:opvolger", { leadType: "opvolger", soort: OPVOLGER_SOORT, subject: m.subject, html: m.html, text: m.text, metadata: { aantal: items.length } });
    opvolg = { open: ronde.open, nieuw_gesignaleerd: ronde.nieuw_gesignaleerd, tweede_signaal: ronde.tweede_signaal, oudste_open_uren: ronde.oudste_open_uren };
    await admin.from("machine_activiteit").insert({ station: "kwaliteit", actie: "agent_run", bron: "opvolger", status: "klaar",
      tekst: `Opvolger: ${ronde.open} open, ${ronde.nieuw_gesignaleerd} nieuw gesignaleerd, ${ronde.tweede_signaal} tweede signaal` });
  }
  return json({ ok: true, metingen: metingen.length, fout, opvolger: opvolg });
});

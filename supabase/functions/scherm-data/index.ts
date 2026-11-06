import { berekenDagomzet } from "../_shared/dagomzet.ts";
import { bouwBezoekersPayload, nieuwsteBezoekDag, nuOpSite, NU_OP_SITE_VENSTER_MS } from "../_shared/bezoekers.ts";
import { vandaagNL } from "../_shared/cronOfSupervisor.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders as basisCors } from "npm:@supabase/supabase-js@2/cors";
import { bouwSchermPayload, markeerVerouderd } from "../_shared/schermAnonimiseer.ts";
import { clientIp } from "../_shared/antiSpam.ts";
import { requireSupervisor } from "../_shared/teamAuth.ts";

const corsHeaders = { ...basisCors, "Access-Control-Allow-Headers": `${basisCors["Access-Control-Allow-Headers"]}, x-scherm-token, x-scherm-code, x-scherm-apparaat, x-scherm-sessie` };
let cache: { op: number; body: string } | null = null;

function gelijk(a: string, b: string) {
  if (a.length !== b.length || a.length === 0) return false;
  let v = 0;
  for (let i = 0; i < a.length; i++) v |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return v === 0;
}

async function sha256(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (body: string, status = 200, extra: Record<string, string> = {}) =>
    new Response(body, { status, headers: { ...corsHeaders, "Content-Type": "application/json", ...extra } });

  const verwacht = Deno.env.get("SCHERM_TOKEN") ?? "";
  if (req.method !== 'GET') return json(JSON.stringify({ error: 'method_not_allowed' }), 405);
  const params = new URL(req.url).searchParams;
  const token = req.headers.get("x-scherm-token") ?? params.get("token") ?? "";
  const apparaatToken = req.headers.get("x-scherm-apparaat") ?? "";
  // De vaste korte schermcode (SCHERM_KORTE_CODE) is uitgezet: x-scherm-code en ?code= worden niet meer geaccepteerd.
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  if (apparaatToken) {
    // Apparaattoken: 32 willekeurige bytes, alleen de sha-256 staat in de database. Ingetrokken of onbekend: 401.
    if (apparaatToken.length < 20 || apparaatToken.length > 100) return json(JSON.stringify({ error: "unauthorized" }), 401);
    const { data: app } = await admin.from("scherm_apparaten").select("id")
      .eq("token_hash", await sha256(apparaatToken)).is("ingetrokken_op", null).maybeSingle();
    if (!app) return json(JSON.stringify({ error: "unauthorized" }), 401);
    await admin.from("scherm_apparaten").update({ laatst_gezien_op: new Date().toISOString() }).eq("id", app.id);
  } else if (!token && req.headers.get("x-scherm-sessie") === "1") {
    // Beheersessie (supervisor/admin met 2FA) voor de demoweergave vanuit het beheer.
    const auth = await requireSupervisor(req, admin);
    if (auth instanceof Response) return json(JSON.stringify({ error: "unauthorized" }), 401);
  } else {
    // Lang token: maximaal 10 mislukte pogingen per IP per uur (form_rate_limit, soort scherm-code).
    const ip = clientIp(req);
    const sinds = new Date(Date.now() - 3_600_000).toISOString();
    const { count: mislukt } = await admin.from("form_rate_limit").select("id", { count: "exact", head: true })
      .eq("ip", ip).eq("kind", "scherm-code").gte("created_at", sinds);
    if ((mislukt ?? 0) >= 10) return json(JSON.stringify({ error: "te_veel_pogingen" }), 429);
    if (!(verwacht !== "" && gelijk(token, verwacht))) {
      await admin.from("form_rate_limit").insert({ ip, kind: "scherm-code" });
      return json(JSON.stringify({ error: "unauthorized" }), 401);
    }
  }

  if (cache && Date.now() - cache.op < 4_000) return json(cache.body, 200, { "Cache-Control": "private, max-age=4", "X-Cache": "hit" });

  try {
    const { data, error } = await admin.rpc("scherm_data");
    if (error) throw new Error(error.message);
    const { data: stromen, error: stroomFout } = await admin.rpc("scherm_stromen");
    if (stroomFout) throw new Error(stroomFout.message);
    const { data: werk, error: werkFout } = await admin.rpc("scherm_werkstand");
    // Zonder werkstand vallen alle toestanden, werkminuten, nu_op_site en de ticker weg: dat is een fout, geen stille terugval.
    if (werkFout) throw new Error(`scherm_werkstand: ${werkFout.message}`);
    const { data: versheid, error: versFout } = await admin.rpc("scherm_versheid");
    if (versFout) console.error("scherm_versheid", versFout.message);
    const { data: bingAi, error: bingFout } = await admin.from("bing_ai_metingen").select("datum, periode, citaties, onderwerpen").order("datum", { ascending: false }).limit(2);
    if (bingFout) console.error("bing_ai_metingen", bingFout.message);
    const { data: hartslagStatus, error: hsFout } = await admin.rpc("hartslag_status");
    if (hsFout) console.error("hartslag_status", hsFout.message);
    const { data: cronSchema, error: csFout } = await admin.rpc("scherm_cron_schema");
    if (csFout) console.error("scherm_cron_schema", csFout.message);
    const { data: omzetRijen, error: omzetFout } = await admin.rpc("scherm_dagomzet_rijen");
    if (omzetFout) console.error("scherm_dagomzet_rijen", omzetFout.message);
    const vandaag = vandaagNL();
    // A8-aanvulling per week (6-11): de dagrij is het 7-dagentotaal; zonder rijen voor vandaag (bijv. vroeg in de ochtend) valt de kaart terug op de meest recente dag met rijen.
    const { data: laatsteDag, error: dagFout } = await admin.from("scherm_bezoekers").select("dag").order("dag", { ascending: false }).limit(1);
    if (dagFout) console.error("scherm_bezoekers dag", dagFout.message);
    const bezoekDag = nieuwsteBezoekDag((laatsteDag ?? []).map((r) => r.dag), vandaag);
    const { data: bezoekRijen, error: bezoekFout } = await admin.from("scherm_bezoekers").select("dag, soort, plaats, provincie, aantal, bijgewerkt_op").eq("dag", bezoekDag).limit(500);
    if (bezoekFout) console.error("scherm_bezoekers", bezoekFout.message);
    // 'Nu op de site': paginabezoeken in de laatste NU_OP_SITE_VENSTER_MS (5 minuten), daarna zakt het getal weer.
    const { data: bezoekTijden, error: tijdFout } = await admin.from("machine_activiteit").select("created_at")
      .eq("actie", "site_bezoek").eq("is_test", false).gte("created_at", new Date(Date.now() - NU_OP_SITE_VENSTER_MS).toISOString()).limit(1000);
    if (tijdFout) console.error("nu_op_site", tijdFout.message);
    const nuOp = tijdFout ? (werk as { nu_op_site?: number } | null)?.nu_op_site ?? null : nuOpSite((bezoekTijden ?? []).map((r) => r.created_at), Date.now());
    // Volgorde bewust: werkstand levert de actuele activiteit (met cron-runs en perioden) en wint van scherm_data.
    const body = JSON.stringify(bouwSchermPayload({ ...(data ?? {}), ...(stromen ?? {}), ...(werk ?? {}), nu_op_site: nuOp, versheid: versheid ?? null, bing_ai: bingAi ?? [], hartslag_status: hartslagStatus ?? [], cron_schema: cronSchema ?? [], dagomzet: omzetFout ? null : berekenDagomzet(omzetRijen), bezoekers: bezoekFout ? null : bouwBezoekersPayload(bezoekRijen, bezoekDag) }));
    cache = { op: Date.now(), body };
    return json(body, 200, { "Cache-Control": "private, max-age=4" });
  } catch (e) {
    console.error("scherm-data", e instanceof Error ? e.message : "onbekend");
    if (cache) return json(markeerVerouderd(cache.body, cache.op), 200, { "X-Cache": "stale" });
    return json(JSON.stringify({ error: "tijdelijk_niet_beschikbaar" }), 503);
  }
});

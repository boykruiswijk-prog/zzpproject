// Alleen-lezen controle van grootboekrekeningen en het BAV-AVB-artikel in Exact.
// Toegang: alleen header x-cron-secret (verify_cron_secret). Doet uitsluitend GET's.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { ensureValidToken } from "../_shared/exactToken.ts";

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b, null, 1), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const OUD = "d40fbb95-43b0-4503-9fe8-287f14d59120";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  const secret = req.headers.get("x-cron-secret") ?? "";
  const { data: ok } = secret ? await supabase.rpc("verify_cron_secret", { p_secret: secret }) : { data: false };
  if (ok !== true) return json({ error: "unauthorized" }, 401);

  const { data: cfg } = await supabase.from("exact_config").select("*").limit(1).maybeSingle();
  if (!cfg?.is_actief) return json({ error: "exact_niet_actief" }, 400);
  const token = await ensureValidToken(supabase, cfg);
  const base = `${cfg.base_url || "https://start.exactonline.nl"}/api/v1/${cfg.divisie_code}`;
  const get = async (path: string) => {
    const r = await fetch(`${base}/${path}`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
    const t = await r.text();
    try { const j = JSON.parse(t); return { status: r.status, rows: j?.d?.results ?? (j?.d ? [j.d] : []), raw: r.ok ? undefined : t.slice(0, 300) }; }
    catch { return { status: r.status, rows: [], raw: t.slice(0, 300) }; }
  };
  const glSel = "ID,Code,Description,Type,TypeDescription,BalanceSide,BalanceType,IsBlocked";
  const oud = await get(`financial/GLAccounts?$select=${glSel}&$filter=ID eq guid'${OUD}'`);
  // Code kan met spaties opgevuld zijn: filter op trim en vergelijk daarna nogmaals getrimd.
  const nieuw = await get(`financial/GLAccounts?$select=${glSel}&$filter=trim(Code) eq '8003'`);
  const nieuwRows = nieuw.rows.filter((x: any) => String(x.Code ?? "").trim() === "8003");
  let item: unknown = null;
  if (cfg.exact_item_id_bav_avb) {
    const it = await get(`logistics/Items?$select=ID,Code,Description,GLRevenue,GLRevenueCode,GLRevenueDescription,SalesVatCode,IsSalesItem&$filter=ID eq guid'${cfg.exact_item_id_bav_avb}'`);
    item = it;
  }
  return json({ oud, nieuw: { status: nieuw.status, rows: nieuwRows, raw: nieuw.raw }, item });
});

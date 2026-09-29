// Alleen-lezen controle: roept getBavGlAccountId aan (lookup op code of cache) en
// leest de grootboekrekening en het BAV-AVB-artikel terug. Doet uitsluitend GET's
// (plus het vullen van de GL-cache in exact_config). Toegang: alleen x-cron-secret.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { ensureValidToken } from "../_shared/exactToken.ts";
import { getBavGlAccountId } from "../_shared/exactGl.ts";

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b, null, 1), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  const secret = req.headers.get("x-cron-secret") ?? "";
  const { data: ok } = secret ? await supabase.rpc("verify_cron_secret", { p_secret: secret }) : { data: false };
  if (ok !== true) return json({ error: "unauthorized" }, 401);

  const { data: cfg } = await supabase.from("exact_config").select("*").limit(1).maybeSingle();
  if (!cfg?.is_actief) return json({ error: "exact_niet_actief" }, 400);
  const cacheVoor = { id: cfg.gl_account_id_bav, code: cfg.gl_account_id_bav_code };
  const token = await ensureValidToken(supabase, cfg);
  let glId: string;
  try { glId = await getBavGlAccountId(supabase, cfg, token); }
  catch (e) { return json({ error: e instanceof Error ? e.message : String(e) }, 502); }

  const base = `${cfg.base_url || "https://start.exactonline.nl"}/api/v1/${cfg.divisie_code}`;
  const get = async (path: string) => {
    const r = await fetch(`${base}/${path}`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
    const j = await r.json().catch(() => ({}));
    return j?.d?.results?.[0] ?? null;
  };
  const gl = await get(`financial/GLAccounts?$select=ID,Code,Description,Type,IsBlocked&$filter=ID eq guid'${glId}'`);
  const item = cfg.exact_item_id_bav_avb
    ? await get(`logistics/Items?$select=Code,GLRevenue,GLRevenueCode&$filter=ID eq guid'${cfg.exact_item_id_bav_avb}'`)
    : null;
  return json({
    gl_code_bav: cfg.gl_code_bav, helper_resultaat: glId, cache_voor: cacheVoor,
    grootboek: gl ? { Code: String(gl.Code).trim(), Description: gl.Description, Type: gl.Type, IsBlocked: gl.IsBlocked } : null,
    item_glrevenue_code: item ? String(item.GLRevenueCode ?? "").trim() : null,
    item_wijkt_af: item ? String(item.GLRevenueCode ?? "").trim() !== String(cfg.gl_code_bav).trim() : null,
  });
});

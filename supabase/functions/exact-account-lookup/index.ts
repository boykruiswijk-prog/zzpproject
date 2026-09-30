// Read-only: zoekt Exact-relaties op KvK en/of naamdeel. Alleen GET-aanroepen.
// Toegang: x-cron-secret (verify_cron_secret) of supervisor-JWT.
import { createClient } from "npm:@supabase/supabase-js@2";
import { ensureValidToken } from "../_shared/exactToken.ts";
import { requireSupervisor } from "../_shared/teamAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  const secret = req.headers.get("x-cron-secret") ?? "";
  let allowed = false;
  if (secret) {
    const { data } = await admin.rpc("verify_cron_secret", { p_secret: secret });
    allowed = data === true;
  }
  if (!allowed) {
    const auth = await requireSupervisor(req, admin);
    if (auth instanceof Response) return auth;
  }
  const body = await req.json().catch(() => ({}));
  const kvk = String(body?.kvk ?? "").replace(/\D/g, "").slice(0, 8);
  const naam = String(body?.naam ?? "").toLowerCase().replace(/[^a-z0-9 @.&-]/g, "").slice(0, 40);
  if (!kvk && !naam) return json({ error: "kvk_of_naam_verplicht" }, 400);

  const { data: cfg } = await admin.from("exact_config").select("*").limit(1).maybeSingle();
  if (!cfg?.is_actief || !cfg.divisie_code) return json({ error: "exact_niet_actief" }, 503);
  const token = await ensureValidToken(admin, cfg);
  const base = `${cfg.base_url || "https://start.exactonline.nl"}/api/v1/${cfg.divisie_code}`;
  const sel = "ID,Code,Name,ChamberOfCommerce,Email,Status";
  const get = async (filter: string) => {
    const r = await fetch(`${base}/crm/Accounts?$select=${sel}&$filter=${encodeURIComponent(filter)}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    const j = await r.json().catch(() => ({}));
    const arr = Array.isArray(j?.d?.results) ? j.d.results : Array.isArray(j?.d) ? j.d : [];
    return { http_status: r.status, results: arr.map((a: any) => ({ ID: a.ID, Code: String(a.Code ?? "").trim(), Name: a.Name, ChamberOfCommerce: a.ChamberOfCommerce, Email: a.Email, Status: a.Status })) };
  };
  const out: Record<string, unknown> = { division: cfg.divisie_code };
  if (kvk) {
    out.kvk_trim = await get(`trim(ChamberOfCommerce) eq '${kvk}'`);
    out.kvk_exact = await get(`ChamberOfCommerce eq '${kvk}'`); // zelfde filter als lead-to-exact-activate
  }
  if (naam) out.naam = await get(`substringof('${naam}', tolower(Name))`);
  return json(out);
});

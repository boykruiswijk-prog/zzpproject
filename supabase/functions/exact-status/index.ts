import { createClient } from "npm:@supabase/supabase-js@2";
import { ensureValidToken } from "../_shared/exactToken.ts";
import { requireSupervisor } from "../_shared/teamAuth.ts";
import { checkConfiguredDivision } from "../_shared/exactDivision.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json" },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  const auth = await requireSupervisor(req, admin);
  if (auth instanceof Response) return auth;
  const { data: cfg } = await admin.from("exact_config").select("*").limit(1).maybeSingle();
  if (!cfg?.is_actief) return json({ active: false, division: cfg?.divisie_code ?? null, expires_at: cfg?.access_token_expires_at ?? null });
  const token = await ensureValidToken(admin, cfg);
  const baseUrl = cfg.base_url || "https://start.exactonline.nl";
  const res = await fetch(`${baseUrl}/api/v1/current/Me?$select=CurrentDivision`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  const body = res.ok ? await res.json().catch(() => ({})) : {};
  const me = body?.d?.results?.[0] ?? body?.d ?? {};
  const division = String(cfg.divisie_code ?? "");
  const check = await checkConfiguredDivision(baseUrl, division, token);
  if (!check.ok) return json({ error: "exact_status_failed", message: check.error, http_status: check.status, division }, 502);
  return json({ active: true, division, administration: check.administration, current_division_info: me.CurrentDivision ? String(me.CurrentDivision) : null, expires_at: cfg.access_token_expires_at ?? null });
});
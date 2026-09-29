import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { ensureValidToken } from "../_shared/exactToken.ts";
import { requireSupervisor } from "../_shared/teamAuth.ts";

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
  const res = await fetch(`${cfg.base_url || "https://start.exactonline.nl"}/api/v1/current/Me?$select=CurrentDivision,FullName,UserName`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!res.ok) return json({ error: "exact_status_failed", http_status: res.status }, 502);
  const body = await res.json().catch(() => ({}));
  const me = body?.d?.results?.[0] ?? body?.d ?? {};
  return json({ active: true, division: String(me.CurrentDivision ?? cfg.divisie_code ?? ""), administration: me.FullName ?? me.UserName ?? null, expires_at: cfg.access_token_expires_at ?? null });
});
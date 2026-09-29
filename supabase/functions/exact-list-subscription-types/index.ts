// Haalt beschikbare SubscriptionTypes op uit Exact zodat de admin
// de juiste GUID's kan koppelen aan onze BAV pakketten.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { ensureValidToken } from "../_shared/exactToken.ts";
import { requireSupervisor } from "../_shared/teamAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const auth = await requireSupervisor(req, admin);
    if (auth instanceof Response) return new Response(await auth.text(), { status: auth.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // M4: token uitsluitend via _shared/exactToken.ts (exact_config).
    const { data: cfg } = await admin.from("exact_config").select("*").limit(1).maybeSingle();
    if (!cfg?.is_actief || !cfg.divisie_code) {
      return new Response(JSON.stringify({ error: "exact_niet_actief" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const accessToken = await ensureValidToken(admin, cfg);
    const baseUrl = cfg.base_url || "https://start.exactonline.nl";

    const res = await fetch(
      `${baseUrl}/api/v1/${cfg.divisie_code}/subscription/SubscriptionTypes?$select=ID,Code,Description`,
      { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } }
    );
    if (!res.ok) {
      const txt = await res.text();
      return new Response(JSON.stringify({ error: `exact_${res.status}`, detail: txt }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const data = await res.json();
    return new Response(JSON.stringify({ success: true, items: data?.d?.results ?? [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

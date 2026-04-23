// deno-lint-ignore-file no-explicit-any
// Exact Online sync — STUB. Voert nu enkel structurele validatie uit
// en logt wat er zou gebeuren. Echte OAuth + API-calls volgen later.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden — admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: cfg, error } = await admin.from("exact_config").select("*").maybeSingle();
    if (error) throw error;

    if (!cfg || !cfg.is_actief) {
      return new Response(
        JSON.stringify({ success: false, error: "Exact integratie niet actief" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // STAP A: token vernieuwen via POST https://start.exactonline.nl/api/oauth2/token
    // STAP B: relatie aanmaken via POST {base_url}/{divisie_code}/crm/Accounts
    // STAP C: abonnement aanmaken via POST {base_url}/{divisie_code}/subscription/Subscriptions
    console.log("[exact-sync STUB] Zou nu syncen met divisie", cfg.divisie_code);

    return new Response(
      JSON.stringify({
        success: true,
        exact_actief: true,
        message: "Stub — daadwerkelijke API-calls nog niet geïmplementeerd",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("exact-sync error", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

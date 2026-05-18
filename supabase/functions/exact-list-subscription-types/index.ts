// Haalt beschikbare SubscriptionTypes op uit Exact zodat de admin
// de juiste GUID's kan koppelen aan onze BAV pakketten.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const BASE_URL = Deno.env.get("EXACT_BASE_URL") ?? "https://start.exactonline.nl";
    const TEST_MODE = Deno.env.get("EXACT_TEST_MODE") === "true";
    const environment = TEST_MODE ? "test" : "production";

    // Auth: alleen admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: userData.user.id, _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: tokenRow } = await admin
      .from("exact_tokens").select("*").eq("environment", environment).maybeSingle();
    if (!tokenRow) {
      return new Response(JSON.stringify({ error: "no_token" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const res = await fetch(
      `${BASE_URL}/api/v1/${tokenRow.division_code}/subscription/SubscriptionTypes?$select=ID,Code,Description`,
      { headers: { Authorization: `Bearer ${tokenRow.access_token}`, Accept: "application/json" } }
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

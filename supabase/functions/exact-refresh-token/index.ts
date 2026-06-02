// Ververst de Exact Online access_token via de refresh_token.
// Gebruikt door cron én on-demand door process-bav-wizard.
// LET OP: gebruikt ALTIJD de nieuwe refresh_token die Exact teruggeeft.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const CLIENT_ID = Deno.env.get("EXACT_CLIENT_ID")!;
    const CLIENT_SECRET = Deno.env.get("EXACT_CLIENT_SECRET")!;
    const BASE_URL = Deno.env.get("EXACT_BASE_URL") ?? "https://start.exactonline.nl";
    const TEST_MODE = Deno.env.get("EXACT_TEST_MODE") === "true";
    const environment = TEST_MODE ? "test" : "production";

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Auth: allow either service-role (internal calls) or an admin user
    const authHeader = req.headers.get("Authorization") ?? "";
    const bearer = authHeader.replace(/^Bearer\s+/i, "");
    const isServiceRole = bearer && bearer === SERVICE_ROLE_KEY;

    if (!isServiceRole) {
      if (!authHeader) {
        return new Response(JSON.stringify({ success: false, error: "unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) {
        return new Response(JSON.stringify({ success: false, error: "unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
      const { data: isAdmin } = await adminClient.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (!isAdmin) {
        return new Response(JSON.stringify({ success: false, error: "forbidden" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);


    const { data: tokenRow, error: fetchErr } = await supabase
      .from("exact_tokens")
      .select("*")
      .eq("environment", environment)
      .maybeSingle();

    if (fetchErr) throw new Error(`DB fetch: ${fetchErr.message}`);
    if (!tokenRow) {
      return new Response(
        JSON.stringify({ success: false, error: "no_token_row_yet" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const refreshRes = await fetch(`${BASE_URL}/api/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: tokenRow.refresh_token,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: "refresh_token",
      }),
    });

    if (!refreshRes.ok) {
      const txt = await refreshRes.text();
      console.error("Refresh failed:", refreshRes.status, txt);
      return new Response(
        JSON.stringify({ success: false, error: `refresh_${refreshRes.status}`, detail: txt }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tokenData = await refreshRes.json();
    const expiresAt = new Date(Date.now() + (tokenData.expires_in ?? 600) * 1000).toISOString();

    const { error: updateErr } = await supabase
      .from("exact_tokens")
      .update({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token, // ALTIJD de nieuwe
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", tokenRow.id);

    if (updateErr) throw new Error(`DB update: ${updateErr.message}`);

    return new Response(
      JSON.stringify({
        success: true,
        access_token: tokenData.access_token,
        expires_at: expiresAt,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error("exact-refresh-token error:", msg);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

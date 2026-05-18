// Bouwt de Exact OAuth autorisatie URL met de client_id uit secrets
// en redirect de admin browser naar Exact.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const CLIENT_ID = Deno.env.get("EXACT_CLIENT_ID")!;
    const REDIRECT_URI = Deno.env.get("EXACT_REDIRECT_URI")!;
    const BASE_URL = Deno.env.get("EXACT_BASE_URL") ?? "https://start.exactonline.nl";

    const authUrl =
      `${BASE_URL}/api/oauth2/auth?` +
      new URLSearchParams({
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        response_type: "code",
        force_login: "1",
      }).toString();

    return Response.redirect(authUrl, 302);
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

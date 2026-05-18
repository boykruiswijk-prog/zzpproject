// Exact Online OAuth callback handler.
// Wisselt de authorization code in voor access + refresh tokens
// en slaat deze op in de exact_tokens tabel.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");

    const SITE_URL = "https://zpzaken.nl";
    const redirectBack = (status: string, message = "") =>
      Response.redirect(
        `${SITE_URL}/admin/integraties?status=${status}${
          message ? `&message=${encodeURIComponent(message)}` : ""
        }`,
        302
      );

    if (error) return redirectBack("error", error);
    if (!code) return redirectBack("error", "missing_code");

    const CLIENT_ID = Deno.env.get("EXACT_CLIENT_ID")!;
    const CLIENT_SECRET = Deno.env.get("EXACT_CLIENT_SECRET")!;
    const REDIRECT_URI = Deno.env.get("EXACT_REDIRECT_URI")!;
    const BASE_URL = Deno.env.get("EXACT_BASE_URL") ?? "https://start.exactonline.nl";
    const DIVISION = Deno.env.get("EXACT_DIVISION_CODE") ?? "";
    const TEST_MODE = Deno.env.get("EXACT_TEST_MODE") === "true";
    const environment = TEST_MODE ? "test" : "production";

    const tokenRes = await fetch(`${BASE_URL}/api/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const txt = await tokenRes.text();
      console.error("Exact token exchange failed:", tokenRes.status, txt);
      return redirectBack("error", `token_exchange_${tokenRes.status}`);
    }

    const tokenData = await tokenRes.json();
    const expiresAt = new Date(Date.now() + (tokenData.expires_in ?? 600) * 1000).toISOString();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Upsert per environment (max 1 rij)
    const { error: upsertErr } = await supabase
      .from("exact_tokens")
      .upsert(
        {
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          expires_at: expiresAt,
          division_code: DIVISION,
          environment,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "environment" }
      );

    if (upsertErr) {
      console.error("Token upsert failed:", upsertErr);
      return redirectBack("error", "db_save_failed");
    }

    return redirectBack("success");
  } catch (e) {
    console.error("exact-oauth-callback error:", e);
    return Response.redirect(
      `https://zpzaken.nl/admin/integraties?status=error&message=${encodeURIComponent(
        e instanceof Error ? e.message : "unknown"
      )}`,
      302
    );
  }
});

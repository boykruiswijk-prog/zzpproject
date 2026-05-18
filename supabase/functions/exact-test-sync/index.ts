// Verstuurt een mock BAV aanmelding via process-bav-wizard zodat
// de admin de Exact verbinding kan testen. Bedrijfsnaam krijgt
// TEST_Verbindingstest_<timestamp> prefix.
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

    const ts = Date.now();
    const mock = {
      pakket: "uitgebreid",
      betaalwijze: "maandelijks",
      ingangsdatum: new Date().toISOString().split("T")[0],
      voornaam: "Test",
      achternaam: "Verbinding",
      email: `verbindingstest+${ts}@zpzaken.nl`,
      telefoon: "0204573077",
      bedrijfsnaam: `Verbindingstest_${ts}`,
      kvk_nummer: "00000000",
      beroep: "Test",
      sector: "Test",
      iban: "NL00BANK0000000000",
      rekeninghouder: "Test Verbinding",
      opmerkingen: "Mock test via /admin/integraties",
    };

    const res = await fetch(`${SUPABASE_URL}/functions/v1/process-bav-wizard`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(mock),
    });
    const result = await res.json();

    return new Response(
      JSON.stringify({ success: res.ok, status: res.status, result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

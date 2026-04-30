// Otentica webhook endpoint — voorbereid, nog niet actief
// Logt binnenkomende webhook-data; verwerking volgt later.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = await req.json().catch(() => ({}));
    console.log("Otentica webhook received:", JSON.stringify(payload));

    // TODO: latere verwerking van Otentica callbacks
    // - matchen op otentica_flow_id
    // - otentica_status updaten
    // - otentica_rapport_url opslaan
    // - otentica_webhook_data opslaan

    return new Response(
      JSON.stringify({ received: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    console.error("otentica-webhook error:", message);
    return new Response(
      JSON.stringify({ received: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

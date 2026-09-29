// Bulkuitnodigen voor Mijn ZP is UITGESCHAKELD (directiebesluit B8, 29-09-2026):
// bestaande klanten krijgen geen uitnodiging. Uitnodigen gebeurt alleen handmatig
// per lead via send-portal-invite. Deze functie doet niets en geeft altijd 410.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  return new Response(JSON.stringify({ error: "uitgeschakeld" }), {
    status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

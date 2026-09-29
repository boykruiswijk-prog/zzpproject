// UITGESCHAKELD (M4, 29-09-2026): verversen van het Exact-token gebeurt uitsluitend
// via _shared/exactToken.ts (ensureValidToken, met lock). Deze functie las de lege
// tabel exact_tokens. Doet niets en geeft altijd 410.
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

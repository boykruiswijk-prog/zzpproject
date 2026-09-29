// UITGESCHAKELD (H6, 29-09-2026): deze functie testte alleen de Exact-stap in
// process-bav-wizard, die is verwijderd (Exact wordt pas bij activatie ingericht).
// Doet niets en geeft altijd 410.
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

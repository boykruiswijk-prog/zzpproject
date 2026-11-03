// Vervallen (besluit Boy 3-11): geen "Nabellen"-mail meer op het 30-minutenmoment. Afhakers krijgen een
// herinneringsmail via afhaak-herinnering, die daarna het team meldt. Cron is uitgeschakeld; deze functie doet niets.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  return new Response(JSON.stringify({ ok: true, skipped: "vervallen" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});

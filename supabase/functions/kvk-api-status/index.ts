// Publieke read-only check: is de KVK API operationeel? Antwoordt alleen true/false, nooit de sleutel.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { kvkApiOperationeel } from "../_shared/kvkUittreksel.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  let operationeel = false;
  try { operationeel = await kvkApiOperationeel(admin); } catch (_) { operationeel = false; }
  return new Response(JSON.stringify({ operationeel }), { headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=60" } });
});

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders as basisCors } from "npm:@supabase/supabase-js@2/cors";
import { bouwSchermPayload } from "../_shared/schermAnonimiseer.ts";

const corsHeaders = { ...basisCors, "Access-Control-Allow-Headers": `${basisCors["Access-Control-Allow-Headers"]}, x-scherm-token` };
let cache: { op: number; body: string } | null = null;

function gelijk(a: string, b: string) {
  if (a.length !== b.length || a.length === 0) return false;
  let v = 0;
  for (let i = 0; i < a.length; i++) v |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return v === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (body: string, status = 200, extra: Record<string, string> = {}) =>
    new Response(body, { status, headers: { ...corsHeaders, "Content-Type": "application/json", ...extra } });

  const verwacht = Deno.env.get("SCHERM_TOKEN") ?? "";
  const token = req.headers.get("x-scherm-token") ?? new URL(req.url).searchParams.get("token") ?? "";
  if (!verwacht || !gelijk(token, verwacht)) return json(JSON.stringify({ error: "unauthorized" }), 401);

  if (cache && Date.now() - cache.op < 20_000) return json(cache.body, 200, { "Cache-Control": "private, max-age=20", "X-Cache": "hit" });

  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    await admin.rpc("machine_cron_verwerken");
    const { data, error } = await admin.rpc("scherm_data");
    if (error) throw new Error(error.message);
    const body = JSON.stringify(bouwSchermPayload(data ?? {}));
    cache = { op: Date.now(), body };
    return json(body, 200, { "Cache-Control": "private, max-age=20" });
  } catch (e) {
    console.error("scherm-data", e instanceof Error ? e.message : "onbekend");
    if (cache) return json(cache.body, 200, { "X-Cache": "stale" });
    return json(JSON.stringify({ error: "tijdelijk_niet_beschikbaar" }), 503);
  }
});

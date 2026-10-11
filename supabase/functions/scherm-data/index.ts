import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders as basisCors } from "npm:@supabase/supabase-js@2/cors";
import { bouwSchermPayload } from "../_shared/schermAnonimiseer.ts";
import { clientIp } from "../_shared/antiSpam.ts";

const corsHeaders = { ...basisCors, "Access-Control-Allow-Headers": `${basisCors["Access-Control-Allow-Headers"]}, x-scherm-token, x-scherm-code` };
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
  if (req.method !== 'GET') return json(JSON.stringify({ error: 'method_not_allowed' }), 405);
  const params = new URL(req.url).searchParams;
  const token = req.headers.get("x-scherm-token") ?? params.get("token") ?? "";
  const code = (req.headers.get("x-scherm-code") ?? params.get("code") ?? "").toUpperCase();
  const korteCode = Deno.env.get("SCHERM_KORTE_CODE") ?? "";
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Maximaal 10 mislukte pogingen per IP per uur (form_rate_limit, soort scherm-code).
  const ip = clientIp(req);
  const sinds = new Date(Date.now() - 3_600_000).toISOString();
  const { count: mislukt } = await admin.from("form_rate_limit").select("id", { count: "exact", head: true })
    .eq("ip", ip).eq("kind", "scherm-code").gte("created_at", sinds);
  if ((mislukt ?? 0) >= 10) return json(JSON.stringify({ error: "te_veel_pogingen" }), 429);

  const geldig = (verwacht !== "" && gelijk(token, verwacht)) || (korteCode !== "" && gelijk(code, korteCode));
  if (!geldig) {
    await admin.from("form_rate_limit").insert({ ip, kind: "scherm-code" });
    return json(JSON.stringify({ error: "unauthorized" }), 401);
  }

  if (cache && Date.now() - cache.op < 20_000) return json(cache.body, 200, { "Cache-Control": "private, max-age=20", "X-Cache": "hit" });

  try {
    const { data, error } = await admin.rpc("scherm_data");
    if (error) throw new Error(error.message);
    const { data: stromen, error: stroomFout } = await admin.rpc("scherm_stromen");
    if (stroomFout) throw new Error(stroomFout.message);
    const body = JSON.stringify(bouwSchermPayload({ ...(data ?? {}), ...(stromen ?? {}) }));
    cache = { op: Date.now(), body };
    return json(body, 200, { "Cache-Control": "private, max-age=20" });
  } catch (e) {
    console.error("scherm-data", e instanceof Error ? e.message : "onbekend");
    if (cache) return json(cache.body, 200, { "X-Cache": "stale" });
    return json(JSON.stringify({ error: "tijdelijk_niet_beschikbaar" }), 503);
  }
});

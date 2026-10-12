import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders as basisCors } from "npm:@supabase/supabase-js@2/cors";
import { bouwSchermPayload } from "../_shared/schermAnonimiseer.ts";
import { clientIp } from "../_shared/antiSpam.ts";
import { requireSupervisor } from "../_shared/teamAuth.ts";

const corsHeaders = { ...basisCors, "Access-Control-Allow-Headers": `${basisCors["Access-Control-Allow-Headers"]}, x-scherm-token, x-scherm-code, x-scherm-apparaat, x-scherm-sessie` };
let cache: { op: number; body: string } | null = null;

function gelijk(a: string, b: string) {
  if (a.length !== b.length || a.length === 0) return false;
  let v = 0;
  for (let i = 0; i < a.length; i++) v |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return v === 0;
}

async function sha256(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (body: string, status = 200, extra: Record<string, string> = {}) =>
    new Response(body, { status, headers: { ...corsHeaders, "Content-Type": "application/json", ...extra } });

  const verwacht = Deno.env.get("SCHERM_TOKEN") ?? "";
  if (req.method !== 'GET') return json(JSON.stringify({ error: 'method_not_allowed' }), 405);
  const params = new URL(req.url).searchParams;
  const token = req.headers.get("x-scherm-token") ?? params.get("token") ?? "";
  const apparaatToken = req.headers.get("x-scherm-apparaat") ?? "";
  // De vaste korte schermcode (SCHERM_KORTE_CODE) is uitgezet: x-scherm-code en ?code= worden niet meer geaccepteerd.
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  if (apparaatToken) {
    // Apparaattoken: 32 willekeurige bytes, alleen de sha-256 staat in de database. Ingetrokken of onbekend: 401.
    if (apparaatToken.length < 20 || apparaatToken.length > 100) return json(JSON.stringify({ error: "unauthorized" }), 401);
    const { data: app } = await admin.from("scherm_apparaten").select("id")
      .eq("token_hash", await sha256(apparaatToken)).is("ingetrokken_op", null).maybeSingle();
    if (!app) return json(JSON.stringify({ error: "unauthorized" }), 401);
    await admin.from("scherm_apparaten").update({ laatst_gezien_op: new Date().toISOString() }).eq("id", app.id);
  } else if (!token && req.headers.get("x-scherm-sessie") === "1") {
    // Beheersessie (supervisor/admin met 2FA) voor de demoweergave vanuit het beheer.
    const auth = await requireSupervisor(req, admin);
    if (auth instanceof Response) return json(JSON.stringify({ error: "unauthorized" }), 401);
  } else {
    // Lang token: maximaal 10 mislukte pogingen per IP per uur (form_rate_limit, soort scherm-code).
    const ip = clientIp(req);
    const sinds = new Date(Date.now() - 3_600_000).toISOString();
    const { count: mislukt } = await admin.from("form_rate_limit").select("id", { count: "exact", head: true })
      .eq("ip", ip).eq("kind", "scherm-code").gte("created_at", sinds);
    if ((mislukt ?? 0) >= 10) return json(JSON.stringify({ error: "te_veel_pogingen" }), 429);
    if (!(verwacht !== "" && gelijk(token, verwacht))) {
      await admin.from("form_rate_limit").insert({ ip, kind: "scherm-code" });
      return json(JSON.stringify({ error: "unauthorized" }), 401);
    }
  }

  if (cache && Date.now() - cache.op < 20_000) return json(cache.body, 200, { "Cache-Control": "private, max-age=20", "X-Cache": "hit" });

  try {
    const { data, error } = await admin.rpc("scherm_data");
    if (error) throw new Error(error.message);
    const { data: stromen, error: stroomFout } = await admin.rpc("scherm_stromen");
    if (stroomFout) throw new Error(stroomFout.message);
    const { data: werk, error: werkFout } = await admin.rpc("scherm_werkstand");
    if (werkFout) console.error("scherm_werkstand", werkFout.message);
    const body = JSON.stringify(bouwSchermPayload({ ...(data ?? {}), ...(stromen ?? {}), ...(werk ?? {}) }));
    cache = { op: Date.now(), body };
    return json(body, 200, { "Cache-Control": "private, max-age=20" });
  } catch (e) {
    console.error("scherm-data", e instanceof Error ? e.message : "onbekend");
    if (cache) return json(cache.body, 200, { "X-Cache": "stale" });
    return json(JSON.stringify({ error: "tijdelijk_niet_beschikbaar" }), 503);
  }
});

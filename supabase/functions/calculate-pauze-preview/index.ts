// Read-only preview voor pauze/hervat/opzeg-modals. Geen Exact-calls.
// Body: { lead_id, action?: "pauze" | "hervat" | "opzeg" }   (default: "pauze")
// Returns: { credit_bedrag/factuur_bedrag, resterende_dagen, dagprijs, polis_einddatum, jaarprijs }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  getJaarprijs, calculatePauzeCredit, calculateHervatFactuur, calcPolisEinddatum,
} from "../_shared/polisProRata.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabase = createClient(SUPABASE_URL, SERVICE);

  const authHeader = req.headers.get("authorization") || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return json({ error: "unauthorized" }, 401);
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);

  let body: any = {};
  try { body = await req.json(); } catch { /* */ }
  const leadId = body?.lead_id;
  const action: "pauze" | "hervat" = body?.action === "hervat" ? "hervat" : "pauze";
  if (!leadId) return json({ error: "lead_id_required" }, 400);

  // Authz: admin OR eigenaar van de polis
  const { data: roleRow } = await supabase
    .from("user_roles").select("role").eq("user_id", user.id).limit(1).maybeSingle();
  const isAdmin = !!roleRow;
  if (!isAdmin) {
    const { data: pol } = await supabase
      .from("policies").select("user_id").eq("lead_id", leadId).limit(1).maybeSingle();
    if (!pol || pol.user_id !== user.id) return json({ error: "forbidden" }, 403);
  }

  const { data: lead, error: lErr } = await supabase
    .from("leads").select("ingangsdatum, polis_einddatum, gekozen_pakket")
    .eq("id", leadId).single();
  if (lErr || !lead) return json({ error: "lead_not_found" }, 404);
  if (!lead.ingangsdatum) return json({ error: "geen_ingangsdatum" }, 400);

  const jaarprijs = getJaarprijs(lead.gekozen_pakket);
  const eind = lead.polis_einddatum ?? calcPolisEinddatum(lead.ingangsdatum);
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());

  if (action === "pauze") {
    const calc = calculatePauzeCredit({
      ingangsdatum: lead.ingangsdatum, polis_einddatum: eind,
      jaarprijs, pauze_datum: today,
    });
    return json({
      ok: true, action, jaarprijs, polis_einddatum: eind, pauze_datum: today, ...calc,
    });
  }
  // hervat
  const calc = calculateHervatFactuur({
    ingangsdatum: lead.ingangsdatum, polis_einddatum: eind,
    jaarprijs, hervat_datum: today,
  });
  return json({
    ok: true, action, jaarprijs, polis_einddatum: eind, hervat_datum: today, ...calc,
  });
});

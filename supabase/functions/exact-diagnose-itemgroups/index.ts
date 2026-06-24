// Read-only diagnose: lijst ItemGroups + aantal Items per groep in Exact divisie.
// Geen mutaties. Admin-only.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// deno-lint-ignore no-explicit-any
async function ensureValidToken(supabase: any, config: any): Promise<string> {
  const baseUrl = config.base_url || "https://start.exactonline.nl";
  const expiresAt = config.access_token_expires_at ? new Date(config.access_token_expires_at) : new Date(0);
  if (expiresAt.getTime() - Date.now() > 60_000 && config.access_token) return config.access_token;
  if (!config.refresh_token) throw new Error("Geen refresh_token");
  const r = await fetch(`${baseUrl}/api/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: config.refresh_token,
      client_id: config.client_id,
      client_secret: config.client_secret,
    }).toString(),
  });
  const td = await r.json();
  if (!r.ok || !td.access_token) throw new Error(`Refresh mislukt: ${JSON.stringify(td)}`);
  const exp = new Date(Date.now() + td.expires_in * 1000).toISOString();
  await supabase.from("exact_config").update({
    access_token: td.access_token,
    refresh_token: td.refresh_token,
    access_token_expires_at: exp,
    token_expires_at: exp,
    refresh_token_obtained_at: new Date().toISOString(),
  }).eq("id", config.id);
  return td.access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: config, error: cErr } = await supabase.from("exact_config").select("*").limit(1).maybeSingle();
    if (cErr || !config) return json({ error: "exact_config niet gevonden", cErr }, 500);

    const token = await ensureValidToken(supabase, config);
    const baseUrl = config.base_url || "https://start.exactonline.nl";
    const division = config.division_code || "4401707";
    const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };

    // Optioneel: $metadata voor ItemGroup
    const url = new URL(req.url);
    if (url.searchParams.get("meta") === "1") {
      const mUrl = `${baseUrl}/api/v1/${division}/logistics/$metadata`;
      const mRes = await fetch(mUrl, { headers: { Authorization: `Bearer ${token}`, Accept: "application/xml" } });
      const xml = await mRes.text();
      const m = xml.match(/<EntityType[^>]*Name="ItemGroup"[\s\S]*?<\/EntityType>/);
      return json({ success: mRes.ok, http_status: mRes.status, entity_xml: m ? m[0] : null, raw_length: xml.length });
    }



    // STAP 1: lijst ItemGroups
    const groupsUrl = `${baseUrl}/api/v1/${division}/logistics/ItemGroups?$select=ID,Code,Description,Notes&$orderby=Code`;
    const gRes = await fetch(groupsUrl, { headers });
    const gText = await gRes.text();
    let gJson: any = null; try { gJson = JSON.parse(gText); } catch { /* ignore */ }
    if (!gRes.ok) return json({ step: "ItemGroups GET", status: gRes.status, body: gText }, 500);
    const groups = gJson?.d?.results ?? gJson?.d ?? [];

    // STAP 3: count items per group
    const enriched = await Promise.all(groups.map(async (g: any) => {
      const cUrl = `${baseUrl}/api/v1/${division}/logistics/Items?$filter=ItemGroup eq guid'${g.ID}'&$top=0&$inlinecount=allpages`;
      const cRes = await fetch(cUrl, { headers });
      const cTxt = await cRes.text();
      let count: any = null;
      try {
        const cj = JSON.parse(cTxt);
        count = cj?.d?.__count ?? cj?.d?.results?.length ?? null;
      } catch { /* ignore */ }
      return { ID: g.ID, Code: g.Code, Description: g.Description, ItemCount: count };
    }));

    return json({
      success: true,
      division,
      groups_total: enriched.length,
      groups: enriched,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

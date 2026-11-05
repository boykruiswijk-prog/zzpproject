// A8-aanvulling Bezoekerskaart: haalt elke 10 minuten (cron) uit GA4 de bezoekers per plaats van vandaag
// en de realtime bezoekers per plaats (laatste 30 minuten), en zet die in scherm_bezoekers.
// Alleen-lezen via de Google Analytics-connector. Geen IP, geen personen, geen tijdstippen per bezoeker.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { cronOfSupervisor, vandaagNL } from "../_shared/cronOfSupervisor.ts";
import { normaliseerGaRijen } from "../_shared/bezoekers.ts";

const GATEWAY = "https://connector-gateway.lovable.dev/google_analytics";
const PROPERTY = "301819431";

type GaRij = { dimensionValues?: { value?: string }[]; metricValues?: { value?: string }[] };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const auth = await cronOfSupervisor(req, admin);
  if (auth instanceof Response) return auth;

  const lovable = Deno.env.get("LOVABLE_API_KEY");
  const ga = Deno.env.get("GOOGLE_ANALYTICS_API_KEY");
  if (!lovable || !ga) return json({ status: "niet_gekoppeld" });

  const vraag = async (pad: string, body: unknown) => {
    const r = await fetch(`${GATEWAY}/v1beta/properties/${PROPERTY}:${pad}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${lovable}`, "X-Connection-Api-Key": ga },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`GA4 ${pad} [${r.status}]: ${(await r.text()).slice(0, 300)}`);
    return await r.json();
  };

  try {
    const dag = await vraag("runReport", {
      dateRanges: [{ startDate: "today", endDate: "today" }],
      dimensions: [{ name: "city" }, { name: "region" }, { name: "country" }],
      metrics: [{ name: "activeUsers" }],
      metricAggregations: ["TOTAL"],
      limit: 1000,
    });
    const nu = await vraag("runRealtimeReport", {
      dimensions: [{ name: "city" }, { name: "country" }],
      metrics: [{ name: "activeUsers" }],
      minuteRanges: [{ startMinutesAgo: 29, endMinutesAgo: 0 }],
      limit: 500,
    });
    const v = (r: GaRij, i: number) => r.dimensionValues?.[i]?.value ?? "";
    const m = (r: GaRij) => Number(r.metricValues?.[0]?.value ?? 0);
    const dagRijen = normaliseerGaRijen(((dag.rows ?? []) as GaRij[]).map((r) => ({ city: v(r, 0), region: v(r, 1), country: v(r, 2), aantal: m(r) })));
    const nuRijen = normaliseerGaRijen(((nu.rows ?? []) as GaRij[]).map((r) => ({ city: v(r, 0), country: v(r, 1), aantal: m(r) })));
    const totaal = Number(dag.totals?.[0]?.metricValues?.[0]?.value ?? dagRijen.reduce((s, p) => s + p.aantal, 0));
    const rijen = [
      ...dagRijen.slice(0, 300).map((p) => ({ soort: "dag", ...p })),
      ...nuRijen.slice(0, 150).map((p) => ({ soort: "nu", ...p })),
      { soort: "totaal", plaats: "totaal", provincie: "totaal", aantal: Number.isFinite(totaal) ? totaal : 0 },
    ];
    const { error } = await admin.rpc("scherm_bezoekers_vervangen", { _dag: vandaagNL(), _rijen: rijen });
    if (error) throw new Error(error.message);
    return json({ status: "ok", plaatsen: dagRijen.length, nu: nuRijen.length, totaal });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "onbekend";
    console.error("bezoekers-ga4", msg);
    return json({ status: "fout", fout: msg }, 502);
  }
});

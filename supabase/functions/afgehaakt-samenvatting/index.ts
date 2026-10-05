// Dagelijkse samenvatting (09:00 NL) van afgehaakte BAV-aanvragen naar de interne ontvangers.
// Alleen de cron (x-cron-secret, getoetst tegen Vault) mag deze functie draaien.
// Geen mail als er geen nieuwe afgehaakte aanvragen zijn; nooit mail naar de aanvrager zelf.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { verstuurInterneMelding } from "../_shared/interneMelding.ts";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function nlUur(d = new Date()): number {
  return Number(new Intl.DateTimeFormat("nl-NL", { timeZone: "Europe/Amsterdam", hour: "2-digit", hour12: false }).format(d));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  const secret = req.headers.get("x-cron-secret") ?? "";
  const { data: ok } = secret ? await admin.rpc("verify_cron_secret", { p_secret: secret }) : { data: false };
  if (ok !== true) return json({ error: "unauthorized" }, 401);

  const body = await req.json().catch(() => ({}));
  // De cron draait om 07:00 en 08:00 UTC; alleen de run die om 09:00 NL valt verstuurt (zomer- en wintertijd).
  if (body?.force !== true && nlUur() !== 9) return json({ skipped: "niet 09:00 NL" });

  const nu = Date.now();
  const { count, error } = await admin.from("aanvraag_concepten")
    .select("id", { count: "exact", head: true })
    .eq("status", "open").eq("is_test", false).is("geanonimiseerd_op", null)
    .gte("created_at", new Date(nu - 24 * 3600_000).toISOString())
    .lt("laatst_actief_op", new Date(nu - 30 * 60_000).toISOString());
  if (error) return json({ error: error.message }, 500);
  const n = count ?? 0;
  if (n < 1) return json({ sent: false, aantal: 0 });

  const link = "https://zpzaken.nl/admin/afgehaakt";
  const tekst = n === 1 ? "1 nieuwe afgehaakte aanvraag" : `${n} nieuwe afgehaakte aanvragen`;
  const res = await verstuurInterneMelding(admin, req, "afgehaakt-samenvatting", {
    leadType: "afgehaakt-samenvatting",
    subject: `Afgehaakte aanvragen: ${tekst} (afgelopen 24 uur)`,
    html: `<p>In de afgelopen 24 uur ${n === 1 ? "is" : "zijn"} er <strong>${tekst}</strong> op de website.</p><p><a href="${link}">Bekijk het overzicht</a></p>`,
    text: `In de afgelopen 24 uur: ${tekst}. Overzicht: ${link}`,
    metadata: { aantal: n },
  });
  return json({ sent: true, aantal: n, res });
});

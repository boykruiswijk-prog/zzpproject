// Dagelijkse samenvatting (09:00 NL) van afgehaakte BAV-aanvragen naar de interne ontvangers.
// Alleen de cron (x-cron-secret, getoetst tegen Vault) mag deze functie draaien.
// Geen mail als er geen nieuwe afgehaakte aanvragen zijn; nooit mail naar de aanvrager zelf.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { verstuurInterneMelding } from "../_shared/interneMelding.ts";
import { bouwAfgehaaktSamenvatting, type SamenvattingConcept } from "../_shared/nabellen.ts";

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
  const { data, error } = await admin.from("aanvraag_concepten")
    .select("id,status,is_test,lead_id,dubbel_lead_id,telefoon,email,laatst_actief_op,team_gemeld_op,voornaam,achternaam,bedrijfsnaam,pakket,stap,max_stap,attributie,herinnering_verstuurd_op,spam_signaal,afhaak_geen_herinnering_reden")
    .eq("status", "open").is("geanonimiseerd_op", null)
    .gte("created_at", new Date(nu - 24 * 3600_000).toISOString())
    .lt("laatst_actief_op", new Date(nu - 30 * 60_000).toISOString())
    .limit(500);
  if (error) return json({ error: error.message }, 500);
  const mail = bouwAfgehaaktSamenvatting((data ?? []) as SamenvattingConcept[]);
  // Besluit Boy 3-11: bij 0 echte afhakers geen mail; testinvoer telt niet mee.
  if (!mail) return json({ sent: false, aantal: 0, testinvoer: (data ?? []).length });

  const res = await verstuurInterneMelding(admin, req, "afgehaakt-samenvatting", {
    leadType: "afgehaakt-samenvatting",
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    metadata: { aantal: mail.aantal, testinvoer: mail.aantalTest },
  });
  return json({ sent: true, aantal: mail.aantal, testinvoer: mail.aantalTest, res });
});

// Elke 10 minuten (cron, x-cron-secret uit Vault): één interne mail per niet-afgeronde aanvraag
// die 30 minuten stil staat (alleen afgelopen 24 uur, geen oude achterstand). Nooit een mail naar de bezoeker. Claim via team_gemeld_op voorkomt dubbel mailen.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { verstuurInterneMelding } from "../_shared/interneMelding.ts";
import { bouwNabelMail, moetNabellen, NABEL_WACHT_MINUTEN, type NabelConcept } from "../_shared/nabellen.ts";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  const secret = req.headers.get("x-cron-secret") ?? "";
  const { data: ok } = secret ? await admin.rpc("verify_cron_secret", { p_secret: secret }) : { data: false };
  if (ok !== true) return json({ error: "unauthorized" }, 401);

  const nu = new Date();
  const grens = new Date(nu.getTime() - NABEL_WACHT_MINUTEN * 60_000).toISOString();
  const { data, error } = await admin.from("aanvraag_concepten")
    .select("id,status,is_test,lead_id,dubbel_lead_id,telefoon,email,laatst_actief_op,team_gemeld_op,geanonimiseerd_op,voornaam,achternaam,bedrijfsnaam,pakket,stap,max_stap,attributie")
    .eq("status", "open").eq("is_test", false).is("lead_id", null).is("dubbel_lead_id", null)
    .is("team_gemeld_op", null).is("geanonimiseerd_op", null)
    .or("telefoon.not.is.null,email.not.is.null")
    .lt("laatst_actief_op", grens).gte("laatst_actief_op", new Date(nu.getTime() - 24 * 3600_000).toISOString()).order("laatst_actief_op").limit(25);
  if (error) return json({ error: error.message }, 500);

  const resultaten: { id: string; geslaagd: boolean }[] = [];
  for (const c of (data ?? []) as NabelConcept[]) {
    if (!moetNabellen(c, nu)) continue;
    const { data: claim } = await admin.from("aanvraag_concepten")
      .update({ team_gemeld_op: new Date().toISOString() }).eq("id", c.id).is("team_gemeld_op", null).select("id");
    if (!claim?.length) continue;
    const mail = bouwNabelMail(c);
    const res = await verstuurInterneMelding(admin, req, "aanvraag-nabellen", {
      leadType: "aanvraag-nabellen", subject: mail.subject, html: mail.html, text: mail.text,
      metadata: { concept_id: c.id },
    });
    const geslaagd = res.length > 0 && res.every((x: { ok: boolean }) => x.ok);
    if (!geslaagd) await admin.from("aanvraag_concepten").update({ team_gemeld_op: null }).eq("id", c.id);
    resultaten.push({ id: c.id, geslaagd });
  }
  return json({ ok: true, verwerkt: resultaten.length, resultaten });
});

// Royementsbevestiging (besluit Boy 15-10-2026). Alleen supervisor/admin met 2FA, alleen na bevestig_royement
// (status geroyeerd). Nooit automatisch en nooit vanuit cron: deze functie kent geen cron-toegang.
// Maximaal een mail per incasso via royement_mail_claim. Mail via de klantmail-schakelaar. Niets in Exact.
// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2.108.2";
import { corsHeaders } from "npm:@supabase/supabase-js@2.108.2/cors";
import { isInternalMachine, requireSupervisor } from "../_shared/teamAuth.ts";
import { klantOntvanger, verstuurKlantmail } from "../_shared/klantmailSchakelaar.ts";
import { datumNL, euro } from "../_shared/klantmailTekst.ts";

const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  const auth = isInternalMachine(req) ? { userId: null } : await requireSupervisor(req, admin);
  if (auth instanceof Response) return json(await auth.json(), auth.status);

  const body = await req.json().catch(() => ({}));
  if (body.dry_run !== undefined && typeof body.dry_run !== "boolean") return json({ error: "dry_run moet boolean zijn" }, 400);
  const id = typeof body?.incasso_id === "string" ? body.incasso_id : "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "incasso_id ontbreekt" }, 400);

  const { data: i } = await admin.from("incasso_mislukt").select("id,onderneming_id,lead_id,bedrag,status,geroyeerd_op,is_test").eq("id", id).maybeSingle();
  if (!i) return json({ error: "niet gevonden" }, 404);
  if (i.status !== "geroyeerd" || !i.geroyeerd_op) return json({ error: "royement is niet bevestigd" }, 409);

  if (body.dry_run === true) {
    const { data: existing } = await admin.from("royement_mail_claim").select("incasso_id").eq("incasso_id", id).maybeSingle();
    if (existing) return json({ dry_run: true, mail: "al_verwerkt", would_send: false });
    if (i.is_test) return json({ dry_run: true, mail: "niet_verzonden_test", would_send: false });
    const ont = await klantOntvanger(admin, i.onderneming_id, i.lead_id);
    const status = await verstuurKlantmail(admin, req, "royement-bevestiging-mail", "royement_bevestiging", ont.email, {
      voornaam: ont.voornaam, royement_datum: datumNL(i.geroyeerd_op), bedrag: euro(i.bedrag),
    }, {}, { dryRun: true });
    return json({ dry_run: true, mail: status, would_send: status === "zou_verzenden" });
  }

  const { data: claim } = await admin.from("royement_mail_claim")
    .upsert({ incasso_id: id, geclaimd_door: auth.userId }, { onConflict: "incasso_id", ignoreDuplicates: true }).select("incasso_id");
  if (!claim?.length) return json({ mail: "al_verwerkt" });

  let status = "niet_verzonden_test";
  if (!i.is_test) {
    const ont = await klantOntvanger(admin, i.onderneming_id, i.lead_id);
    status = await verstuurKlantmail(admin, req, "royement-bevestiging-mail", "royement_bevestiging", ont.email, {
      voornaam: ont.voornaam, royement_datum: datumNL(i.geroyeerd_op), bedrag: euro(i.bedrag),
    }, { onderneming_id: i.onderneming_id, lead_id: i.lead_id, incasso_id: id });
  }
  await admin.from("royement_mail_claim").update({ mail_status: status }).eq("incasso_id", id);
  return json({ mail: status });
});

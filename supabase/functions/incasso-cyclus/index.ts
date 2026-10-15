// D9 herinneringscyclus mislukte incasso (besluit Boy 15-10-2026). Dagelijks 08:30 NL via cron (Vault-secret).
// Idempotent: incasso_cyclus_stap logt elke stap een keer per incasso. Mails alleen via de klantmail-schakelaar
// (staat uit tot akkoord Boy). Nooit automatisch royeren, geen contract beeindigen, niets in Exact.
// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { cronOfSupervisor, uurNL, vandaagNL } from "../_shared/cronOfSupervisor.ts";
import { klantOntvanger, polisnummerVoor, verstuurKlantmail } from "../_shared/klantmailSchakelaar.ts";
import { COMPANY } from "../_shared/company.ts";
import { STAP_MAIL, uitersteDatum, type IncassoStap } from "../_shared/incassoCyclus.ts";
import { datumNL, euro } from "../_shared/klantmailTekst.ts";

const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const toegang = await cronOfSupervisor(req, admin);
  if (toegang instanceof Response) return json({ error: "geen_toegang" }, toegang.status);
  // Cron draait om 06:30 en 07:30 UTC; alleen het moment dat 08:30 NL is telt (zomer- en wintertijd).
  if (toegang.cron && uurNL() !== 8) return json({ overgeslagen: "niet 08:30 NL" });

  const vandaag = vandaagNL();
  const { data: stappen, error } = await admin.rpc("incasso_cyclus_stap", { _vandaag: vandaag });
  if (error) return json({ error: error.message }, 500);

  const resultaat: any[] = [];
  for (const s of (stappen ?? []) as any[]) {
    const sleutel = STAP_MAIL[s.stap as IncassoStap];
    if (!sleutel) { resultaat.push({ incasso_id: s.incasso_id, stap: s.stap, mail: "geen_mail" }); continue; }
    let mailStatus = "niet_verzonden_test";
    if (!s.is_test) {
      const ont = await klantOntvanger(admin, s.onderneming_id, s.lead_id);
      const { data: o } = await admin.from("ondernemingen").select("naam").eq("id", s.onderneming_id).maybeSingle();
      const polisnummer = await polisnummerVoor(admin, s.onderneming_id);
      mailStatus = await verstuurKlantmail(admin, req, "incasso-cyclus", sleutel, ont.email, {
        voornaam: ont.voornaam, bedrijfsnaam: o?.naam, bedrag: euro(s.bedrag), polisnummer,
        factuurnummer: s.factuurnummer, incasso_datum: datumNL(s.mislukt_op),
        uiterste_datum: datumNL(uitersteDatum(s.mislukt_op, s.stap as IncassoStap)),
        opschort_datum: datumNL(s.opschort_datum), iban: COMPANY.registrations.iban,
      }, { onderneming_id: s.onderneming_id, lead_id: s.lead_id, incasso_id: s.incasso_id });
    }
    await admin.from("incasso_cyclus_log").update({ mail_status: mailStatus }).eq("id", s.log_id);
    resultaat.push({ incasso_id: s.incasso_id, stap: s.stap, mail: mailStatus });
  }
  return json({ vandaag, stappen: resultaat });
});

// D8 prolongatie jaarpolis (besluit Boy 15-10-2026). Dagelijks 08:40 NL via cron (Vault-secret).
// Een mail per klant per verlengdatum (prolongatie_log uniek op onderneming en verlengdatum), alleen als de klant een
// bav_avb-jaarcontract heeft dat over 14 dagen verlengt. Bedrag = som bav_avb + cyber_clear (netto, zoals de planner).
// Lidmaatschappen of alleen cyber: geen mail. Mail via de schakelaar. Niets in Exact.
// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { cronOfSupervisor, uurNL, vandaagNL } from "../_shared/cronOfSupervisor.ts";
import { klantOntvanger, polisnummerVoor, verstuurKlantmail } from "../_shared/klantmailSchakelaar.ts";
import { PROLONGATIE_DAGEN_VOORAF, plusDagenISO } from "../_shared/prolongatie.ts";
import { datumNL, euro, prolongatieProduct } from "../_shared/klantmailTekst.ts";

const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const toegang = await cronOfSupervisor(req, admin);
  if (toegang instanceof Response) return json({ error: "geen_toegang" }, toegang.status);
  if (toegang.cron && uurNL() !== 8) return json({ overgeslagen: "niet 08:40 NL" });

  const vandaag = vandaagNL();
  const doel = plusDagenISO(vandaag, PROLONGATIE_DAGEN_VOORAF);
  const { data: kand, error } = await admin.rpc("prolongatie_mails", { _van: doel, _tot: doel });
  if (error) return json({ error: error.message }, 500);

  const resultaat: any[] = [];
  for (const k of (kand ?? []) as any[]) {
    if (!k.mail || !k.klant_contract_id) { resultaat.push({ onderneming_id: k.onderneming_id, mail: "geen_prolongatiemail_geen_bav" }); continue; }
    const { data: claim } = await admin.from("prolongatie_log")
      .upsert({ klant_contract_id: k.klant_contract_id, onderneming_id: k.onderneming_id, verlengdatum: k.verlengdatum },
        { onConflict: "onderneming_id,verlengdatum", ignoreDuplicates: true }).select("id");
    if (!claim?.length) continue; // al verwerkt
    const ont = await klantOntvanger(admin, k.onderneming_id, null);
    const polisnummer = await polisnummerVoor(admin, k.onderneming_id);
    const status = await verstuurKlantmail(admin, req, "prolongatie-jaarpolis", "prolongatie_jaarpolis", ont.email, {
      voornaam: ont.voornaam, bedrijfsnaam: k.klantnaam, polisnummer, product: prolongatieProduct(k.producten ?? []),
      verlengdatum: datumNL(k.verlengdatum), bedrag: euro(k.bedrag),
    }, { onderneming_id: k.onderneming_id, klant_contract_id: k.klant_contract_id });
    await admin.from("prolongatie_log").update({ mail_status: status, ontvanger: ont.email }).eq("id", claim[0].id);
    resultaat.push({ onderneming_id: k.onderneming_id, verlengdatum: k.verlengdatum, mail: status });
  }
  return json({ vandaag, verlengdatum: doel, aantal: resultaat.length, resultaat });
});

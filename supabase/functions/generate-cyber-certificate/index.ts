// Apart cybercertificaat (E5/E5a). Alleen supervisor/admin met MFA; maakt een PDF in opslag en
// geeft een tijdelijke link terug. Verstuurt niets en wijzigt geen polis-, contract- of factuurgegevens.
import { createClient } from "npm:@supabase/supabase-js@2.108.2";
import { corsHeaders } from "npm:@supabase/supabase-js@2.108.2/cors";
import { requireSupervisor } from "../_shared/teamAuth.ts";
import { tekenCyberCertificaat } from "../_shared/cyberCertificaatPdf.ts";
import { CYBER_JAARMAXIMUM } from "../_shared/cyberCertificaatTeksten.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!/^Bearer\s+/i.test(req.headers.get("Authorization") ?? "")) return json({ error: "Unauthorized" }, 401);
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const auth = await requireSupervisor(req, admin);
    if (auth instanceof Response) return new Response(auth.body, { status: auth.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!CYBER_JAARMAXIMUM.trim()) return json({ error: "Cybercertificaat nog niet beschikbaar: jaarbedrag wordt vastgesteld door Boy", code: "jaarmaximum_ontbreekt" }, 409);
    const body = await req.json().catch(() => ({}));
    const policyId = typeof body?.policy_id === "string" && /^[0-9a-f-]{36}$/i.test(body.policy_id) ? body.policy_id : null;
    if (!policyId) return json({ error: "policy_id ontbreekt of is ongeldig" }, 400);

    const { data: policy } = await admin.from("policies")
      .select("id,certificate_number,certificate_holder,insured_name,status,lead_id,onderneming_id").eq("id", policyId).maybeSingle();
    if (!policy) return json({ error: "Certificaat niet gevonden" }, 404);
    if (policy.status !== "geldig") return json({ error: "Alleen bij een geldig BAV + AVB-certificaat" }, 409);

    // Cyberdatums: later toegevoegde cyber (actief contract) gaat voor, anders cyber bij de aanvraag.
    let ingang: string | null = null, eind: string | null = null, kvk: string | null = null;
    const { data: verzoek } = await admin.from("cyber_toevoeg_verzoeken").select("contract_id")
      .eq("policy_id", policy.id).not("geactiveerd_op", "is", null).order("geactiveerd_op", { ascending: false }).limit(1).maybeSingle();
    if (verzoek?.contract_id) {
      const { data: c } = await admin.from("klant_contracten").select("cyber_ingangsdatum,cyber_einddatum,begin_datum").eq("id", verzoek.contract_id).maybeSingle();
      ingang = c?.cyber_ingangsdatum ?? c?.begin_datum ?? null; eind = c?.cyber_einddatum ?? null;
    }
    if (policy.lead_id) {
      const { data: lead } = await admin.from("leads").select("kvk_nummer,cyber_ingangsdatum,cyber_einddatum,cyber_voorwaarden_versie").eq("id", policy.lead_id).maybeSingle();
      kvk = lead?.kvk_nummer ?? null;
      if (!ingang && lead?.cyber_voorwaarden_versie && lead?.cyber_ingangsdatum) { ingang = lead.cyber_ingangsdatum; eind = lead.cyber_einddatum ?? null; }
    }
    if (!kvk && policy.onderneming_id) {
      const { data: o } = await admin.from("ondernemingen").select("kvk").eq("id", policy.onderneming_id).maybeSingle();
      kvk = o?.kvk ?? null;
    }
    if (!ingang) return json({ error: "Geen actieve cyber gevonden bij dit certificaat" }, 409);

    const { data: profiel } = await admin.from("profiles").select("full_name").eq("id", auth.userId).maybeSingle();
    const { data: tpl, error: tplErr } = await admin.storage.from("certificates").download("templates/certificate-template.png");
    if (tplErr || !tpl) return json({ error: "Sjabloon niet beschikbaar" }, 500);
    const { pdfBytes } = await tekenCyberCertificaat(new Uint8Array(await tpl.arrayBuffer()), {
      certificaathouder: policy.certificate_holder, kvk, verzekeringsnemer: policy.insured_name,
      bav_certificaatnummer: policy.certificate_number, cyber_ingangsdatum: ingang, cyber_einddatum: eind,
      jaarmaximum: CYBER_JAARMAXIMUM, afgiftedatum: new Date().toISOString().slice(0, 10), voor_gezien: profiel?.full_name ?? "ZP Zaken",
    });
    // Nooit overschrijven: elke afgifte een eigen bestand.
    const pad = `cyber/${policy.certificate_number}-cyber-${Date.now()}.pdf`;
    const { error: upErr } = await admin.storage.from("certificates").upload(pad, new Blob([pdfBytes as BlobPart], { type: "application/pdf" }), { contentType: "application/pdf", upsert: false });
    if (upErr) return json({ error: "Opslaan mislukt" }, 500);
    const { data: url } = await admin.storage.from("certificates").createSignedUrl(pad, 3600);
    return json({ success: true, pad, url: url?.signedUrl ?? null });
  } catch (e) {
    console.error("generate-cyber-certificate", e);
    return json({ error: "Onverwachte fout" }, 500);
  }
});

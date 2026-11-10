// Apart cybercertificaat (E5/E5a). Alleen supervisor/admin met MFA; maakt een PDF in opslag en
// geeft een tijdelijke link terug. Verstuurt niets en wijzigt geen polis-, contract- of factuurgegevens.
import { createClient } from "npm:@supabase/supabase-js@2.108.2";
import { corsHeaders } from "npm:@supabase/supabase-js@2.108.2/cors";
import { requireVerzekeringOfSupervisor } from "../_shared/teamAuth.ts";
import { tekenCyberCertificaat } from "../_shared/cyberCertificaatPdf.ts";
import { CERTIFICAAT_VOOR_GEZIEN } from "../_shared/certificaatRegels.ts";
import { CYBER_JAARMAXIMUM, CYBERCERTIFICAAT_LIVE } from "../_shared/cyberCertificaatTeksten.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!/^Bearer\s+/i.test(req.headers.get("Authorization") ?? "")) return json({ error: "Unauthorized" }, 401);
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const auth = await requireVerzekeringOfSupervisor(req, admin);
    if (auth instanceof Response) return new Response(auth.body, { status: auth.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!CYBER_JAARMAXIMUM.trim()) return json({ error: "Cybercertificaat nog niet beschikbaar: jaarbedrag wordt vastgesteld door Boy", code: "jaarmaximum_ontbreekt" }, 409);
    if (!CYBERCERTIFICAAT_LIVE) return json({ error: "Cybercertificaat wacht op laatste goedkeuring", code: "cybercertificaat_niet_live" }, 409);
    const body = await req.json().catch(() => ({}));
    const uuid = (v: unknown) => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v) ? v : null;
    // Alleen cyber (besluit Boy 9-11-2026): eigen ZPCYB-nummer, geen BAV-polis nodig. Verstuurt niets.
    const alleenCyberId = body?.dekking === "cyber" ? uuid(body.onderneming_id) : null;
    if (alleenCyberId) {
      const { data: d } = await admin.rpc("klant_dekking_actief", { _onderneming_id: alleenCyberId });
      if (!d?.cyber) return json({ error: "Geen actief cybercontract" }, 409);
      if (!d?.cyber_nummer) return json({ error: "Ken eerst een cybernummer toe", code: "geen_cybernummer" }, 409);
      const { data: o } = await admin.from("ondernemingen").select("naam,kvk").eq("id", alleenCyberId).maybeSingle();
      const { data: c } = await admin.from("klant_contracten").select("cyber_ingangsdatum,cyber_einddatum,begin_datum,cyclus")
        .eq("onderneming_id", alleenCyberId).eq("product", "cyber_clear").in("status", ["actief", "loopt_af"]).order("begin_datum", { ascending: false }).limit(1).maybeSingle();
      const ingangC = c?.cyber_ingangsdatum ?? c?.begin_datum ?? null;
      if (!o?.naam || !ingangC) return json({ error: "Naam of cyberingangsdatum ontbreekt" }, 409);
      const { data: tplC } = await admin.storage.from("certificates").download("templates/certificate-template.png");
      if (!tplC) return json({ error: "Sjabloon niet beschikbaar" }, 500);
      const { pdfBytes } = await tekenCyberCertificaat(new Uint8Array(await tplC.arrayBuffer()), {
        certificaathouder: o.naam, kvk: o.kvk ?? null, verzekeringsnemer: o.naam, bav_certificaatnummer: "",
        cyber_certificaatnummer: d.cyber_nummer, cyber_ingangsdatum: ingangC, cyber_einddatum: c?.cyber_einddatum ?? null,
        betaalcyclus: c?.cyclus === "jaar" ? "jaar" : "maand",
        jaarmaximum: CYBER_JAARMAXIMUM, afgiftedatum: new Date().toISOString().slice(0, 10), voor_gezien: CERTIFICAAT_VOOR_GEZIEN,
      });
      const padC = `cyber/${d.cyber_nummer}-${Date.now()}.pdf`;
      const { error: upC } = await admin.storage.from("certificates").upload(padC, new Blob([pdfBytes as BlobPart], { type: "application/pdf" }), { contentType: "application/pdf", upsert: false });
      if (upC) return json({ error: "Opslaan mislukt" }, 500);
      await admin.rpc("cyber_pdf_vastleggen", { _onderneming_id: alleenCyberId, _pad: padC });
      return json({ success: true, pad: padC, nummer: d.cyber_nummer });
    }
    const policyId = uuid(body?.policy_id);
    if (!policyId) return json({ error: "policy_id ontbreekt of is ongeldig" }, 400);

    const { data: policy } = await admin.from("policies")
      .select("id,certificate_number,certificate_holder,insured_name,status,lead_id,onderneming_id").eq("id", policyId).maybeSingle();
    if (!policy) return json({ error: "Certificaat niet gevonden" }, 404);
    if (policy.status !== "geldig") return json({ error: "Alleen bij een geldig BAV + AVB-certificaat" }, 409);

    const verzoekId = typeof body.cyber_verzoek_id === "string" && /^[0-9a-f-]{36}$/i.test(body.cyber_verzoek_id) ? body.cyber_verzoek_id : null;
    let lease: string | null = null;
    let vorigePad: string | null = null;
    if (verzoekId) {
      const { data: r } = await admin.from("cyber_toevoeg_verzoeken").select("*").eq("id", verzoekId).eq("policy_id", policy.id).maybeSingle();
      if (!r?.geactiveerd_op || !r.contract_id) return json({ error: "Activeer eerst cyber" }, 409);
      if (r.is_test) return json({ error: "Testpolis: alleen lokaal certificaat renderen" }, 409);
      if (r.certificaat_pad && body.opnieuw === true) {
        if (r.certificaat_gecontroleerd_op || r.certificaat_mail_status !== "wacht" || r.mail_status !== "wacht") return json({ error: "Alleen een ongecontroleerd en onverstuurd certificaat kan opnieuw gemaakt worden" }, 409);
        vorigePad = r.certificaat_pad;
        lease = crypto.randomUUID();
      } else if (r.certificaat_pad) {
        const { data: link } = await admin.storage.from("certificates").createSignedUrl(r.certificaat_pad, 3600);
        return json({ success: true, pad: r.certificaat_pad, url: link?.signedUrl });
      }
      if (!vorigePad) {
        lease = crypto.randomUUID();
        const claim = await admin.rpc("cyber_toevoegen_document_claim", { _id: verzoekId, _lease: lease });
        if (claim.error || !claim.data) return json({ error: "Certificaat wordt al verwerkt" }, 409);
      }
    }
    // Cyberdatums: later toegevoegde cyber (actief contract) gaat voor, anders cyber bij de aanvraag.
    let ingang: string | null = null, eind: string | null = null, kvk: string | null = null;
    let betaalcyclus: "maand" | "jaar" = "maand";
    const { data: verzoek } = await admin.from("cyber_toevoeg_verzoeken").select("contract_id")
      .eq("policy_id", policy.id).not("geactiveerd_op", "is", null).order("geactiveerd_op", { ascending: false }).limit(1).maybeSingle();
    if (verzoek?.contract_id) {
      const { data: c } = await admin.from("klant_contracten").select("cyber_ingangsdatum,cyber_einddatum,begin_datum,cyclus").eq("id", verzoek.contract_id).maybeSingle();
      ingang = c?.cyber_ingangsdatum ?? c?.begin_datum ?? null; eind = c?.cyber_einddatum ?? null;
      betaalcyclus = c?.cyclus === "jaar" ? "jaar" : "maand";
    }
    if (policy.lead_id) {
      const { data: lead } = await admin.from("leads").select("kvk_nummer,cyber_ingangsdatum,cyber_einddatum,cyber_voorwaarden_versie,gekozen_pakket").eq("id", policy.lead_id).maybeSingle();
      kvk = lead?.kvk_nummer ?? null;
      if (!ingang && lead?.cyber_voorwaarden_versie && lead?.cyber_ingangsdatum) { ingang = lead.cyber_ingangsdatum; eind = lead.cyber_einddatum ?? null; betaalcyclus = lead.gekozen_pakket?.startsWith("jaarlijks") ? "jaar" : "maand"; }
    }
    if (!kvk && policy.onderneming_id) {
      const { data: o } = await admin.from("ondernemingen").select("kvk").eq("id", policy.onderneming_id).maybeSingle();
      kvk = o?.kvk ?? null;
    }
    if (!ingang) return json({ error: "Geen actieve cyber gevonden bij dit certificaat" }, 409);

    const { data: tpl, error: tplErr } = await admin.storage.from("certificates").download("templates/certificate-template.png");
    if (tplErr || !tpl) return json({ error: "Sjabloon niet beschikbaar" }, 500);
    const { pdfBytes } = await tekenCyberCertificaat(new Uint8Array(await tpl.arrayBuffer()), {
      certificaathouder: policy.certificate_holder, kvk, verzekeringsnemer: policy.insured_name,
      bav_certificaatnummer: policy.certificate_number, cyber_ingangsdatum: ingang, cyber_einddatum: eind,
      betaalcyclus,
      jaarmaximum: CYBER_JAARMAXIMUM, afgiftedatum: new Date().toISOString().slice(0, 10), voor_gezien: CERTIFICAAT_VOOR_GEZIEN,
    });
    // Nooit overschrijven: elke afgifte een eigen bestand.
    const pad = verzoekId && lease ? `cyber-toevoegen/${verzoekId}-${lease}.pdf` : `cyber/${policy.certificate_number}-cyber-${Date.now()}.pdf`;
    const { error: upErr } = await admin.storage.from("certificates").upload(pad, new Blob([pdfBytes as BlobPart], { type: "application/pdf" }), { contentType: "application/pdf", upsert: false });
    if (upErr) return json({ error: "Opslaan mislukt" }, 500);
    if (verzoekId && lease && vorigePad) {
      // Compare-and-swap: keep the original PDF, no workflow/mail/activation status changes.
      const hermaak = await admin.from("cyber_toevoeg_verzoeken").update({ certificaat_pad: pad })
        .eq("id", verzoekId).eq("certificaat_pad", vorigePad).is("certificaat_gecontroleerd_op", null)
        .eq("certificaat_mail_status", "wacht").eq("mail_status", "wacht").select("id").maybeSingle();
      if (hermaak.error || !hermaak.data) return json({ error: "Certificaat is intussen gecontroleerd of gewijzigd; de hermaak is niet gekoppeld" }, 409);
    } else if (verzoekId && lease) {
      const klaar = await admin.rpc("cyber_aanvraag_document_klaar", { _id: verzoekId, _lease: lease, _pad: pad });
      if (klaar.error || !klaar.data) return json({ error: "Documentclaim kon niet worden bevestigd" }, 409);
    }
    const { data: url } = await admin.storage.from("certificates").createSignedUrl(pad, 3600);
    return json({ success: true, pad, url: url?.signedUrl ?? null });
  } catch (e) {
    console.error("generate-cyber-certificate", e);
    return json({ error: "Onverwachte fout" }, 500);
  }
});

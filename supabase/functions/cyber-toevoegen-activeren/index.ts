import { createClient } from "npm:@supabase/supabase-js@2.108.2";
import { corsHeaders } from "npm:@supabase/supabase-js@2.108.2/cors";
import { requireVerzekeringOfSupervisor } from "../_shared/teamAuth.ts";
import { klantOntvanger, verstuurKlantmail } from "../_shared/klantmailSchakelaar.ts";
import { cyberToevoegMailData, cyberToevoegSpec } from "../_shared/cyberToevoegenActivatie.ts";

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST vereist" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anon = Deno.env.get("SUPABASE_ANON_KEY");
    if (!url || !key || !anon) return json({ error: "Configuratie ontbreekt" }, 500);
    const admin = createClient(url, key);
    const auth = await requireVerzekeringOfSupervisor(req, admin);
    if (auth instanceof Response) return json(await auth.json(), auth.status);
    const body = await req.json();
    if (typeof body.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(body.id) || typeof body.akkoord !== "boolean" || typeof body.notitie !== "string" || body.notitie.trim().length < 10 || body.notitie.length > 1000 || (body.dryRun !== undefined && typeof body.dryRun !== "boolean") || (body.retryMail !== undefined && typeof body.retryMail !== "boolean")) return json({ error: "Ongeldige beoordeling" }, 400);
    const { data: verzoek, error: leesFout } = await admin.from("cyber_toevoeg_verzoeken").select("*").eq("id", body.id).maybeSingle();
    if (leesFout || !verzoek) return json({ error: "Verzoek niet gevonden" }, 404);
    if (body.dryRun && !verzoek.is_test) return json({ error: "Droge run alleen voor gemarkeerde testaanvraag" }, 403);
    if (body.dryRun) {
      if (!body.akkoord) return json({ success: true, test: true, status: "zou_afwijzen", exact_writes: 0, mails_verstuurd: 0 });
      const { data: basis } = await admin.from("klant_contracten").select("cyclus").eq("onderneming_id", verzoek.onderneming_id).eq("product", "bav_avb").in("status", ["actief", "loopt_af"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
      const { data: lead } = await admin.from("leads").select("gekozen_pakket").eq("id", verzoek.lead_id).maybeSingle();
      const cyclus = basis?.cyclus ?? (lead?.gekozen_pakket === "jaarlijks" ? "jaar" : lead?.gekozen_pakket === "maandelijks" ? "maand" : null);
      if (cyclus !== "jaar" && cyclus !== "maand") return json({ error: "Betaalwijze BAV ontbreekt" }, 409);
      const ontvanger = await klantOntvanger(admin, verzoek.onderneming_id, verzoek.lead_id);
      const mail = await verstuurKlantmail(admin, req, "cyber-toevoegen-activeren", "cyber_toegevoegd", ontvanger.email, cyberToevoegMailData(ontvanger.voornaam, verzoek.gewenste_ingangsdatum, cyclus), {}, { dryRun: true });
      return json({ success: true, test: true, status: "zou_activeren", planning: cyberToevoegSpec(verzoek.gewenste_ingangsdatum, cyclus), mail, exact_writes: 0, mails_verstuurd: 0, mutations: 0 });
    }
    const user = createClient(url, anon, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
    // One transaction owns approval, contract and billing anchor; never call lead activation or Exact here.
    const { data: status, error } = await user.rpc("cyber_toevoegen_beoordelen", { _id: body.id, _akkoord: body.akkoord, _notitie: body.notitie });
    if (error) return json({ error: error.message }, 409);
    if (!body.akkoord) return json({ success: true, status, mail: "niet_verzonden_afwijzing" });
    if (status !== "actief") return json({ success: true, status, mail: "niet_verzonden_release_wacht" });
    const { data: actief } = await admin.from("cyber_toevoeg_verzoeken").select("*").eq("id", body.id).single();
    const { data: contract } = await admin.from("klant_contracten").select("*").eq("id", actief.contract_id).single();
    if (!contract) return json({ error: "Cybercontract ontbreekt" }, 500);
    const ontvanger = await klantOntvanger(admin, actief.onderneming_id, actief.lead_id);
    const mailData = cyberToevoegMailData(ontvanger.voornaam, actief.gewenste_ingangsdatum, contract.cyclus);
    // Test mode is mandatory for test records, irrespective of client input. No document/mail/Exact effects.
    if (actief.is_test) {
      const mail = await verstuurKlantmail(admin, req, "cyber-toevoegen-activeren", "cyber_toegevoegd", ontvanger.email, mailData, {}, { dryRun: true });
      return json({ success: true, status: "actief", test: true, exact_writes: 0, mails_verstuurd: 0, contract_id: contract.id, planning: cyberToevoegSpec(actief.gewenste_ingangsdatum, contract.cyclus), mail });
    }
    if (!actief.certificaat_pad) {
      const headers: Record<string, string> = { Authorization: req.headers.get("Authorization") ?? "", "Content-Type": "application/json" };
      const origin = req.headers.get("Origin");
      if (origin) headers.Origin = origin;
      const response = await fetch(`${url}/functions/v1/generate-certificate`, { method: "POST", headers, body: JSON.stringify({ actie: "cyber_toevoegen", policy_id: actief.policy_id, cyber_verzoek_id: actief.id }) });
      const result = await response.json();
      if (!response.ok) return json({ error: "Cyber is toegevoegd; het certificaat vraagt aandacht. Probeer opnieuw.", details: result.error, actief: true }, 409);
    }
    // Same attachment shape and sender/gate as the existing certificate mail, in one confirmation.
    const { data: document } = await admin.from("cyber_toevoeg_verzoeken").select("certificaat_pad").eq("id", actief.id).single();
    if (!document?.certificaat_pad) return json({ error: "Certificaat ontbreekt; geen mail verstuurd", actief: true }, 409);
    const { data: file, error: fileError } = await admin.storage.from("certificates").download(document.certificaat_pad);
    if (fileError || !file) return json({ error: "Certificaat kon niet worden gelezen; geen mail verstuurd", actief: true }, 409);
    const bytes = new Uint8Array(await file.arrayBuffer());
    let raw = "";
    for (let i = 0; i < bytes.length; i += 0x8000) raw += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    const { data: claim, error: claimError } = await admin.rpc("cyber_toevoegen_mail_claim", { _id: actief.id, _retry: body.retryMail === true });
    if (claimError) return json({ error: claimError.message, actief: true }, 500);
    let mail = actief.mail_status;
    if (claim) {
      try {
        mail = await verstuurKlantmail(admin, req, "cyber-toevoegen-activeren", "cyber_toegevoegd", ontvanger.email, mailData, { lead_id: actief.lead_id, onderneming_id: actief.onderneming_id, details: { verzoek_id: actief.id, poging: claim } }, { idempotencyKey: `cyber-toegevoegd-${actief.id}-${claim}`, classifyDelivery: true, attachments: [{ filename: "Cyber-certificaat.pdf", content: btoa(raw) }] });
        if (mail === "mislukt") mail = "mail_mislukt";
        await admin.from("cyber_toevoeg_verzoeken").update({ mail_status: mail }).eq("id", actief.id);
      } catch {
        // Ambiguous provider delivery: keep the durable claim; never retry automatically.
        mail = "mail_onzeker";
        await admin.from("cyber_toevoeg_verzoeken").update({ mail_status: mail }).eq("id", actief.id);
      }
    }
    return json({ success: true, status: "actief", contract_id: contract.id, mail });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Activeren mislukt" }, 500);
  }
});
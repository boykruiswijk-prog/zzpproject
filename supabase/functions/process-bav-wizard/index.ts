import { haalKvkProfiel, kvkGeldig, kvkStartdatum, kvkAfwijkingen } from "../_shared/kvk.ts";
import { normaliseerAdres } from "../_shared/adresNormalisatie.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.0";
import { guardPublicSubmission } from "../_shared/antiSpam.ts";
import {
  KLANTMELDING_INCASSANT_ONTBREEKT,
  bouwMachtigingData,
  incassantIdOntbreekt,
  legBewijsVast,
  ontbrekendeAdresvelden,
  verstuurMachtigingBevestiging,
} from "../_shared/sepaBewijs.ts";
import { isUuid, isValidIban, redenBav } from "../_shared/sepaMachtiging.ts";
import { brancheVoorSector } from "../_shared/sectorBranche.ts";
import { STARTER, STARTER_VOORBEHOUD_TEKST, isStarter, starterTot } from "../_shared/starterTarief.ts";
import { HANDMATIGE_ACCEPTATIE_REDEN, teamWaarschuwingHandmatig, vereistHandmatigeAcceptatie } from "../_shared/sectorRegels.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

import { CYBER_VERSIE, CYBER_AKKOORD, CYBER_DEKKING, CYBER_HULP, CYBER_DETAILS, CYBER_LOOPTIJD, CYBER_AFGEWEZEN, beoordeelCyber, basisPakket, isCyberPakket, aanvraagPremie, cyberJaarEind } from "../_shared/cyber.ts";
const PAKKET_CONFIG = Object.fromEntries(["maandelijks", "jaarlijks", "jaarlijks-cyber", "maandelijks-cyber"].map(id => {
  const p = aanvraagPremie(id, false);
  return [id, { naam: `BAV & AVB ${p.maand ? "Maandelijks" : "Jaarlijks"}${p.cyber ? " + Cyber" : ""}`, prijs: p.totaal, betaalwijze: p.maand ? "maandelijks" as const : "jaarlijks" as const, maandprijs: p.maand ? p.totaal : Math.round(p.totaal / 12 * 100) / 100, jaarprijs: p.maand ? p.totaal * 12 : p.totaal, dekking: `BAV €5.000.000 / AVB €2.500.000 per aanspraak${p.cyber ? `; ${CYBER_DEKKING} ${CYBER_HULP} ${CYBER_DETAILS}` : ""}` }];
}));

interface BavSubmission {
  gekozen_pakket: string;
  cyber_aangevraagd?: boolean;
  cyber_antwoorden?: unknown;
  cyber_akkoord?: boolean;
  cyber_client_akkoord_op?: string;
  betaalwijze: "maandelijks" | "jaarlijks";
  ingangsdatum: string;
  /** Door de klant opgegeven startdatum KVK-inschrijving (YYYY-MM-DD); basis voor het startertarief. */
  kvk_startdatum?: string;
  voornaam: string;
  achternaam: string;
  email: string;
  telefoon?: string;
  bedrijfsnaam: string;
  kvk_nummer?: string;
  beroep?: string;
  sector?: string;
  adres_straat?: string;
  adres_huisnummer?: string;
  adres_postcode?: string;
  adres_plaats?: string;
  iban?: string;
  adres_land?: string;
  sepa_akkoord?: boolean;
  rekeninghouder?: string;
  // Vooraf (client-side) gegenereerde lead-UUID; basis voor het mandaatkenmerk.
  lead_id?: string;
  /** Concept-id van de tussentijds opgeslagen halve aanvraag (aanvraag_concepten). */
  concept_id?: string;
  client_akkoord_op?: string;
  pagina_url?: string;
  opmerkingen?: string;
  vereist_handmatige_beoordeling?: boolean;
  /** Documenten (pad) die in stap 5 getoond zijn en waarvan de klant lezen bevestigt. */
  getoonde_documenten?: unknown;
  /** Volledige formulierinhoud als geordende lijst {label, waarde}. */
  formulier?: unknown;
  formulier_naam?: string;
  /** Herkomst van het bezoek (first-party, sessionStorage). */
  attributie?: unknown;
}

import { saneerFormulier, saneerPagina } from "../_shared/leadVelden.ts";
import { resolveEnvironment } from "../_shared/environment.ts";
import { saneerAttributie } from "../_shared/attributie.ts";
import { normaliseerNlTelefoon } from "../_shared/telefoon.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  // Weigering altijd loggen (zonder persoonsgegevens), zodat een 4xx te herleiden is.
  const weiger = (status: number, error: string, reason: string, extra: Record<string, unknown> = {}) => {
    console.warn(`process-bav-wizard geweigerd: status=${status} reason=${reason} melding="${error}"`);
    return new Response(
      JSON.stringify({ success: false, error, reason, ...extra }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  };

  let submissionVoorFout: BavSubmission | null = null;
  let leadOpgeslagen: { id: string; mandaatkenmerk: string } | null = null;
  try {
    const t0 = Date.now();
    const submission = (await req.json()) as BavSubmission;
    submissionVoorFout = submission;
    if (typeof submission.telefoon === "string") submission.telefoon = normaliseerNlTelefoon(submission.telefoon);

    if (
      !submission?.gekozen_pakket ||
      !PAKKET_CONFIG[submission.gekozen_pakket] ||
      !submission.voornaam ||
      !submission.achternaam ||
      !submission.email ||
      !submission.bedrijfsnaam ||
      !submission.ingangsdatum ||
      !submission.betaalwijze
    ) {
      const ontbreekt = ["gekozen_pakket","voornaam","achternaam","email","bedrijfsnaam","ingangsdatum","betaalwijze"]
        .filter((k) => !(submission as unknown as Record<string, unknown>)?.[k]);
      if (submission?.gekozen_pakket && !PAKKET_CONFIG[submission.gekozen_pakket]) ontbreekt.push("gekozen_pakket(onbekend)");
      return weiger(400, `Aanvraag onvolledig: ${ontbreekt.join(", ")}`, "validatie");
    }

    const cyberWasGekozen = isCyberPakket(submission.gekozen_pakket) || submission.cyber_aangevraagd === true;
    const cyberToets = beoordeelCyber(submission.cyber_antwoorden);
    if (cyberWasGekozen && !cyberToets.volledig) return weiger(400, "Beantwoord alle vragen over cyberdekking", "cyber_vragen");
    const cyberAfgewezen = cyberWasGekozen && !cyberToets.toegestaan;
    if (cyberAfgewezen) submission.gekozen_pakket = basisPakket(submission.gekozen_pakket);
    const cyberGekozen = isCyberPakket(submission.gekozen_pakket);
    if (cyberGekozen && submission.cyber_akkoord !== true) return weiger(400, "Bevestig de afzonderlijke looptijd van cyber", "cyber_akkoord");
    submission.betaalwijze = PAKKET_CONFIG[submission.gekozen_pakket].betaalwijze;
    // Zorg/bouw: normale flow, intern gemarkeerd voor handmatige acceptatie (klant merkt niets).
    const handmatigeAcceptatie = vereistHandmatigeAcceptatie(submission);

    // SEPA-machtiging: nooit vastleggen zonder incassant-ID.
    if (incassantIdOntbreekt()) {
      console.error("process-bav-wizard: COMPANY.incassantId is leeg — aanvraag geweigerd, geen machtiging vastgelegd.");
      return new Response(
        JSON.stringify({ success: false, error: KLANTMELDING_INCASSANT_ONTBREEKT, reason: "incassant_id_ontbreekt" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    // Normaliseren vóór validatie en legBewijsVast: lead, bewijs, PDF en Exact krijgen hetzelfde adres.
    const adres = normaliseerAdres({
      straat: submission.adres_straat ?? "",
      huisnummer: submission.adres_huisnummer ?? "",
      postcode: submission.adres_postcode ?? "",
      plaats: submission.adres_plaats ?? "",
      land: submission.adres_land ?? "",
    });
    const machtigingFout =
      submission.sepa_akkoord !== true ? "SEPA-machtiging is verplicht"
      : !isValidIban(submission.iban ?? "") ? "Ongeldig IBAN"
      : !isUuid(submission.lead_id) ? "Ongeldig aanvraagkenmerk"
      : !(submission.rekeninghouder ?? "").trim() ? "Naam rekeninghouder is verplicht"
      : ontbrekendeAdresvelden(adres).length ? `Adres rekeninghouder onvolledig: ${ontbrekendeAdresvelden(adres).join(", ")}`
      : null;
    if (machtigingFout) return weiger(400, machtigingFout, "validatie_machtiging");

    // Herhaalde aanvraag (zelfde e-mail, laatste 24 uur): nooit blokkeren door de IP-limiet,
    // wel als nieuwe aanvraag vastleggen met verwijzing naar de vorige (niets overschrijven).
    const { data: vorige } = await supabase.from("leads").select("id")
      .eq("type", "verzekering_aanvraag").ilike("email", submission.email.trim().replace(/[\\%_]/g, (c) => `\\${c}`))
      .gte("created_at", new Date(Date.now() - 86_400_000).toISOString())
      .order("created_at", { ascending: false }).limit(1);
    const vorigeLeadId: string | null = vorige?.[0]?.id ?? null;
    if (vorigeLeadId) console.log(`process-bav-wizard: herhaalde aanvraag, vorige lead ${vorigeLeadId}`);

    // Anti-spam: honeypot, invultijd en IP-limiet.
    const guard = await guardPublicSubmission(req, supabase, {
      throttle: !vorigeLeadId,
      hp: (submission as unknown as Record<string, unknown>).hp,
      ms: (submission as unknown as Record<string, unknown>).ms,
      kind: "bav",
    });
    if (!guard.ok) return weiger(guard.status ?? 400, guard.error ?? "Aanvraag geweigerd.", guard.reason ?? "anti_spam");

    const todayStr = new Date().toISOString().split("T")[0];
    if (submission.ingangsdatum < todayStr) {
      return weiger(400, `Online kan de ingangsdatum niet in het verleden liggen. Heb je een vraag, bel ${COMPANY.phoneDisplay}.`, "ingangsdatum");
    }

    // ── DUPLICATE GUARD: bestaande klant met polis kan geen tweede aanvraag doen ──
    {
      const cleanEmail = submission.email.trim().toLowerCase();
      const cleanKvk = (submission.kvk_nummer ?? "").trim();
      const emailQuery = supabase.from("leads").select("id").eq("email", cleanEmail).not("exact_account_id", "is", null).in("status", ["actief", "klant"]).limit(1);
      const kvkQuery = cleanKvk ? supabase.from("leads").select("id").eq("kvk_nummer", cleanKvk).not("exact_account_id", "is", null).in("status", ["actief", "klant"]).limit(1) : Promise.resolve({ data: [] });
      const [{ data: emailExisting }, { data: kvkExisting }] = await Promise.all([emailQuery, kvkQuery]);
      if ((emailExisting?.length ?? 0) > 0 || (kvkExisting?.length ?? 0) > 0) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Bestaande klant gedetecteerd. Gebruik klantportaal of neem contact op.",
          }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const pakket = PAKKET_CONFIG[submission.gekozen_pakket];
    // KVK is leidend voor naam, adres en inschrijvingsdatum. Lukt de KVK-opvraging niet, dan geldt de klantopgave met handmatige controle.
    const kvkNr = String(submission.kvk_nummer ?? "").replace(/\D/g, "");
    const kvkRes = kvkGeldig(kvkNr) ? await haalKvkProfiel(supabase, kvkNr, { bron: "aanvraag" }) : null;
    const kvkProfiel = kvkRes?.ok ? kvkRes.profiel : null;
    const klantOpgave = { bedrijfsnaam: submission.bedrijfsnaam, straat: adres.straat, huisnummer: adres.huisnummer, postcode: adres.postcode, plaats: adres.plaats, kvk_startdatum: submission.kvk_startdatum ?? null };
    const leadAdres = kvkProfiel?.bezoekadres?.postcode
      ? { straat: kvkProfiel.bezoekadres.straat ?? "", huisnummer: kvkProfiel.bezoekadres.huisnummer ?? "", postcode: kvkProfiel.bezoekadres.postcode ?? "", plaats: kvkProfiel.bezoekadres.plaats ?? "" }
      : adres;
    const adresBron = !kvkProfiel ? "klant" : kvkProfiel.bezoekadres?.postcode ? "kvk" : kvkProfiel.adres_afgeschermd ? "klant_kvk_afgeschermd" : "klant";
    if (kvkProfiel?.naam) submission.bedrijfsnaam = kvkProfiel.naam;
    const kvkApiStart = kvkProfiel ? kvkStartdatum(kvkProfiel) : null;
    const kvkGegevens = kvkRes ? {
      status: kvkRes.ok ? "ok" : kvkRes.reden,
      opgehaald_op: new Date().toISOString(),
      profiel: kvkProfiel,
      klant_opgave: klantOpgave,
      adres_bron: adresBron,
      afwijkingen: kvkProfiel ? kvkAfwijkingen(klantOpgave, { bedrijfsnaam: kvkProfiel.naam, ...leadAdres, kvk_startdatum: kvkApiStart }, adresBron === "kvk") : [],
    } : null;
    // Startertarief: altijd op de server bepaald; alleen BAV + AVB maand/jaar (niet Cyber).
    const klantStart = typeof submission.kvk_startdatum === "string" && /^\d{4}-\d{2}-\d{2}$/.test(submission.kvk_startdatum)
      && submission.kvk_startdatum >= "1900-01-01" && submission.kvk_startdatum <= submission.ingangsdatum ? submission.kvk_startdatum : null;
    const kvkStart = kvkApiStart ?? klantStart;
    const kvkDatumBron = kvkApiStart ? "kvk_api" : klantStart ? "klant" : null;
    const starter = isStarter(kvkStart, submission.ingangsdatum);
    const starterTotDatum = starter ? starterTot(submission.ingangsdatum) : null;
    const premie = aanvraagPremie(submission.gekozen_pakket, starter);
    const premium = premie.totaal;
    const starterVelden = { kvk_startdatum: kvkStart, kvk_datum_bron: kvkDatumBron, kvk_gegevens: kvkGegevens, tarief_type: starter ? "starter" : "standaard", starter_tot: starterTotDatum };
    const volledigeNaam = `${submission.voornaam} ${submission.achternaam}`;
    const branche = brancheVoorSector(submission.sector);
    if (!branche) return weiger(400, "Kies een geldige sector.", "sector");


    // ── 0. BEWIJSRECORD SEPA-MACHTIGING (eerst; faalt dit, dan faalt de aanvraag) ──
    const leadId = submission.lead_id as string;
    // Preview/testomgeving: altijd testrecord, geen klantbevestiging.
    const isTestLead = !resolveEnvironment(req).isProduction;
    const machtiging = bouwMachtigingData({
      type: "doorlopend",
      bronId: leadId,
      reden: redenBav(),
      debiteurNaam: submission.rekeninghouder as string,
      debiteurAdres: adres,
      iban: submission.iban as string,
    });
    const bewijs = await legBewijsVast(supabase, req, {
      dienst: "bav",
      bronTabel: "leads",
      bronId: leadId,
      data: machtiging,
      clientAkkoordOp: submission.client_akkoord_op,
      paginaUrl: submission.pagina_url,
    });

    // ── 1. INSERT IN LEADS ──
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .insert({
        id: leadId,
        type: "verzekering_aanvraag",
        status: "nieuw_te_beoordelen",
        voornaam: submission.voornaam,
        achternaam: submission.achternaam,
        email: submission.email,
        telefoon: submission.telefoon || null,
        bedrijfsnaam: submission.bedrijfsnaam,
        kvk_nummer: submission.kvk_nummer || null,
        beroep: submission.beroep || null,
        branche,
        adres_straat: leadAdres.straat || null,
        adres_huisnummer: leadAdres.huisnummer || null,
        adres_postcode: leadAdres.postcode || null,
        adres_plaats: leadAdres.plaats || null,
        iban: machtiging.iban,
        sepa_akkoord: true,
        sepa_akkoord_datum: bewijs.akkoord_op,
        omzet: submission.betaalwijze,
        verzekering_type: pakket.naam,
        verzekerd_bedrag: pakket.dekking,
        ingangsdatum: submission.ingangsdatum,
        gekozen_pakket: submission.gekozen_pakket,
         cyber_voorwaarden_versie: cyberGekozen ? CYBER_VERSIE : null,
         cyber_ingangsdatum: cyberGekozen ? submission.ingangsdatum : null,
         cyber_einddatum: cyberGekozen ? cyberJaarEind(submission.ingangsdatum) : null,
        ...starterVelden,
        // Datum uit de KVK API: automatisch bevestigd. Alleen bij klantopgave (API faalde) handmatige controle.
        starter_controle_status: starter ? (kvkDatumBron === "kvk_api" ? "goedgekeurd" : "te_controleren") : null,
        ...(starter && kvkDatumBron === "kvk_api" ? { starter_beoordeeld_op: new Date().toISOString(), starter_toelichting: "Automatisch bevestigd via KVK API" } : {}),
        opmerkingen: [
          // IBAN wordt bewust NIET in het vrije opmerkingenveld herhaald (alleen in de iban-kolom).
          submission.rekeninghouder ? `Rekeninghouder: ${submission.rekeninghouder}` : null,
          submission.sector ? `Sector: ${submission.sector}` : null,
          submission.opmerkingen ? submission.opmerkingen : null,
        ]
          .filter(Boolean)
          .join("\n") || null,
        bron: "website",
        exact_status: "wachtend",
        vereist_handmatige_beoordeling: handmatigeAcceptatie || submission.vereist_handmatige_beoordeling === true,
        is_test: isTestLead,
        extra_data: {
           ...(cyberWasGekozen ? { cyber: { versie: CYBER_VERSIE, gekozen: cyberGekozen, afgewezen: cyberAfgewezen, antwoorden: cyberToets.antwoorden, redenen: cyberToets.redenen, akkoord: cyberGekozen && submission.cyber_akkoord === true, client_akkoord_op: submission.cyber_client_akkoord_op ?? null } } : {}),
          formulier: saneerFormulier(submission.formulier),
          formulier_naam: typeof submission.formulier_naam === "string" ? submission.formulier_naam.slice(0, 100) : "Online aanvraag BAV + AVB",
          pagina: saneerPagina(submission.pagina_url),
          sector: submission.sector,
          ...(saneerAttributie(submission.attributie) ? { attributie: saneerAttributie(submission.attributie) } : {}),
          ...(handmatigeAcceptatie
            ? { handmatige_acceptatie: { reden: HANDMATIGE_ACCEPTATIE_REDEN, sector: submission.sector } }
            : {}),
          getoonde_documenten: Array.isArray(submission.getoonde_documenten)
            ? submission.getoonde_documenten
                .filter((d): d is string => typeof d === "string" && /^\/documenten\/[A-Za-z0-9._\/-]{1,150}$/.test(d))
                .slice(0, 10)
            : [],
          documenten_bevestigd_op: bewijs.akkoord_op,
          ...(vorigeLeadId ? { herhaalde_aanvraag_van: vorigeLeadId } : {}),
        },
      })
      .select()
      .single();

    if (leadError) throw new Error(`Lead insert: ${leadError.message}`);
    leadOpgeslagen = { id: lead.id, mandaatkenmerk: machtiging.mandaatkenmerk };

    // ── 2. INSERT IN BAV_AANMELDINGEN ──
    const { data: aanmelding, error: dbError } = await supabase
      .from("bav_aanmeldingen")
      .insert({
        lead_id: lead.id,
        voornaam: submission.voornaam,
        achternaam: submission.achternaam,
        email: submission.email,
        telefoon: submission.telefoon || null,
        bedrijfsnaam: submission.bedrijfsnaam,
        kvk_nummer: submission.kvk_nummer || null,
        beroep: submission.beroep || null,
        sector: submission.sector || null,
        pakket: submission.gekozen_pakket,
        pakket_naam: pakket.naam,
        betaalwijze: pakket.betaalwijze,
        ingangsdatum: submission.ingangsdatum,
        maandpremie: premie.maand ? premium : Math.round(premium / 12 * 100) / 100,
        jaarpremie: premie.maand ? premium * 12 : premium,
        premiebedrag: premium,
        // Alleen kolommen die bav_aanmeldingen kent (kvk_datum_bron/kvk_gegevens staan alleen op leads).
        kvk_startdatum: starterVelden.kvk_startdatum,
        tarief_type: starterVelden.tarief_type,
        starter_tot: starterVelden.starter_tot,
        iban: machtiging.iban,
        rekeninghouder: machtiging.debiteurNaam,
        status: "nieuw",
        exact_status: "wachtend",
        is_test: isTestLead,
      })
      .select()
      .single();

    // Lead en SEPA-bewijs staan al vast: een fout hier mag de aanvraag niet laten mislukken.
    if (dbError) console.error(`process-bav-wizard: aanmelding insert mislukt (lead ${lead.id} wel opgeslagen): ${dbError.message}`);

    // ── 2b/3. Na het antwoord: PDF + bevestigingsmail en teamnotificatie.
    // Bewijs, lead en aanmelding staan hierboven al synchroon vast. Fouten worden
    // gelogd in lead_notification_log (verstuurMachtigingBevestiging / send-lead-notification).
    const achtergrond = (async () => {
    if (!isTestLead) await verstuurMachtigingBevestiging(supabase, req, {
      fnName: "process-bav-wizard",
      leadType: "bav-sepa-machtiging",
      record: bewijs,
      data: machtiging,
      email: submission.email,
      aanhef: volledigeNaam,
      bedragOfReden: `${redenBav()} (${pakket.naam}, € ${premium} ${pakket.betaalwijze === "maandelijks" ? "per maand" : "per jaar"})${starter ? `. ${STARTER_VOORBEHOUD_TEKST}` : ""}${cyberGekozen ? `. ${CYBER_LOOPTIJD} Lopend cyberjaar tot ${cyberJaarEind(submission.ingangsdatum)}. ${CYBER_DEKKING} ${CYBER_HULP} ${CYBER_DETAILS}` : ""}`,
    });

    // ── 3. E-MAIL VIA send-lead-notification ──
    await supabase.functions
      .invoke("send-lead-notification", {
        headers: { "x-internal-secret": Deno.env.get("INTERNAL_FUNCTION_SECRET") ?? "" },
        body: {
          type: "bav",
          leadId: lead.id,
          reference: lead.id.slice(0, 8),
          userEmail: submission.email,
          ...(handmatigeAcceptatie ? { waarschuwing: teamWaarschuwingHandmatig(submission.sector ?? "") } : {}),
          fields: {
            naam: volledigeNaam,
            email: submission.email,
            telefoon: submission.telefoon || "-",
            bedrijfsnaam: submission.bedrijfsnaam,
            kvk_nummer: submission.kvk_nummer || "-",
            pakket: pakket.naam,
            dekking: pakket.dekking,
             ...(cyberGekozen ? { cyber_looptijd: CYBER_LOOPTIJD, cyber_einddatum: cyberJaarEind(submission.ingangsdatum) } : {}),
            betaalwijze: pakket.betaalwijze,
            ingangsdatum: submission.ingangsdatum,
            premie: starter ? `€${premium} startertarief t/m ${starterTotDatum}, daarna €${pakket.prijs}; KVK-startdatum ${kvkStart} controleren` : `€${premium}`,
          },
        },
      })
      .catch((err) => console.error("send-lead-notification failed:", err));
    console.log(`[timing] achtergrond klaar na ${Date.now() - t0}ms`);
    })().catch((e) => console.error("achtergrondtaken mislukt:", e));
    // deno-lint-ignore no-explicit-any
    const rt = (globalThis as any).EdgeRuntime;
    if (rt?.waitUntil) rt.waitUntil(achtergrond); else await achtergrond;
    console.log(`[timing] antwoord na ${Date.now() - t0}ms`);

    // ── 4. Geen Exact-stap bij aanmelding (H6) ──
    // Exact (relatie, bankrekening, machtiging, factuur) wordt pas ingericht bij
    // activatie via lead-to-exact-activate. exact_status blijft "wachtend" (zie insert hierboven).

    // Halve aanvraag afgerond: concept op 'omgezet' met lead_id (nooit een omgezet concept overschrijven).
    if (typeof submission.concept_id === "string" && isUuid(submission.concept_id)) {
      const { error: cErr } = await supabase.from("aanvraag_concepten")
        .update({ status: "omgezet", lead_id: lead.id, laatst_actief_op: new Date().toISOString(), stap: 5 })
        .eq("id", submission.concept_id).neq("status", "omgezet");
      if (cErr) console.error("concept omzetten mislukt:", cErr.message);
    }

    return new Response(
      JSON.stringify({
        success: true,
        aanmelding_id: aanmelding?.id ?? null,
        lead_id: lead.id,
        mandaatkenmerk: machtiging.mandaatkenmerk,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    console.error(`process-bav-wizard mislukt: reason=server_fout melding="${message}"`);
    // Ingevulde gegevens bewaren voor terugbellen: concept blijft open op stap 5 (verzenden geprobeerd).
    try {
      const cid = (submissionVoorFout as { concept_id?: unknown } | null)?.concept_id;
      if (typeof cid === "string" && isUuid(cid)) {
        await supabase.from("aanvraag_concepten").update({ stap: 5, laatst_actief_op: new Date().toISOString() })
          .eq("id", cid).neq("status", "omgezet");
      }
    } catch (e) { console.error("concept bijwerken na fout mislukt:", e instanceof Error ? e.message : e); }
    // Aanvraag is al opgeslagen: vervolgfout alleen loggen, klant krijgt de normale bevestiging.
    if (leadOpgeslagen) {
      console.error(`process-bav-wizard vervolgstap mislukt na opslaan lead ${leadOpgeslagen.id}: ${message}`);
      return new Response(
        JSON.stringify({ success: true, aanmelding_id: null, lead_id: leadOpgeslagen.id, mandaatkenmerk: leadOpgeslagen.mandaatkenmerk, vervolgfout: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

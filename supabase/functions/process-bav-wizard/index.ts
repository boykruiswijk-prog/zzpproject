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
import { HANDMATIGE_ACCEPTATIE_REDEN, teamWaarschuwingHandmatig, vereistHandmatigeAcceptatie } from "../_shared/sectorRegels.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Sync met src/data/bavPakketten.ts — single source of truth voor BAV-prijzen.
const PAKKET_CONFIG: Record<
  string,
  { naam: string; prijs: number; betaalwijze: "maandelijks" | "jaarlijks"; maandprijs: number; jaarprijs: number; dekking: string }
> = {
  "maandelijks": {
    naam: "BAV & AVB Maandelijks",
    prijs: 55,
    betaalwijze: "maandelijks",
    maandprijs: 55,
    jaarprijs: 660,
    dekking: "BAV €5.000.000 / AVB €2.500.000 per gebeurtenis",
  },
  "jaarlijks": {
    naam: "BAV & AVB Jaarlijks",
    prijs: 600,
    betaalwijze: "jaarlijks",
    maandprijs: 50,
    jaarprijs: 600,
    dekking: "BAV €5.000.000 / AVB €2.500.000 per gebeurtenis",
  },
  "jaarlijks-cyber": {
    naam: "BAV & AVB Jaarlijks + Cyber",
    prijs: 750,
    betaalwijze: "jaarlijks",
    maandprijs: 62.5,
    jaarprijs: 750,
    dekking: "BAV €5.000.000 / AVB €2.500.000 / Cyber tot €5.000.000 per jaar",
  },
};

interface BavSubmission {
  gekozen_pakket: keyof typeof PAKKET_CONFIG;
  betaalwijze: "maandelijks" | "jaarlijks";
  ingangsdatum: string;
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
  client_akkoord_op?: string;
  pagina_url?: string;
  opmerkingen?: string;
  vereist_handmatige_beoordeling?: boolean;
  /** Documenten (pad) die in stap 5 getoond zijn en waarvan de klant lezen bevestigt. */
  getoonde_documenten?: unknown;
}

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

  try {
    const t0 = Date.now();
    const submission = (await req.json()) as BavSubmission;

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

    // Anti-spam: honeypot, invultijd en IP-limiet.
    const guard = await guardPublicSubmission(req, supabase, {
      hp: (submission as unknown as Record<string, unknown>).hp,
      ms: (submission as unknown as Record<string, unknown>).ms,
      kind: "bav",
    });
    if (!guard.ok) return weiger(guard.status ?? 400, guard.error ?? "Aanvraag geweigerd.", guard.reason ?? "anti_spam");

    const todayStr = new Date().toISOString().split("T")[0];
    if (submission.ingangsdatum < todayStr) {
      return weiger(400, "Een verzekering kan niet met terugwerkende kracht worden afgesloten. De vroegste ingangsdatum is vandaag.", "ingangsdatum");
    }

    // ── DUPLICATE GUARD: bestaande klant met polis kan geen tweede aanvraag doen ──
    {
      const cleanEmail = submission.email.trim().toLowerCase();
      const cleanKvk = (submission.kvk_nummer ?? "").trim();
      const orParts: string[] = [`email.ilike.${cleanEmail}`];
      if (cleanKvk) orParts.push(`kvk_nummer.eq.${cleanKvk}`);
      const { data: existing } = await supabase
        .from("leads")
        .select("id")
        .or(orParts.join(","))
        .not("exact_account_id", "is", null)
        .in("status", ["actief", "klant"])
        .limit(1);
      if (existing && existing.length > 0) {
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
    const premium = pakket.prijs;
    const volledigeNaam = `${submission.voornaam} ${submission.achternaam}`;
    const branche = brancheVoorSector(submission.sector);
    if (!branche) return weiger(400, "Kies een geldige sector.", "sector");


    // ── 0. BEWIJSRECORD SEPA-MACHTIGING (eerst; faalt dit, dan faalt de aanvraag) ──
    const leadId = submission.lead_id as string;
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
        adres_straat: adres.straat || null,
        adres_huisnummer: adres.huisnummer || null,
        adres_postcode: adres.postcode || null,
        adres_plaats: adres.plaats || null,
        iban: machtiging.iban,
        sepa_akkoord: true,
        sepa_akkoord_datum: bewijs.akkoord_op,
        omzet: submission.betaalwijze,
        verzekering_type: pakket.naam,
        verzekerd_bedrag: pakket.dekking,
        ingangsdatum: submission.ingangsdatum,
        gekozen_pakket: submission.gekozen_pakket,
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
        extra_data: {
          sector: submission.sector,
          ...(handmatigeAcceptatie
            ? { handmatige_acceptatie: { reden: HANDMATIGE_ACCEPTATIE_REDEN, sector: submission.sector } }
            : {}),
          getoonde_documenten: Array.isArray(submission.getoonde_documenten)
            ? submission.getoonde_documenten
                .filter((d): d is string => typeof d === "string" && /^\/documenten\/[A-Za-z0-9._\/-]{1,150}$/.test(d))
                .slice(0, 10)
            : [],
          documenten_bevestigd_op: bewijs.akkoord_op,
        },
      })
      .select()
      .single();

    if (leadError) throw new Error(`Lead insert: ${leadError.message}`);

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
        maandpremie: pakket.maandprijs,
        jaarpremie: pakket.jaarprijs,
        premiebedrag: premium,
        iban: machtiging.iban,
        rekeninghouder: machtiging.debiteurNaam,
        status: "nieuw",
        exact_status: "wachtend",
      })
      .select()
      .single();

    if (dbError) throw new Error(`Aanmelding insert: ${dbError.message}`);

    // ── 2b/3. Na het antwoord: PDF + bevestigingsmail en teamnotificatie.
    // Bewijs, lead en aanmelding staan hierboven al synchroon vast. Fouten worden
    // gelogd in lead_notification_log (verstuurMachtigingBevestiging / send-lead-notification).
    const achtergrond = (async () => {
    await verstuurMachtigingBevestiging(supabase, req, {
      fnName: "process-bav-wizard",
      leadType: "bav-sepa-machtiging",
      record: bewijs,
      data: machtiging,
      email: submission.email,
      aanhef: volledigeNaam,
      bedragOfReden: `${redenBav()} (${pakket.naam}, € ${premium} ${pakket.betaalwijze === "maandelijks" ? "per maand" : "per jaar"})`,
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
            betaalwijze: pakket.betaalwijze,
            ingangsdatum: submission.ingangsdatum,
            premie: `€${premium}`,
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

    return new Response(
      JSON.stringify({
        success: true,
        aanmelding_id: aanmelding.id,
        lead_id: lead.id,
        mandaatkenmerk: machtiging.mandaatkenmerk,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    console.error("process-bav-wizard error:", message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

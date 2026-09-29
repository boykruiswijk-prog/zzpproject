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
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
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
      return new Response(
        JSON.stringify({ success: false, error: "Ongeldige aanvraag" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // SEPA-machtiging: nooit vastleggen zonder incassant-ID.
    if (incassantIdOntbreekt()) {
      console.error("process-bav-wizard: COMPANY.incassantId is leeg — aanvraag geweigerd, geen machtiging vastgelegd.");
      return new Response(
        JSON.stringify({ success: false, error: KLANTMELDING_INCASSANT_ONTBREEKT, reason: "incassant_id_ontbreekt" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const adres = {
      straat: submission.adres_straat ?? "",
      huisnummer: submission.adres_huisnummer ?? "",
      postcode: submission.adres_postcode ?? "",
      plaats: submission.adres_plaats ?? "",
      land: submission.adres_land ?? "",
    };
    const machtigingFout =
      submission.sepa_akkoord !== true ? "SEPA-machtiging is verplicht"
      : !isValidIban(submission.iban ?? "") ? "Ongeldig IBAN"
      : !isUuid(submission.lead_id) ? "Ongeldig aanvraagkenmerk"
      : !(submission.rekeninghouder ?? "").trim() ? "Naam rekeninghouder is verplicht"
      : ontbrekendeAdresvelden(adres).length ? `Adres rekeninghouder onvolledig: ${ontbrekendeAdresvelden(adres).join(", ")}`
      : null;
    if (machtigingFout) {
      return new Response(
        JSON.stringify({ success: false, error: machtigingFout }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Anti-spam: honeypot, invultijd en IP-limiet.
    const guard = await guardPublicSubmission(req, supabase, {
      hp: (submission as unknown as Record<string, unknown>).hp,
      ms: (submission as unknown as Record<string, unknown>).ms,
      kind: "bav",
    });
    if (!guard.ok) {
      return new Response(
        JSON.stringify({ success: false, error: guard.error, reason: guard.reason }),
        { status: guard.status ?? 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const todayStr = new Date().toISOString().split("T")[0];
    if (submission.ingangsdatum < todayStr) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Een verzekering kan niet met terugwerkende kracht worden afgesloten. De vroegste ingangsdatum is vandaag.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
        adres_straat: submission.adres_straat || null,
        adres_huisnummer: submission.adres_huisnummer || null,
        adres_postcode: submission.adres_postcode || null,
        adres_plaats: submission.adres_plaats || null,
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
        vereist_handmatige_beoordeling: submission.vereist_handmatige_beoordeling === true,
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

    // ── 2b. BEVESTIGING SEPA-MACHTIGING (PDF + mail; faalt nooit hard) ──
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
    supabase.functions
      .invoke("send-lead-notification", {
        headers: { "x-internal-secret": Deno.env.get("INTERNAL_FUNCTION_SECRET") ?? "" },
        body: {
          type: "bav",
          leadId: lead.id,
          reference: lead.id.slice(0, 8),
          userEmail: submission.email,
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

    // ── 4. Geen Exact-stap bij aanmelding (H6) ──
    // Exact (relatie, bankrekening, machtiging, factuur) wordt pas ingericht bij
    // activatie via lead-to-exact-activate. exact_status blijft "wachtend" (zie insert hierboven).

    return new Response(
      JSON.stringify({ success: true, aanmelding_id: aanmelding.id, lead_id: lead.id }),
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

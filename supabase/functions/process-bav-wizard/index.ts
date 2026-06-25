import { createClient } from "npm:@supabase/supabase-js@2.39.0";

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
  sepa_akkoord?: boolean;
  rekeninghouder?: string;
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


    // ── 1. INSERT IN LEADS ──
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .insert({
        type: "verzekering_aanvraag",
        status: "nieuw_te_beoordelen",
        voornaam: submission.voornaam,
        achternaam: submission.achternaam,
        email: submission.email,
        telefoon: submission.telefoon || null,
        bedrijfsnaam: submission.bedrijfsnaam,
        kvk_nummer: submission.kvk_nummer || null,
        beroep: submission.beroep || null,
        branche: submission.branche || null,
        adres_straat: submission.adres_straat || null,
        adres_huisnummer: submission.adres_huisnummer || null,
        adres_postcode: submission.adres_postcode || null,
        adres_plaats: submission.adres_plaats || null,
        iban: submission.iban || null,
        sepa_akkoord: submission.sepa_akkoord === true,
        sepa_akkoord_datum: submission.sepa_akkoord === true ? new Date().toISOString() : null,
        omzet: submission.betaalwijze,
        verzekering_type: pakket.naam,
        verzekerd_bedrag: pakket.dekking,
        ingangsdatum: submission.ingangsdatum,
        gekozen_pakket: submission.gekozen_pakket,
        opmerkingen: [
          submission.iban ? `IBAN: ${submission.iban}` : null,
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
        iban: submission.iban || null,
        rekeninghouder: submission.rekeninghouder || null,
        status: "nieuw",
        exact_status: "wachtend",
      })
      .select()
      .single();

    if (dbError) throw new Error(`Aanmelding insert: ${dbError.message}`);

    // ── 3. E-MAIL VIA send-lead-notification ──
    supabase.functions
      .invoke("send-lead-notification", {
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

    // ── 4. EXACT ONLINE SYNC ──
    try {
      const TEST_MODE = Deno.env.get("EXACT_TEST_MODE") === "true";
      const BASE_URL = Deno.env.get("EXACT_BASE_URL") ?? "https://start.exactonline.nl";
      const environment = TEST_MODE ? "test" : "production";

      let { data: tokenRow } = await supabase
        .from("exact_tokens")
        .select("*")
        .eq("environment", environment)
        .maybeSingle();

      if (!tokenRow) {
        throw new Error("Geen Exact token aanwezig. autoriseer eerst via /admin/integraties");
      }

      const expiresMs = new Date(tokenRow.expires_at).getTime();
      if (expiresMs - Date.now() < 60_000) {
        const refreshRes = await supabase.functions.invoke("exact-refresh-token");
        if (refreshRes.error) throw new Error(`Token refresh: ${refreshRes.error.message}`);
        const { data: fresh } = await supabase
          .from("exact_tokens").select("*").eq("environment", environment).maybeSingle();
        if (fresh) tokenRow = fresh;
      }

      const accessToken = tokenRow.access_token;
      const divisionCode = tokenRow.division_code;
      const bedrijfsnaam = TEST_MODE ? `TEST_${submission.bedrijfsnaam}` : submission.bedrijfsnaam;

      const apiHeaders = {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      };

      const accountRes = await fetch(
        `${BASE_URL}/api/v1/${divisionCode}/crm/Accounts`,
        {
          method: "POST",
          headers: apiHeaders,
          body: JSON.stringify({
            Name: bedrijfsnaam,
            Email: submission.email,
            Phone: submission.telefoon,
            ChamberOfCommerce: submission.kvk_nummer,
            Country: "NL",
            Status: "C",
            IsSales: true,
          }),
        }
      );
      if (!accountRes.ok) throw new Error(`Account ${accountRes.status}: ${await accountRes.text()}`);
      const accountData = await accountRes.json();
      const accountId = accountData.d.ID;

      const { data: mapping } = await supabase
        .from("exact_subscription_mapping")
        .select("exact_subscription_type_id")
        .eq("pakket_naam", pakket.naam)
        .eq("actief", true)
        .maybeSingle();

      if (!mapping || mapping.exact_subscription_type_id.startsWith("TODO_")) {
        throw new Error(`Geen Exact subscription type GUID gekoppeld aan "${pakket.naam}"`);
      }

      const subRes = await fetch(
        `${BASE_URL}/api/v1/${divisionCode}/subscription/Subscriptions`,
        {
          method: "POST",
          headers: apiHeaders,
          body: JSON.stringify({
            OrderedBy: accountId,
            InvoicedTo: accountId,
            StartDate: submission.ingangsdatum,
            SubscriptionType: mapping.exact_subscription_type_id,
            Description: `BAV ${pakket.naam} - ${bedrijfsnaam}`,
          }),
        }
      );
      if (!subRes.ok) throw new Error(`Subscription ${subRes.status}: ${await subRes.text()}`);
      const subData = await subRes.json();
      const subscriptionId = subData.d.ID;

      const syncOp = new Date().toISOString();
      await supabase
        .from("bav_aanmeldingen")
        .update({
          exact_status: "gesynchroniseerd",
          exact_account_id: accountId,
          exact_subscription_id: subscriptionId,
          exact_relatie_id: accountId,
          exact_abonnement_id: subscriptionId,
          exact_gesynchroniseerd_op: syncOp,
          exact_sync_op: syncOp,
        })
        .eq("id", aanmelding.id);

      await supabase
        .from("leads")
        .update({
          exact_status: "gesynchroniseerd",
          exact_relatie_id: accountId,
          exact_abonnement_id: subscriptionId,
          exact_sync_op: syncOp,
        })
        .eq("id", lead.id);
    } catch (exactError) {
      const foutBericht = exactError instanceof Error ? exactError.message : "Onbekende fout";
      console.error("Exact sync failed:", foutBericht);
      await supabase
        .from("bav_aanmeldingen")
        .update({ exact_status: "fout", exact_fout: foutBericht, exact_foutmelding: foutBericht })
        .eq("id", aanmelding.id);
      await supabase
        .from("leads")
        .update({ exact_status: "gefaald", exact_fout: foutBericht })
        .eq("id", lead.id);

      supabase.functions.invoke("send-notification", {
        body: {
          type: "exact_error",
          naam: volledigeNaam,
          email: submission.email,
          telefoon: submission.telefoon || "-",
          dekking: `Exact sync mislukt: ${foutBericht}`,
        },
      }).catch((e) => console.error("error mail failed:", e));
    }

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

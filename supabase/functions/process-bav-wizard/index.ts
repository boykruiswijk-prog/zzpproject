import { createClient } from "npm:@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PAKKET_CONFIG: Record<
  string,
  { naam: string; maandprijs: number; jaarprijs: number; dekking: string }
> = {
  basis: {
    naam: "Combi Basis",
    maandprijs: 30,
    jaarprijs: 324,
    dekking: "€500.000 per gebeurtenis / €1.000.000 per jaar",
  },
  uitgebreid: {
    naam: "Combi Uitgebreid",
    maandprijs: 45,
    jaarprijs: 486,
    dekking: "€2.500.000 per gebeurtenis / €5.000.000 per jaar",
  },
  compleet: {
    naam: "Combi Compleet",
    maandprijs: 65,
    jaarprijs: 702,
    dekking: "€5.000.000 per gebeurtenis / €10.000.000 per jaar",
  },
};

interface BavSubmission {
  pakket: keyof typeof PAKKET_CONFIG;
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
  iban?: string;
  rekeninghouder?: string;
  opmerkingen?: string;
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

    // Basisvalidatie
    if (
      !submission?.pakket ||
      !PAKKET_CONFIG[submission.pakket] ||
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

    // Server-side: ingangsdatum mag niet in het verleden liggen
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

    const pakket = PAKKET_CONFIG[submission.pakket];
    const premium =
      submission.betaalwijze === "jaarlijks" ? pakket.jaarprijs : pakket.maandprijs;
    const volledigeNaam = `${submission.voornaam} ${submission.achternaam}`;

    // ── 1. INSERT IN LEADS (admin dashboard) ──
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .insert({
        type: "verzekering_aanvraag",
        voornaam: submission.voornaam,
        achternaam: submission.achternaam,
        email: submission.email,
        telefoon: submission.telefoon || null,
        bedrijfsnaam: submission.bedrijfsnaam,
        kvk_nummer: submission.kvk_nummer || null,
        beroep: submission.beroep || null,
        omzet: submission.betaalwijze,
        verzekering_type: pakket.naam,
        verzekerd_bedrag: pakket.dekking,
        ingangsdatum: submission.ingangsdatum,
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
      })
      .select()
      .single();

    if (leadError) throw new Error(`Lead insert: ${leadError.message}`);

    // ── 2. INSERT IN BAV_AANMELDINGEN (Exact sync bron) ──
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
        pakket: submission.pakket,
        pakket_naam: pakket.naam,
        betaalwijze: submission.betaalwijze,
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

    // ── 3. E-MAIL VIA BESTAANDE send-notification (fire-and-forget) ──
    supabase.functions
      .invoke("send-notification", {
        body: {
          type: "bav",
          naam: volledigeNaam,
          email: submission.email,
          telefoon: submission.telefoon || "-",
          dekking: `${pakket.naam} — ${pakket.dekking}`,
        },
      })
      .catch((err) => console.error("send-notification failed:", err));

    // ── 4. EXACT ONLINE (alleen als enabled + secrets aanwezig) ──
    const { data: exactConfig } = await supabase
      .from("integratie_config")
      .select("*")
      .eq("naam", "exact_online")
      .maybeSingle();

    const exactClientId = Deno.env.get("EXACT_CLIENT_ID");
    const exactClientSecret = Deno.env.get("EXACT_CLIENT_SECRET");
    const exactRefreshToken = Deno.env.get("EXACT_REFRESH_TOKEN");
    const exactDivision = exactConfig?.division || Deno.env.get("EXACT_DIVISION");

    if (
      exactConfig?.enabled &&
      exactClientId &&
      exactClientSecret &&
      exactRefreshToken &&
      exactDivision
    ) {
      try {
        const tokenRes = await fetch("https://start.exactonline.nl/api/oauth2/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token: exactRefreshToken,
            client_id: exactClientId,
            client_secret: exactClientSecret,
          }),
        });
        if (!tokenRes.ok) throw new Error(`Token ${tokenRes.status}`);
        const { access_token } = await tokenRes.json();

        const base = `https://start.exactonline.nl/api/v1/${exactDivision}`;
        const headers = {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        };

        // Bestaande relatie zoeken
        const safeEmail = submission.email.replace(/'/g, "''");
        const zoekRes = await fetch(
          `${base}/crm/Accounts?$filter=Email eq '${safeEmail}'&$select=ID`,
          { headers }
        );
        const zoekData = await zoekRes.json();
        let relatieId: string;

        if (zoekData?.d?.results?.length > 0) {
          relatieId = zoekData.d.results[0].ID;
        } else {
          const relatieRes = await fetch(`${base}/crm/Accounts`, {
            method: "POST",
            headers,
            body: JSON.stringify({
              Name: submission.bedrijfsnaam,
              Email: submission.email,
              Phone: submission.telefoon,
              ChamberOfCommerce: submission.kvk_nummer,
              IBAN: submission.iban,
            }),
          });
          if (!relatieRes.ok) throw new Error(`Relatie aanmaken ${relatieRes.status}`);
          const relatieData = await relatieRes.json();
          relatieId = relatieData.d.ID;
        }

        // Abonnement aanmaken
        const abonnementRes = await fetch(`${base}/subscription/Subscriptions`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            OrderedBy: relatieId,
            Description: `${pakket.naam} — BAV+AVB verzekering`,
            StartDate: submission.ingangsdatum,
            InvoicingStartDate: submission.ingangsdatum,
            TimeUnit: submission.betaalwijze === "maandelijks" ? 3 : 12,
            InvoiceDay: 1,
            Notes: `Beroep: ${submission.beroep ?? "-"} | Betaalwijze: ${submission.betaalwijze}`,
          }),
        });
        if (!abonnementRes.ok) throw new Error(`Abonnement ${abonnementRes.status}`);
        const abonnementData = await abonnementRes.json();

        const syncOp = new Date().toISOString();
        await supabase
          .from("bav_aanmeldingen")
          .update({
            exact_status: "gesynchroniseerd",
            exact_relatie_id: relatieId,
            exact_abonnement_id: abonnementData.d.EntryID,
            exact_sync_op: syncOp,
          })
          .eq("id", aanmelding.id);

        await supabase
          .from("leads")
          .update({
            exact_status: "gesynchroniseerd",
            exact_relatie_id: relatieId,
            exact_abonnement_id: abonnementData.d.EntryID,
            exact_sync_op: syncOp,
          })
          .eq("id", lead.id);
      } catch (exactError) {
        const foutBericht =
          exactError instanceof Error ? exactError.message : "Onbekende fout";
        console.error("Exact sync failed:", foutBericht);
        await supabase
          .from("bav_aanmeldingen")
          .update({ exact_status: "gefaald", exact_fout: foutBericht })
          .eq("id", aanmelding.id);
        await supabase
          .from("leads")
          .update({ exact_status: "gefaald", exact_fout: foutBericht })
          .eq("id", lead.id);
      }
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

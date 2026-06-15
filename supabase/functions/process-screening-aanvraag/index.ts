import { createClient } from "npm:@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ScreeningSubmission {
  voornaam: string;
  achternaam: string;
  email: string;
  telefoon?: string;
  bedrijfsnaam?: string;
  kvk_nummer?: string;
  beroep?: string;
  sector?: string;
  screening_type: "basis" | "uitgebreid" | "compleet";
  notities?: string;
}

const PAKKET_LABELS: Record<string, string> = {
  basis: "Basis screening",
  uitgebreid: "Uitgebreide screening",
  compleet: "Complete screening",
};

// Helper voor latere Otentica-integratie — niet actief
// deno-lint-ignore no-unused-vars
function getChecksForType(type: string): string[] {
  switch (type) {
    case "basis":
      return ["identity", "kvk", "address"];
    case "uitgebreid":
      return ["identity", "kvk", "address", "vog", "reference", "diploma_duo"];
    case "compleet":
      return [
        "identity",
        "kvk",
        "address",
        "vog",
        "reference",
        "diploma_duo",
        "big_register",
        "professional_registration",
        "wet_dba_compliance",
      ];
    default:
      return [];
  }
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
    const data = (await req.json()) as ScreeningSubmission;

    // Basisvalidatie
    if (
      !data?.voornaam ||
      !data?.achternaam ||
      !data?.email ||
      !data?.screening_type ||
      !["basis", "uitgebreid", "compleet"].includes(data.screening_type)
    ) {
      return new Response(
        JSON.stringify({ success: false, error: "Ongeldige aanvraag" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pakketLabel = PAKKET_LABELS[data.screening_type];
    const volledigeNaam = `${data.voornaam} ${data.achternaam}`.trim();

    // 1. Insert in screening_aanvragen
    const { data: aanvraag, error: insertError } = await supabase
      .from("screening_aanvragen")
      .insert({
        voornaam: data.voornaam,
        achternaam: data.achternaam,
        email: data.email,
        telefoon: data.telefoon || null,
        bedrijfsnaam: data.bedrijfsnaam || null,
        kvk_nummer: data.kvk_nummer || null,
        beroep: data.beroep || null,
        sector: data.sector || null,
        screening_type: data.screening_type,
        notities: data.notities || null,
        status: "nieuw",
        otentica_status: "wachtend",
      })
      .select()
      .single();

    if (insertError) throw new Error(`Aanvraag insert: ${insertError.message}`);

    // 2. Mailnotificaties via Resend (+ logging in lead_notification_log)
    const leadType = `screening-${data.screening_type}`;
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

    const logEntry = async (entry: {
      recipient: string;
      subject: string;
      status: "sent" | "failed";
      resend_message_id?: string | null;
      error_message?: string | null;
    }) => {
      try {
        await supabase.from("lead_notification_log").insert({
          lead_type: leadType,
          lead_id: aanvraag.id,
          recipient: entry.recipient,
          subject: entry.subject,
          status: entry.status,
          resend_message_id: entry.resend_message_id ?? null,
          error_message: entry.error_message ?? null,
          metadata: { naam: volledigeNaam, email: data.email, pakket: data.screening_type },
        });
      } catch (e) {
        console.error("log insert failed:", e);
      }
    };

    if (RESEND_API_KEY) {
      const sendMail = async (to: string, subject: string, html: string) => {
        try {
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
              from: Deno.env.get("RESEND_FROM_ADDRESS") || "ZP Zaken <onboarding@resend.dev>",
              to: [to],
              subject,
              html,
            }),
          });
          const body = await res.json().catch(() => ({}));
          if (!res.ok) {
            await logEntry({ recipient: to, subject, status: "failed", error_message: `Resend ${res.status}: ${JSON.stringify(body)}` });
          } else {
            await logEntry({ recipient: to, subject, status: "sent", resend_message_id: body?.id ?? null });
          }
        } catch (err) {
          console.error(`Resend ${to} failed:`, err);
          await logEntry({ recipient: to, subject, status: "failed", error_message: err instanceof Error ? err.message : String(err) });
        }
      };

      // Naar info@zpzaken.nl
      const adminHtml = `
        <h2>Nieuwe screeningsaanvraag</h2>
        <p><strong>Pakket:</strong> ${pakketLabel}</p>
        <hr/>
        <p><strong>Naam:</strong> ${volledigeNaam}</p>
        <p><strong>E-mail:</strong> ${data.email}</p>
        <p><strong>Telefoon:</strong> ${data.telefoon || "-"}</p>
        <p><strong>Bedrijfsnaam:</strong> ${data.bedrijfsnaam || "-"}</p>
        <p><strong>KvK-nummer:</strong> ${data.kvk_nummer || "-"}</p>
        <p><strong>Beroep:</strong> ${data.beroep || "-"}</p>
        <p><strong>Sector:</strong> ${data.sector || "-"}</p>
        <p><strong>Notities:</strong> ${data.notities || "-"}</p>
        <hr/>
        <p>Aanvraag-ID: ${aanvraag.id}</p>
      `;
      await sendMail("info@zpzaken.nl", `Nieuwe screeningsaanvraag — ${pakketLabel}`, adminHtml);

      // Bevestiging naar aanvrager
      const klantHtml = `
        <h2>Bedankt voor je screeningsaanvraag, ${data.voornaam}!</h2>
        <p>We hebben je aanvraag voor de <strong>${pakketLabel}</strong> ontvangen.</p>
        <p>Een adviseur van ZP Zaken neemt binnen 24 uur contact met je op om de screening te bespreken en te starten.</p>
        <p>Heb je in de tussentijd vragen? Bel ons gerust op <strong>020 - 457 3077</strong> of mail naar <a href="mailto:info@zpzaken.nl">info@zpzaken.nl</a>.</p>
        <p>Met vriendelijke groet,<br/>Team ZP Zaken</p>
      `;
      await sendMail(data.email, "Aanvraag screening ontvangen — ZP Zaken", klantHtml);
    }

    // 3. OTENTICA API — ACTIVEREN NA ONTVANGST API KEY
    // const OTENTICA_API_KEY = Deno.env.get('OTENTICA_API_KEY')
    // const OTENTICA_BASE_URL = 'https://api.otentica.nl/v1'
    //
    // if (OTENTICA_API_KEY) {
    //   const response = await fetch(
    //     `${OTENTICA_BASE_URL}/flows`,
    //     {
    //       method: 'POST',
    //       headers: {
    //         'Authorization': `Bearer ${OTENTICA_API_KEY}`,
    //         'Content-Type': 'application/json'
    //       },
    //       body: JSON.stringify({
    //         candidate: {
    //           first_name: data.voornaam,
    //           last_name: data.achternaam,
    //           email: data.email,
    //         },
    //         checks: getChecksForType(data.screening_type),
    //         webhook_url: 'https://zpzaken.nl/api/otentica-webhook'
    //       })
    //     }
    //   )
    //   const flow = await response.json()
    //   await supabase
    //     .from('screening_aanvragen')
    //     .update({
    //       otentica_flow_id: flow.id,
    //       otentica_status: 'uitgenodigd'
    //     })
    //     .eq('id', aanvraag.id)
    // }

    return new Response(
      JSON.stringify({ success: true, aanvraag_id: aanvraag.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    console.error("process-screening-aanvraag error:", message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

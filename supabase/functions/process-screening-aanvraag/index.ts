import { createClient } from "npm:@supabase/supabase-js@2.39.0";
import { createMailGate } from "../_shared/mail.ts";
import { guardPublicSubmission } from "../_shared/antiSpam.ts";
import { isIntegratieEnabled } from "../_shared/integraties.ts";

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
  // Incasso-akkoord per dienst (geen doorlopende machtiging).
  iban?: string;
  rekeninghouder?: string;
  incasso_akkoord?: boolean;
}

const PAKKET_LABELS: Record<string, string> = {
  basis: "Basis screening",
  uitgebreid: "Uitgebreide screening",
  compleet: "Complete screening",
};

// Server-side prijslijst — single source of truth, client-bedragen worden nooit vertrouwd.
// Sync met de pakketten in src/pages/Screening.tsx.
const PAKKET_BEDRAGEN: Record<string, number> = {
  basis: 49,
  uitgebreid: 129,
  compleet: 179,
};

// IBAN-validatie (lengte + mod-97), zelfde strengheid als de BAV-aanmelding.
function isValidIban(raw: string): boolean {
  const iban = raw.replace(/\s/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) return false;
  const herschikt = iban.slice(4) + iban.slice(0, 4);
  const numeriek = herschikt.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let rest = 0;
  for (const cijfer of numeriek) rest = (rest * 10 + Number(cijfer)) % 97;
  return rest === 1;
}

function maskIban(raw: string): string {
  const iban = raw.replace(/\s/g, "").toUpperCase();
  return `${iban.slice(0, 4)}****${iban.slice(-2)}`;
}

// Checks per pakket; alleen gebruikt wanneer de Otentica-integratie AAN staat.
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

/**
 * Zet de eenmalige incasso van het screeningbedrag klaar in Exact Online.
 * Wordt uitsluitend aangeroepen wanneer integratie_config.exact_online.enabled = true.
 * Fouten hier mogen de aanvraag nooit laten mislukken; ze worden intern gelogd.
 */
// deno-lint-ignore no-explicit-any
async function syncScreeningNaarExact(supabase: any, aanvraag: any, bedrag: number, pakketLabel: string) {
  const TEST_MODE = Deno.env.get("EXACT_TEST_MODE") === "true";
  const BASE_URL = Deno.env.get("EXACT_BASE_URL") ?? "https://start.exactonline.nl";
  const environment = TEST_MODE ? "test" : "production";

  let { data: tokenRow } = await supabase
    .from("exact_tokens")
    .select("*")
    .eq("environment", environment)
    .maybeSingle();

  if (!tokenRow) throw new Error("Geen Exact token aanwezig — autoriseer eerst via /admin/integraties");

  if (new Date(tokenRow.expires_at).getTime() - Date.now() < 60_000) {
    const refreshRes = await supabase.functions.invoke("exact-refresh-token");
    if (refreshRes.error) throw new Error(`Token refresh: ${refreshRes.error.message}`);
    const { data: fresh } = await supabase
      .from("exact_tokens").select("*").eq("environment", environment).maybeSingle();
    if (fresh) tokenRow = fresh;
  }

  const divisionCode = tokenRow.division_code;
  const apiHeaders = {
    Authorization: `Bearer ${tokenRow.access_token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  const relatieNaam = TEST_MODE
    ? `TEST_${aanvraag.bedrijfsnaam || `${aanvraag.voornaam} ${aanvraag.achternaam}`}`
    : aanvraag.bedrijfsnaam || `${aanvraag.voornaam} ${aanvraag.achternaam}`;

  const accountRes = await fetch(`${BASE_URL}/api/v1/${divisionCode}/crm/Accounts`, {
    method: "POST",
    headers: apiHeaders,
    body: JSON.stringify({
      Name: relatieNaam,
      Email: aanvraag.email,
      Phone: aanvraag.telefoon,
      ChamberOfCommerce: aanvraag.kvk_nummer,
      Country: "NL",
      Status: "C",
      IsSales: true,
    }),
  });
  if (!accountRes.ok) throw new Error(`Account ${accountRes.status}: ${await accountRes.text()}`);
  const accountId = (await accountRes.json()).d.ID;

  // Bankrekening + eenmalig mandaat vastleggen bij de relatie, zodat Exact de
  // incasso van dit screeningbedrag kan uitvoeren.
  if (aanvraag.iban) {
    const bankRes = await fetch(`${BASE_URL}/api/v1/${divisionCode}/crm/BankAccounts`, {
      method: "POST",
      headers: apiHeaders,
      body: JSON.stringify({
        Account: accountId,
        IBAN: String(aanvraag.iban).replace(/\s/g, "").toUpperCase(),
        BankAccountHolderName: aanvraag.rekeninghouder || relatieNaam,
        Main: true,
      }),
    });
    if (!bankRes.ok) throw new Error(`BankAccount ${bankRes.status}: ${await bankRes.text()}`);
  }

  const itemId = Deno.env.get("EXACT_ITEM_ID_SCREENING");
  if (!itemId) throw new Error("EXACT_ITEM_ID_SCREENING ontbreekt — geen artikel gekoppeld voor screening");

  const invoiceRes = await fetch(`${BASE_URL}/api/v1/${divisionCode}/salesinvoice/SalesInvoices`, {
    method: "POST",
    headers: apiHeaders,
    body: JSON.stringify({
      OrderedBy: accountId,
      InvoiceTo: accountId,
      Description: `${pakketLabel} — ${relatieNaam}`,
      PaymentCondition: Deno.env.get("EXACT_PAYMENT_CONDITION_INCASSO") ?? undefined,
      SalesInvoiceLines: [
        { Item: itemId, Quantity: 1, AmountFC: bedrag, Description: pakketLabel },
      ],
    }),
  });
  if (!invoiceRes.ok) throw new Error(`SalesInvoice ${invoiceRes.status}: ${await invoiceRes.text()}`);
  const invoiceJson = await invoiceRes.json();
  const invoiceId = invoiceJson?.d?.InvoiceID ?? invoiceJson?.d?.ID ?? null;

  await supabase
    .from("screening_aanvragen")
    .update({
      exact_status: "gesynchroniseerd",
      exact_relatie_id: accountId,
      exact_transactie_id: invoiceId,
      exact_sync_op: new Date().toISOString(),
      exact_fout: null,
      incasso_status: "in_behandeling",
    })
    .eq("id", aanvraag.id);
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

    // Incasso-akkoord is per dienst verplicht: zonder expliciet akkoord én geldig IBAN
    // geen aanvraag. Geen doorlopende blanco machtiging.
    if (data.incasso_akkoord !== true) {
      return new Response(
        JSON.stringify({ success: false, error: "Incasso-akkoord is verplicht" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const ibanSchoon = (data.iban ?? "").replace(/\s/g, "").toUpperCase();
    if (!ibanSchoon || !isValidIban(ibanSchoon)) {
      return new Response(
        JSON.stringify({ success: false, error: "Ongeldig IBAN" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Anti-spam: honeypot, invultijd en IP-limiet.
    const guard = await guardPublicSubmission(req, supabase, {
      hp: (data as Record<string, unknown>).hp,
      ms: (data as Record<string, unknown>).ms,
      kind: "screening",
    });
    if (!guard.ok) {
      return new Response(
        JSON.stringify({ success: false, error: guard.error, reason: guard.reason }),
        { status: guard.status ?? 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }


    const pakketLabel = PAKKET_LABELS[data.screening_type];
    const bedrag = PAKKET_BEDRAGEN[data.screening_type];
    const volledigeNaam = `${data.voornaam} ${data.achternaam}`.trim();
    const rekeninghouder = (data.rekeninghouder ?? "").trim() || volledigeNaam;

    // 1. Insert in screening_aanvragen (IBAN alleen in de eigen kolom, nooit in vrije tekst)
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
        iban: ibanSchoon,
        rekeninghouder,
        incasso_akkoord: true,
        incasso_akkoord_op: new Date().toISOString(),
        bedrag,
        incasso_status: "handmatig_te_verwerken",
        exact_status: "wachtend",
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

    // Omgevingsbepaling + preview-redirect (max. één mail per verzendactie).
    const gate = createMailGate("process-screening-aanvraag", req);

    if (RESEND_API_KEY) {
      const sendMail = async (to: string, subject: string, html: string) => {
        const plan = gate.plan({ to, subject, html });
        if (!plan.send) return;
        try {
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
              from: plan.from,
              to: plan.to,
              subject: plan.subject,
              html: plan.html,
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
        <p><strong>Bedrag:</strong> € ${bedrag},-</p>
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
        <p><strong>Incasso-akkoord:</strong> gegeven op ${new Date().toLocaleString("nl-NL")} (rekening ${maskIban(ibanSchoon)}, t.n.v. ${rekeninghouder})</p>
        <p>Aanvraag-ID: ${aanvraag.id}</p>
      `;
      await sendMail("info@zpzaken.nl", `Nieuwe screeningsaanvraag: ${pakketLabel}`, adminHtml);

      // Bevestiging naar aanvrager
      const klantHtml = `
        <h2>Bedankt voor je screeningsaanvraag, ${data.voornaam}!</h2>
        <p>We hebben je aanvraag voor de <strong>${pakketLabel}</strong> ontvangen.</p>
        <p>Je hebt akkoord gegeven voor een eenmalige incasso van <strong>€ ${bedrag},-</strong> van rekening <strong>${maskIban(ibanSchoon)}</strong> voor deze screening. Dit akkoord geldt alleen voor deze aanvraag; er wordt niets doorlopend afgeschreven.</p>
        <p>We nemen binnen 24 uur contact met je op om de screening te starten.</p>
        <p>Heb je in de tussentijd vragen? Bel ons gerust op <strong>020 - 457 3077</strong> of mail naar <a href="mailto:info@zpzaken.nl">info@zpzaken.nl</a>.</p>
        <p>Met vriendelijke groet,<br/>Team ZP Zaken</p>
      `;
      await sendMail(data.email, "Aanvraag screening ontvangen | ZP Zaken", klantHtml);
    }

    // 3. INCASSO VIA EXACT ONLINE — staat standaard UIT
    // (integratie_config.exact_online.enabled = false). Zolang de vlag uit staat wordt
    // er niets naar Exact gestuurd: het akkoord en de gegevens zijn vastgelegd en de
    // incasso blijft op 'handmatig_te_verwerken' staan. De klant merkt hier niets van.
    const exactAan = await isIntegratieEnabled(supabase, "exact_online");
    if (exactAan) {
      try {
        await syncScreeningNaarExact(supabase, aanvraag, bedrag, pakketLabel);
      } catch (e) {
        const fout = e instanceof Error ? e.message : "Onbekende fout";
        console.error("Exact-incasso screening mislukt (aanvraag blijft staan):", fout);
        await supabase
          .from("screening_aanvragen")
          .update({ exact_status: "gefaald", exact_fout: fout, incasso_status: "handmatig_te_verwerken" })
          .eq("id", aanvraag.id);
      }
    } else {
      console.log("Exact Online-integratie staat uit — incasso wordt handmatig verwerkt.");
    }

    // 4. OTENTICA — staat standaard UIT (integratie_config.otentica.enabled = false).
    // Zolang de vlag uit staat wordt er niets naar Otentica gestuurd en blijft de
    // aanvraag gewoon in de normale handmatige behandeling. Een fout in deze stap
    // mag de aanvraag nooit laten mislukken.
    const otenticaAan = await isIntegratieEnabled(supabase, "otentica");
    const OTENTICA_API_KEY = Deno.env.get("OTENTICA_API_KEY");

    if (otenticaAan && OTENTICA_API_KEY) {
      try {
        const res = await fetch("https://api.otentica.nl/v1/flows", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OTENTICA_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            candidate: {
              first_name: data.voornaam,
              last_name: data.achternaam,
              email: data.email,
            },
            checks: getChecksForType(data.screening_type),
            webhook_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/otentica-webhook`,
          }),
        });
        const flow = await res.json().catch(() => ({}));
        if (res.ok && flow?.id) {
          await supabase
            .from("screening_aanvragen")
            .update({ otentica_flow_id: flow.id, otentica_status: "uitgenodigd" })
            .eq("id", aanvraag.id);
        } else {
          console.error("Otentica flow niet aangemaakt:", res.status, JSON.stringify(flow));
        }
      } catch (e) {
        console.error("Otentica-aanroep mislukt (aanvraag blijft staan):", e);
      }
    } else if (!otenticaAan) {
      console.log("Otentica-integratie staat uit — geen externe aanroep gedaan.");
    }

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

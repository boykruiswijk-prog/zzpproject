import { normaliseerAdres } from "../_shared/adresNormalisatie.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { createMailGate } from "../_shared/mail.ts";
import { guardPublicSubmission } from "../_shared/antiSpam.ts";
import { isIntegratieEnabled } from "../_shared/integraties.ts";
import {
  KLANTMELDING_INCASSANT_ONTBREEKT,
  bouwMachtigingData,
  incassantIdOntbreekt,
  legBewijsVast,
  ontbrekendeAdresvelden,
  verstuurMachtigingBevestiging,
} from "../_shared/sepaBewijs.ts";
import { isUuid, mandaatkenmerkVoor, redenScreening } from "../_shared/sepaMachtiging.ts";

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
  // Adres rekeninghouder (verplicht voor de SEPA-machtiging).
  adres_straat?: string;
  adres_huisnummer?: string;
  adres_postcode?: string;
  adres_plaats?: string;
  adres_land?: string;
  // Vooraf (client-side) gegenereerde aanvraag-UUID; basis voor het mandaatkenmerk.
  aanvraag_id?: string;
  client_akkoord_op?: string;
  pagina_url?: string;
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

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character] ?? character);
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

    // SEPA-machtiging: nooit vastleggen zonder incassant-ID.
    if (incassantIdOntbreekt()) {
      console.error("process-screening-aanvraag: COMPANY.incassantId is leeg — aanvraag geweigerd, geen machtiging vastgelegd.");
      return new Response(
        JSON.stringify({ success: false, error: KLANTMELDING_INCASSANT_ONTBREEKT, reason: "incassant_id_ontbreekt" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    // Normaliseren vóór validatie en legBewijsVast.
    const adres = normaliseerAdres({
      straat: data.adres_straat ?? "",
      huisnummer: data.adres_huisnummer ?? "",
      postcode: data.adres_postcode ?? "",
      plaats: data.adres_plaats ?? "",
      land: data.adres_land ?? "",
    });
    const machtigingFout =
      !isUuid(data.aanvraag_id) ? "Ongeldig aanvraagkenmerk"
      : !(data.rekeninghouder ?? "").trim() ? "Naam rekeninghouder is verplicht"
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
      hp: (data as unknown as Record<string, unknown>).hp,
      ms: (data as unknown as Record<string, unknown>).ms,
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
    const rekeninghouder = (data.rekeninghouder ?? "").trim();
    const aanvraagId = data.aanvraag_id as string;

    // 0. Bewijsrecord SEPA-machtiging (eerst; faalt dit, dan faalt de aanvraag)
    const machtiging = bouwMachtigingData({
      type: "eenmalig",
      bronId: aanvraagId,
      reden: redenScreening(pakketLabel, bedrag),
      debiteurNaam: rekeninghouder,
      debiteurAdres: adres,
      iban: ibanSchoon,
    });
    const bewijs = await legBewijsVast(supabase, req, {
      dienst: "screening",
      bronTabel: "screening_aanvragen",
      bronId: aanvraagId,
      data: machtiging,
      clientAkkoordOp: data.client_akkoord_op,
      paginaUrl: data.pagina_url,
    });

    // 1. Insert in screening_aanvragen (IBAN alleen in de eigen kolom, nooit in vrije tekst)
    const { data: aanvraag, error: insertError } = await supabase
      .from("screening_aanvragen")
      .insert({
        id: aanvraagId,
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
        incasso_akkoord_op: bewijs.akkoord_op,
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
        <p><strong>Naam:</strong> ${escapeHtml(volledigeNaam)}</p>
        <p><strong>E-mail:</strong> ${escapeHtml(data.email)}</p>
        <p><strong>Telefoon:</strong> ${escapeHtml(data.telefoon || "-")}</p>
        <p><strong>Bedrijfsnaam:</strong> ${escapeHtml(data.bedrijfsnaam || "-")}</p>
        <p><strong>KvK-nummer:</strong> ${escapeHtml(data.kvk_nummer || "-")}</p>
        <p><strong>Beroep:</strong> ${escapeHtml(data.beroep || "-")}</p>
        <p><strong>Sector:</strong> ${escapeHtml(data.sector || "-")}</p>
        <p><strong>Notities:</strong> ${escapeHtml(data.notities || "-")}</p>
        <hr/>
        <p><strong>Incasso-akkoord:</strong> gegeven op ${new Date().toLocaleString("nl-NL")} (rekening ${maskIban(ibanSchoon)}, t.n.v. ${rekeninghouder})</p>
        <p>Aanvraag-ID: ${aanvraag.id}</p>
      `;
      await sendMail("info@zpzaken.nl", `Nieuwe screeningsaanvraag: ${pakketLabel}`, adminHtml);

      // Bevestiging naar aanvrager
      const klantHtml = `
        <h2>Bedankt voor je screeningsaanvraag, ${escapeHtml(data.voornaam)}!</h2>
        <p>We hebben je aanvraag voor de <strong>${pakketLabel}</strong> ontvangen.</p>
        <p>Je hebt akkoord gegeven voor een eenmalige incasso van <strong>€ ${bedrag},-</strong> van rekening <strong>${maskIban(ibanSchoon)}</strong> voor deze screening. Dit akkoord geldt alleen voor deze aanvraag; er wordt niets doorlopend afgeschreven.</p>
        <p>We nemen binnen 24 uur contact met je op om de screening te starten.</p>
        <p>Heb je in de tussentijd vragen? Bel ons gerust op <strong>020 - 457 3077</strong> of mail naar <a href="mailto:info@zpzaken.nl">info@zpzaken.nl</a>.</p>
        <p>Met vriendelijke groet,<br/>Team ZP Zaken</p>
      `;
      await sendMail(data.email, "Aanvraag screening ontvangen | ZP Zaken", klantHtml);
    }

    // 2b. Bevestiging SEPA-machtiging (PDF + mail; faalt nooit hard)
    await verstuurMachtigingBevestiging(supabase, req, {
      fnName: "process-screening-aanvraag",
      leadType: "screening-sepa-machtiging",
      record: bewijs,
      data: machtiging,
      email: data.email,
      aanhef: volledigeNaam,
      bedragOfReden: machtiging.reden,
    });

    // Exact-verwerking gebeurt nooit vanuit deze openbare formulierroute.
    // De aanvraag blijft handmatig te verwerken voor een afzonderlijke, beveiligde teamactie.
    console.log("Screeningsincasso is opgeslagen voor handmatige verwerking.");

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

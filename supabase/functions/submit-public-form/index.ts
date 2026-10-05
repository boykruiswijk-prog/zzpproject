// Enige schrijfroute voor publieke formulieren (leads, pilots, nieuwsbrief, suggesties).
// Beschermd met honeypot, invultijd-check en IP-throttle. De browser mag deze
// tabellen niet meer direct beschrijven.
import { createClient } from "npm:@supabase/supabase-js@2";
import { guardPublicSubmission } from "../_shared/antiSpam.ts";
import { normaliseerAdres } from "../_shared/adresNormalisatie.ts";
import { samenvattingVoorTeam } from "../_shared/zeker.ts";
import { saneerFormulier, saneerPagina } from "../_shared/leadVelden.ts";
import { resolveEnvironment } from "../_shared/environment.ts";
import { saneerAttributie } from "../_shared/attributie.ts";
import { isNlTelefoon, normaliseerNlTelefoon } from "../_shared/telefoon.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Per tabel: toegestane kolommen. Al het overige uit de body wordt weggegooid. */
const ALLOWED: Record<string, { kind: string; columns: string[]; maxLen?: number }> = {
  leads: {
    kind: "lead",
    columns: [
      "id", "type", "voornaam", "achternaam", "email", "telefoon", "geboortedatum",
      "bedrijfsnaam", "kvk_nummer", "beroep", "omzet", "branche", "verzekering_type",
      "verzekerd_bedrag", "eigen_risico", "ingangsdatum", "opmerkingen",
      "adres_straat", "adres_huisnummer", "adres_postcode", "adres_plaats",
      "gekozen_pakket", "extra_data", "vereist_handmatige_beoordeling",
    ],
  },
  collective_signups: {
    kind: "pilot",
    columns: ["pilot_slug", "naam", "email", "telefoon", "postcode", "type", "huidige_leverancier", "interesse_gebieden"],
  },
  collective_newsletter: {
    kind: "newsletter",
    columns: ["email"],
  },
  collective_suggestions: {
    kind: "suggestion",
    columns: ["suggestie", "naam", "email"],
  },
};

const ALLOWED_LEAD_TYPES = ["contact", "verzekering_aanvraag", "offerte-aanvraag"];
const MAX_TEXT_LEN = 5000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function clean(value: unknown): unknown {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > MAX_TEXT_LEN ? trimmed.slice(0, MAX_TEXT_LEN) : trimmed;
  }
  return value;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const kort = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

/**
 * Halve BAV-aanvraag (aanvraag_concepten). Idempotent op het concept-id uit de browser.
 * Alleen contact-, bedrijfs- en pakketvelden; IBAN, rekeninghouder en SEPA worden nooit overgenomen.
 * Omgezette of geanonimiseerde concepten worden nooit overschreven.
 */
async function bewaarConcept(req: Request, body: any, json: (b: unknown, s?: number) => Response): Promise<Response> {
  const row = body?.row && typeof body.row === "object" ? body.row as Record<string, unknown> : null;
  if (!row || typeof row.id !== "string" || !UUID_RE.test(row.id)) return json({ success: false, error: "Ongeldige aanvraag." }, 400);
  const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  const guard = await guardPublicSubmission(req, supabase, { hp: body?.hp, kind: "concept" });
  if (!guard.ok) return json({ success: false, error: guard.error, reason: guard.reason }, guard.status ?? 400);

  const emailRaw = kort(row.email, 255)?.toLowerCase() ?? null;
  const email = emailRaw && EMAIL_RE.test(emailRaw) ? emailRaw : null;
  const telRaw = kort(row.telefoon, 30);
  const telefoon = telRaw && isNlTelefoon(telRaw) ? normaliseerNlTelefoon(telRaw) : null;
  if (!email && !telefoon) return json({ success: false, error: "Geldig e-mailadres of telefoonnummer nodig." }, 400);
  const stap = Math.min(5, Math.max(1, Math.trunc(Number(row.stap) || 1)));

  const { data: bestaand } = await supabase.from("aanvraag_concepten").select("id, status, geanonimiseerd_op, attributie").eq("id", row.id).maybeSingle();
  if (bestaand && (bestaand.status === "omgezet" || bestaand.geanonimiseerd_op)) return json({ success: true, id: row.id, already: true });

  const payload: Record<string, unknown> = {
    id: row.id, stap, email, telefoon, laatst_actief_op: new Date().toISOString(),
    voornaam: kort(row.voornaam, 100), achternaam: kort(row.achternaam, 100), bedrijfsnaam: kort(row.bedrijfsnaam, 200),
    kvk: kort(row.kvk, 20), pakket: kort(row.pakket, 50), sector: kort(row.sector, 100), pagina: saneerPagina(row.pagina),
  };
  if (bestaand) {
    for (const k of Object.keys(payload)) if (payload[k] === null) delete payload[k];
    // Later gegeven toestemming kan klik-ID's toevoegen; bestaande velden blijven staan.
    const nieuw = saneerAttributie(body?.attributie);
    if (nieuw) {
      const oud = (bestaand.attributie && typeof bestaand.attributie === "object") ? bestaand.attributie as Record<string, unknown> : {};
      payload.attributie = saneerAttributie({ ...oud, ...nieuw, eerste_bezoek_op: oud.eerste_bezoek_op ?? nieuw.eerste_bezoek_op, landingspagina: oud.landingspagina ?? nieuw.landingspagina });
    }
  } else {
    payload.attributie = saneerAttributie(body?.attributie);
    payload.is_test = !resolveEnvironment(req).isProduction;
  }
  const { error } = await supabase.from("aanvraag_concepten").upsert(payload, { onConflict: "id" });
  if (error) {
    console.error("submit-public-form: concept opslaan mislukt:", error.message);
    return json({ success: false, error: "Opslaan mislukt." }, 500);
  }
  return json({ success: true, id: row.id });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const body = await req.json().catch(() => ({}));
    const table = typeof body?.table === "string" ? body.table : "";
    if (table === "aanvraag_concepten") return await bewaarConcept(req, body, json);
    const spec = ALLOWED[table];
    if (!spec) return json({ success: false, error: "Onbekend formulier." }, 400);

    const row = body?.row && typeof body.row === "object" ? body.row as Record<string, unknown> : null;
    if (!row) return json({ success: false, error: "Ongeldige aanvraag." }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const guard = await guardPublicSubmission(req, supabase, {
      hp: body?.hp,
      ms: body?.ms,
      kind: spec.kind,
    });
    if (!guard.ok) return json({ success: false, error: guard.error, reason: guard.reason }, guard.status ?? 400);

    // Alleen toegestane kolommen overnemen.
    const payload: Record<string, unknown> = {};
    for (const col of spec.columns) {
      if (row[col] !== undefined) payload[col] = clean(row[col]);
    }

    // Terugbelverzoek vanuit chatassistent Zeker: sessie moet bestaan; samenvatting en
    // testmarkering bepaalt de server uit de opgeslagen chat, nooit de browser.
    const extraIn = (payload.extra_data && typeof payload.extra_data === "object") ? payload.extra_data as Record<string, unknown> : null;
    const chatSessieId = table === "leads" && extraIn?.bron === "chat-zeker" && typeof extraIn.chat_sessie_id === "string" &&
      /^[0-9a-f-]{36}$/i.test(extraIn.chat_sessie_id) ? extraIn.chat_sessie_id : null;
    let chatSessie: { id: string; is_test: boolean } | null = null;
    if (table === "leads" && extraIn?.bron === "chat-zeker") {
      if (!chatSessieId) return json({ success: false, error: "Ongeldige aanvraag." }, 400);
      const { data: s } = await supabase.from("chat_sessions").select("id, is_test, lead_id").eq("id", chatSessieId).maybeSingle();
      if (!s) return json({ success: false, error: "Ongeldige aanvraag." }, 400);
      if (s.lead_id) return json({ success: true, id: s.lead_id, already: true });
      chatSessie = s;
      const tel = String(payload.telefoon ?? "").replace(/[^\d+]/g, "");
      if (tel.replace(/\D/g, "").length < 10) return json({ success: false, error: "Vul een geldig telefoonnummer in." }, 400);
      if (extraIn.toestemming !== true) return json({ success: false, error: "Toestemming is verplicht." }, 400);
      payload.type = "contact";
    }

    // Compact terugbelverzoek (naam + telefoon): e-mail optioneel, telefoon en toestemming verplicht.
    const isTerugbel = table === "leads" && !chatSessie && extraIn?.formulier_naam === "Terugbelverzoek";
    if (isTerugbel) {
      const tel = String(payload.telefoon ?? "");
      if (!isNlTelefoon(tel)) return json({ success: false, error: "Vul een geldig telefoonnummer in." }, 400);
      if (extraIn?.toestemming !== true) return json({ success: false, error: "Toestemming is verplicht." }, 400);
      payload.telefoon = normaliseerNlTelefoon(tel);
      payload.type = "contact";
    }

    // E-mail is voor elk formulier verplicht behalve de suggestiebox (en optioneel bij een terugbelverzoek).
    const email = typeof payload.email === "string" ? payload.email.toLowerCase() : "";
    if (table === "collective_suggestions") {
      if (email && !EMAIL_RE.test(email)) return json({ success: false, error: "Ongeldig e-mailadres." }, 400);
      if (!payload.suggestie) return json({ success: false, error: "Vul een suggestie in." }, 400);
      if (email) payload.email = email;
    } else if ((chatSessie || isTerugbel) && !email) {
      payload.email = "";
    } else {
      if (!EMAIL_RE.test(email)) return json({ success: false, error: "Ongeldig e-mailadres." }, 400);
      payload.email = email;
    }

    if (table === "leads") {
      if (!payload.voornaam || !payload.achternaam) {
        return json({ success: false, error: "Naam is verplicht." }, 400);
      }
      if (!ALLOWED_LEAD_TYPES.includes(String(payload.type))) {
        return json({ success: false, error: "Onbekend aanvraagtype." }, 400);
      }
      // Bron en statusvelden zet de server, niet de browser.
      payload.bron = "website";
      // Adresnormalisatie (hoofdletter straat/plaats, NL-postcode "1234 AB").
      const extra = (payload.extra_data && typeof payload.extra_data === "object") ? payload.extra_data as Record<string, unknown> : null;
      const land = typeof extra?.adres_land === "string" ? extra.adres_land : null;
      const n = normaliseerAdres({
        straat: payload.adres_straat as string | undefined, huisnummer: payload.adres_huisnummer as string | undefined,
        postcode: payload.adres_postcode as string | undefined, plaats: payload.adres_plaats as string | undefined, land,
      });
      for (const [k, v] of [["adres_straat", n.straat], ["adres_huisnummer", n.huisnummer], ["adres_postcode", n.postcode], ["adres_plaats", n.plaats]] as const) {
        if (payload[k] !== undefined && payload[k] !== null) payload[k] = v || null;
      }
      // Volledige formulierinhoud (geordende lijst label → waarde) + formuliernaam en pagina.
      const extraUit: Record<string, unknown> = { ...(extra ?? {}) };
      const formulier = saneerFormulier(extraUit.formulier);
      if (formulier.length) extraUit.formulier = formulier; else delete extraUit.formulier;
      extraUit.formulier_naam = typeof extraUit.formulier_naam === "string" ? extraUit.formulier_naam.slice(0, 100) : null;
      extraUit.pagina = saneerPagina(extraUit.pagina);
      // Herkomst (utm/gclid/referrer/landingspagina) uitsluitend uit het aparte veld, opgeschoond.
      delete extraUit.attributie;
      const attributie = saneerAttributie(body?.attributie);
      if (attributie) extraUit.attributie = attributie;
      payload.extra_data = extraUit;
      // Inzendingen vanuit preview/testomgeving zijn altijd testrecords (zelfde regel als chat Zeker).
      payload.is_test = !resolveEnvironment(req).isProduction;
      if (typeof extraUit.adres_postcode === "string") extraUit.adres_postcode = n.postcode || normaliseerAdres({ postcode: extraUit.adres_postcode, land }).postcode;
    }

    let chatSamenvatting = "";
    if (chatSessie) {
      const { data: rijen } = await supabase.from("chat_messages").select("rol, tekst").eq("sessie_id", chatSessie.id).order("created_at").limit(80);
      chatSamenvatting = samenvattingVoorTeam((rijen ?? []) as any);
      const extra = payload.extra_data as Record<string, unknown>;
      const moment = String(extra.voorkeursmoment ?? "").slice(0, 100);
      payload.extra_data = { bron: "chat-zeker", chat_sessie_id: chatSessie.id, voorkeursmoment: moment, toestemming: true, toestemming_op: new Date().toISOString(),
        formulier: extra.formulier, formulier_naam: extra.formulier_naam, pagina: extra.pagina,
        ...(extra.attributie ? { attributie: extra.attributie } : {}) };
      payload.opmerkingen = `Terugbelverzoek via chatassistent Zeker.\nVoorkeursmoment: ${moment || "-"}\nVraag: ${String(payload.opmerkingen ?? "-").slice(0, 1000)}\n\nSamenvatting chat:\n${chatSamenvatting}`;
      payload.is_test = chatSessie.is_test;
    }

    if (table === "collective_signups" && !payload.naam) {
      return json({ success: false, error: "Naam is verplicht." }, 400);
    }

    const { data, error } = await supabase.from(table).insert(payload).select("id").single();
    if (error) {
      console.error(`submit-public-form: insert in ${table} mislukt:`, error.message);
      return json({ success: false, error: "Opslaan mislukt. Probeer het opnieuw." }, 500);
    }

    if (chatSessie && data?.id) {
      await supabase.from("chat_sessions").update({ lead_id: data.id }).eq("id", chatSessie.id);
      // Teammail via de bestaande notificatieroute (zelfde productie/preview-regels; Origin wordt doorgegeven).
      try {
        const secret = Deno.env.get("INTERNAL_FUNCTION_SECRET") ?? "";
        await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-lead-notification`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json", "x-internal-secret": secret,
            ...(req.headers.get("origin") ? { origin: req.headers.get("origin")! } : {}),
            Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY") ?? ""}`,
          },
          body: JSON.stringify({
            type: "terugbelverzoek-chat", leadId: data.id, reference: `${payload.voornaam} ${payload.achternaam}`,
            userEmail: payload.email || null,
            fields: {
              naam: `${payload.voornaam} ${payload.achternaam}`, telefoon: payload.telefoon, email: payload.email || "-",
              voorkeursmoment: (payload.extra_data as any).voorkeursmoment || "-", bron: "chat-zeker",
              samenvatting_chat: chatSamenvatting || "-",
            },
          }),
        });
      } catch (e) {
        console.error("submit-public-form: teammail chat mislukt", e instanceof Error ? e.message : e);
      }
    }

    // Compact terugbelverzoek: interne melding (info@ + Boy) server-side via de contactroute, nooit een klantmail.
    if (isTerugbel && data?.id) {
      try {
        await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-notification`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY") ?? ""}`,
            ...(req.headers.get("origin") ? { origin: req.headers.get("origin")! } : {}) },
          body: JSON.stringify({ type: "contact", lead_id: data.id }),
        });
      } catch (e) {
        console.error("submit-public-form: teammail terugbel mislukt", e instanceof Error ? e.message : e);
      }
    }

    return json({ success: true, id: data?.id ?? payload.id ?? null });
  } catch (err) {
    console.error("submit-public-form error:", err instanceof Error ? err.message : err);
    return json({ success: false, error: "Er ging iets mis. Probeer het opnieuw." }, 500);
  }
});

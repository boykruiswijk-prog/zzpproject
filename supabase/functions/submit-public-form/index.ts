// Enige schrijfroute voor publieke formulieren (leads, pilots, nieuwsbrief, suggesties).
// Beschermd met honeypot, invultijd-check en IP-throttle. De browser mag deze
// tabellen niet meer direct beschrijven.
import { createClient } from "npm:@supabase/supabase-js@2.39.0";
import { guardPublicSubmission } from "../_shared/antiSpam.ts";

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

    // E-mail is voor elk formulier verplicht behalve de suggestiebox.
    const email = typeof payload.email === "string" ? payload.email.toLowerCase() : "";
    if (table === "collective_suggestions") {
      if (email && !EMAIL_RE.test(email)) return json({ success: false, error: "Ongeldig e-mailadres." }, 400);
      if (!payload.suggestie) return json({ success: false, error: "Vul een suggestie in." }, 400);
      if (email) payload.email = email;
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
    }

    if (table === "collective_signups" && !payload.naam) {
      return json({ success: false, error: "Naam is verplicht." }, 400);
    }

    const { data, error } = await supabase.from(table).insert(payload).select("id").single();
    if (error) {
      console.error(`submit-public-form: insert in ${table} mislukt:`, error.message);
      return json({ success: false, error: "Opslaan mislukt. Probeer het opnieuw." }, 500);
    }

    return json({ success: true, id: data?.id ?? payload.id ?? null });
  } catch (err) {
    console.error("submit-public-form error:", err instanceof Error ? err.message : err);
    return json({ success: false, error: "Er ging iets mis. Probeer het opnieuw." }, 500);
  }
});

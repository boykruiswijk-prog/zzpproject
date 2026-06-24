// Polis-lifecycle: pauzeren / hervatten / opzeggen / heractiveren
// Eén endpoint, dispatch op `action`. Logt elke actie in polis_audit_log.
// Stuurt email naar klant + info@zpzaken.nl en (bij relevante acties) info@onefellow.nl.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { checkAcceptance } from "../_shared/acceptanceCriteria.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const ADMIN_EMAIL = "info@zpzaken.nl";
const ONEFELLOW_EMAIL = "info@onefellow.nl";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
// Fallback naar onboarding@resend.dev zolang zpzaken.nl-DNS niet geverifieerd is.
const FROM_ADDRESS = Deno.env.get("RESEND_FROM_ADDRESS") || "ZP Zaken <onboarding@resend.dev>";

// Pakket → jaarprijs (voor pro-rata creditnota)
const PAKKET_JAARPRIJS: Record<string, number> = {
  "maandelijks": 660,
  "jaarlijks": 600,
  "jaarlijks-cyber": 750,
  "jaarlijks_cyber": 750,
};

function checkFunctieAcceptabel(functie: string): { acceptabel: boolean; reden?: string } {
  const res = checkAcceptance(functie);
  return { acceptabel: res.accepted, reden: res.reason };
}

function normalizeFunctie(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}


// deno-lint-ignore no-explicit-any
async function logAudit(supabase: any, params: {
  lead_id: string;
  actie: string;
  uitgevoerd_door: string | null;
  rol: string;
  details?: Record<string, unknown>;
  exact_response?: unknown;
  succes?: boolean;
  fout_melding?: string | null;
}) {
  try {
    await supabase.from("polis_audit_log").insert({
      lead_id: params.lead_id,
      actie: params.actie,
      uitgevoerd_door: params.uitgevoerd_door,
      rol: params.rol,
      details: params.details ?? {},
      exact_response: params.exact_response ?? null,
      succes: params.succes ?? true,
      fout_melding: params.fout_melding ?? null,
    });
  } catch (e) {
    console.error("logAudit failed", e);
  }
}

async function sendMail(to: string | string[], subject: string, html: string): Promise<{ ok: boolean; status?: number; message_id?: string; error?: string; to: string[] }> {
  const recipients = Array.isArray(to) ? to : [to];
  if (!RESEND_API_KEY) {
    console.warn("RESEND_API_KEY ontbreekt — mail overgeslagen", { to: recipients, subject });
    return { ok: false, error: "missing_resend_key", to: recipients };
  }
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({ from: FROM_ADDRESS, to: recipients, subject, html }),
    });
    const txt = await r.text();
    let parsed: any = null;
    try { parsed = JSON.parse(txt); } catch (_) { /* */ }
    if (!r.ok) {
      console.error("Resend error", r.status, txt);
      return { ok: false, status: r.status, error: txt.slice(0, 400), to: recipients };
    }
    console.log("Resend ok", { to: recipients, subject, id: parsed?.id, from: FROM_ADDRESS });
    return { ok: true, status: r.status, message_id: parsed?.id, to: recipients };
  } catch (e: any) {
    console.error("sendMail exception", e);
    return { ok: false, error: e?.message ?? String(e), to: recipients };
  }
}

function mailShell(title: string, body: string): string {
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f5f5f5;padding:24px;color:#222">
    <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;padding:32px;border:1px solid #e5e5e5">
      <h2 style="color:#E53E2F;margin:0 0 16px">${title}</h2>
      ${body}
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
      <p style="font-size:12px;color:#888;margin:0">ZP Zaken B.V. · AFM 12050363 · info@zpzaken.nl · 020-4573077</p>
    </div></body></html>`;
}

// ── Exact creditnota ──────────────────────────────────────────────────────
// deno-lint-ignore no-explicit-any
async function ensureValidToken(supabase: any, config: any): Promise<string> {
  const baseUrl = config.base_url || "https://start.exactonline.nl";
  const expiresAt = config.access_token_expires_at ? new Date(config.access_token_expires_at) : new Date(0);
  if (expiresAt.getTime() - Date.now() > 60_000 && config.access_token) return config.access_token;
  if (!config.refresh_token) throw new Error("Geen refresh_token in exact_config");
  const r = await fetch(`${baseUrl}/api/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: config.refresh_token,
      client_id: config.client_id,
      client_secret: config.client_secret,
    }).toString(),
  });
  const td = await r.json();
  if (!r.ok || !td.access_token) throw new Error(`Refresh mislukt (${r.status}): ${JSON.stringify(td)}`);
  const newExpiresAt = new Date(Date.now() + td.expires_in * 1000).toISOString();
  await supabase.from("exact_config").update({
    access_token: td.access_token,
    refresh_token: td.refresh_token,
    access_token_expires_at: newExpiresAt,
    token_expires_at: newExpiresAt,
    refresh_token_obtained_at: new Date().toISOString(),
  }).eq("id", config.id);
  return td.access_token;
}

async function captureExactError(label: string, res: Response) {
  const bodyText = await res.text().catch(() => "");
  let bodyJson: unknown = null;
  try { bodyJson = JSON.parse(bodyText); } catch (_) { /* */ }
  return {
    summary: `${label} ${res.status} ${res.statusText} — ${bodyText.slice(0, 600)}`,
    detail: { label, http_status: res.status, body_raw: bodyText, body_json: bodyJson },
  };
}

// deno-lint-ignore no-explicit-any
async function createExactCreditNote(opts: {
  supabase: any; baseUrl: string; div: string; headers: Record<string, string>;
  lead: any; pauzeStart: string; eindDatum: string; pauzeDagen: number; jaarprijs: number;
}): Promise<
  | { ok: true; creditnotaId: string; amount: number; raw: unknown }
  | { ok: false; summary: string; detail: Record<string, unknown> }
  | { ok: true; skipped: true; reden: string }
> {
  const { baseUrl, div, headers, lead, pauzeStart, eindDatum, pauzeDagen, jaarprijs } = opts;
  if (pauzeDagen <= 0) return { ok: true, skipped: true, reden: "0 dagen pauze — geen creditnota nodig" };
  const bedrag = Math.round((jaarprijs / 365) * pauzeDagen * 100) / 100;
  if (bedrag <= 0) return { ok: true, skipped: true, reden: `Berekend bedrag €${bedrag} ≤ 0` };

  const INV_JOURNAL = "70";
  const INV_VAT_CODE = "0";
  const INV_GL_ACCOUNT = "d40fbb95-43b0-4503-9fe8-287f14d59120";

  const payload = {
    InvoiceTo: lead.exact_account_id,
    OrderedBy: lead.exact_account_id,
    Journal: INV_JOURNAL,
    Type: 21, // Sales Credit Note
    Status: 20, // Concept
    InvoiceDate: new Date().toISOString(),
    OrderDate: new Date().toISOString(),
    Description: `Creditnota pauze periode ${pauzeStart} t/m ${eindDatum}`,
    SalesInvoiceLines: [{
      GLAccount: INV_GL_ACCOUNT,
      VATCode: INV_VAT_CODE,
      Quantity: 1,
      UnitPrice: bedrag,
      Description: `Pro-rata teruggave ${pauzeDagen} dagen (${pauzeStart} t/m ${eindDatum})`,
      ...(lead.exact_item_id ? { Item: lead.exact_item_id } : {}),
    }],
  };

  // Item-id ophalen uit exact_config (we hebben dezelfde guid nodig)
  const { data: cfg } = await opts.supabase.from("exact_config").select("exact_item_id_bav_avb").limit(1).single();
  if (cfg?.exact_item_id_bav_avb) {
    (payload.SalesInvoiceLines[0] as any).Item = cfg.exact_item_id_bav_avb;
  }

  const r = await fetch(`${baseUrl}/api/v1/${div}/salesinvoice/SalesInvoices`, {
    method: "POST", headers, body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const err = await captureExactError("SalesInvoices POST (creditnota)", r);
    return { ok: false, ...err, detail: { ...err.detail, request: payload } as any };
  }
  const j = await r.json().catch(() => ({}));
  const id = j?.d?.InvoiceID || j?.d?.ID || j?.InvoiceID || "";
  return { ok: true, creditnotaId: id, amount: bedrag, raw: j };
}

// ── Main handler ──────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }

  const { action, lead_id, reden, toelichting, nieuwe_functie, rol_hint } = body ?? {};
  if (!action || !lead_id) return json({ error: "missing_params" }, 400);

  // Auth: identify caller via JWT
  let uid: string | null = null;
  let rol = "klant";
  const authHeader = req.headers.get("authorization") || "";
  if (authHeader.startsWith("Bearer ")) {
    const { data: { user } } = await supabase.auth.getUser(authHeader.slice(7));
    uid = user?.id ?? null;
    if (uid) {
      const { data: roleRow } = await supabase
        .from("user_roles").select("role").eq("user_id", uid).limit(1).maybeSingle();
      if (roleRow) rol = "admin";
    }
  }
  if (rol_hint === "system") rol = "system";

  // Lead ophalen
  const { data: lead, error: leadErr } = await supabase
    .from("leads").select("*").eq("id", lead_id).single();
  if (leadErr || !lead) return json({ error: "lead_not_found" }, 404);

  // Permissie-check: klant mag alleen zijn eigen polis muteren
  if (rol === "klant") {
    const { data: pol } = await supabase
      .from("policies").select("user_id").eq("lead_id", lead_id).limit(1).maybeSingle();
    if (!pol || pol.user_id !== uid) {
      return json({ error: "forbidden" }, 403);
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const recipientKlant = lead.email;

  try {
    switch (action) {
      // ────────── PAUZEREN ──────────
      case "pauzeren": {
        if (lead.status !== "klant" && lead.status !== "actief") {
          return json({ error: "ongeldige_status", current: lead.status }, 409);
        }
        if (!reden) return json({ error: "reden_verplicht" }, 400);

        await supabase.from("leads").update({
          status: "gepauzeerd",
          pauze_start_datum: today,
          pauze_reden: reden,
          pauze_door: uid,
          pauze_reminder_verzonden_op: null,
        }).eq("id", lead_id);

        await logAudit(supabase, {
          lead_id, actie: "pauzeren", uitgevoerd_door: uid, rol,
          details: { reden, pauze_start_datum: today, vorige_status: lead.status },
        });

        await sendMail(recipientKlant, "Je polis is gepauzeerd",
          mailShell("Polis gepauzeerd", `
            <p>Hoi ${lead.voornaam},</p>
            <p>Je polis is per <strong>${today}</strong> gepauzeerd. Tijdens de pauze ben je niet meer gedekt voor nieuwe schade. Schade die vóór de pauze ontstond blijft gedekt.</p>
            <p><strong>Reden:</strong> ${reden}</p>
            <p>Klaar om weer te starten? Log in op je portaal en klik op 'Hervatten'. Bij hervatting krijg je een creditnota voor de pauze-periode.</p>
            <p><a href="https://zzpproject.lovable.app/portal/polis" style="display:inline-block;background:#E53E2F;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">Naar mijn polis</a></p>
          `));

        await sendMail(ADMIN_EMAIL, `[Pauze] ${lead.voornaam} ${lead.achternaam} (${lead.bedrijfsnaam ?? "-"})`,
          mailShell("Polis gepauzeerd", `
            <p><strong>${lead.voornaam} ${lead.achternaam}</strong> (${lead.email}) heeft de polis gepauzeerd.</p>
            <p><strong>Reden:</strong> ${reden}<br/><strong>Datum:</strong> ${today}</p>
          `));

        // Cross-sell signal naar Onefellow bij reden 'geen_opdrachten'
        if (reden === "geen_opdrachten") {
          await sendMail(ONEFELLOW_EMAIL, `[ZP Zaken cross-sell] Klant zoekt opdrachten: ${lead.voornaam} ${lead.achternaam}`,
            mailShell("Cross-sell signal", `
              <p>Een klant van ZP Zaken heeft de polis gepauzeerd omdat hij/zij geen opdrachten heeft.</p>
              <p><strong>Naam:</strong> ${lead.voornaam} ${lead.achternaam}<br/>
              <strong>Email:</strong> ${lead.email}<br/>
              <strong>Telefoon:</strong> ${lead.telefoon ?? "-"}<br/>
              <strong>Functie:</strong> ${lead.functie_bij_aanvraag ?? lead.beroep ?? "-"}<br/>
              <strong>Bedrijf:</strong> ${lead.bedrijfsnaam ?? "-"}</p>
              <p>Mogelijk een match voor jullie recruitment-pool.</p>
            `));
        }

        return json({ ok: true, status: "gepauzeerd", pauze_start_datum: today });
      }

      // ────────── HERVATTEN ──────────
      case "hervatten": {
        if (lead.status !== "gepauzeerd") {
          return json({ error: "niet_gepauzeerd", current: lead.status }, 409);
        }
        const pauzeStart = lead.pauze_start_datum as string;
        const eindDatum = today;
        const pauzeDagen = pauzeStart
          ? Math.max(0, Math.round((new Date(eindDatum).getTime() - new Date(pauzeStart).getTime()) / (1000 * 60 * 60 * 24)))
          : 0;

        // Creditnota in Exact (skip bij 0 dagen of geen exact-koppeling)
        let creditnotaResult: any = { skipped: true, reden: "Geen creditnota uitgevoerd" };
        if (lead.exact_account_id && pauzeDagen > 0) {
          const { data: cfg } = await supabase.from("exact_config").select("*").limit(1).maybeSingle();
          if (cfg) {
            try {
              const token = await ensureValidToken(supabase, cfg);
              const headers = {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
                Accept: "application/json",
              };
              const jaarprijs = PAKKET_JAARPRIJS[lead.gekozen_pakket ?? ""] ?? 600;
              const res = await createExactCreditNote({
                supabase, baseUrl: cfg.base_url || "https://start.exactonline.nl",
                div: cfg.divisie_code, headers, lead,
                pauzeStart, eindDatum, pauzeDagen, jaarprijs,
              });
              creditnotaResult = res;
              if ("ok" in res && res.ok && !("skipped" in res)) {
                await supabase.from("leads").update({
                  exact_creditnota_id: res.creditnotaId,
                  exact_creditnota_amount: res.amount,
                  exact_creditnota_created_at: new Date().toISOString(),
                }).eq("id", lead_id);
                await logAudit(supabase, {
                  lead_id, actie: "creditnota_aangemaakt", uitgevoerd_door: uid, rol,
                  details: { dagen: pauzeDagen, bedrag: res.amount, pauze_start: pauzeStart, eind: eindDatum },
                  exact_response: res.raw,
                });
              } else if (!("skipped" in res) && !res.ok) {
                await logAudit(supabase, {
                  lead_id, actie: "creditnota_aangemaakt", uitgevoerd_door: uid, rol,
                  succes: false, fout_melding: res.summary, exact_response: res.detail,
                });
              }
            } catch (e: any) {
              creditnotaResult = { ok: false, summary: e.message };
              await logAudit(supabase, {
                lead_id, actie: "creditnota_aangemaakt", uitgevoerd_door: uid, rol,
                succes: false, fout_melding: e.message,
              });
            }
          }
        }

        await supabase.from("leads").update({
          status: "actief",
          pauze_start_datum: null,
          pauze_reden: null,
          pauze_door: null,
          pauze_reminder_verzonden_op: null,
        }).eq("id", lead_id);

        await logAudit(supabase, {
          lead_id, actie: "hervatten", uitgevoerd_door: uid, rol,
          details: {
            pauze_start: pauzeStart, pauze_dagen: pauzeDagen,
            creditnota: creditnotaResult,
          },
        });

        await sendMail(recipientKlant, "Je polis is weer actief",
          mailShell("Polis weer actief", `
            <p>Hoi ${lead.voornaam},</p>
            <p>Je polis is per <strong>${today}</strong> weer actief. Je bent weer volledig gedekt.</p>
            ${pauzeDagen > 0 ? `<p>Je ontvangt binnenkort een creditnota voor de ${pauzeDagen} pauzedagen.</p>` : ""}
            <p><a href="https://zzpproject.lovable.app/portal/polis" style="display:inline-block;background:#E53E2F;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">Naar mijn polis</a></p>
          `));

        await sendMail(ADMIN_EMAIL, `[Hervat] ${lead.voornaam} ${lead.achternaam}`,
          mailShell("Polis hervat", `
            <p><strong>${lead.voornaam} ${lead.achternaam}</strong> heeft de polis hervat na ${pauzeDagen} dagen pauze.</p>
            <p>Creditnota: ${"creditnotaId" in creditnotaResult ? `€${creditnotaResult.amount} (${creditnotaResult.creditnotaId})` : (creditnotaResult.reden ?? creditnotaResult.summary ?? "n.v.t.")}</p>
          `));

        return json({ ok: true, status: "actief", pauze_dagen: pauzeDagen, creditnota: creditnotaResult });
      }

      // ────────── OPZEGGEN ──────────
      case "opzeggen": {
        if (["opgezegd", "afgewezen"].includes(lead.status)) {
          return json({ error: "al_opgezegd", current: lead.status }, 409);
        }
        if (!reden) return json({ error: "reden_verplicht" }, 400);

        const wasGepauzeerd = lead.status === "gepauzeerd";
        const pauzeStart = lead.pauze_start_datum as string | null;

        // Creditnota bij opzegging-na-pauze
        let creditnotaResult: any = { skipped: true, reden: "Geen pauze actief" };
        if (wasGepauzeerd && pauzeStart && lead.exact_account_id) {
          const pauzeDagen = Math.max(0, Math.round((new Date(today).getTime() - new Date(pauzeStart).getTime()) / (1000 * 60 * 60 * 24)));
          const { data: cfg } = await supabase.from("exact_config").select("*").limit(1).maybeSingle();
          if (cfg && pauzeDagen > 0) {
            try {
              const token = await ensureValidToken(supabase, cfg);
              const headers = {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
                Accept: "application/json",
              };
              const jaarprijs = PAKKET_JAARPRIJS[lead.gekozen_pakket ?? ""] ?? 600;
              const res = await createExactCreditNote({
                supabase, baseUrl: cfg.base_url || "https://start.exactonline.nl",
                div: cfg.divisie_code, headers, lead,
                pauzeStart, eindDatum: today, pauzeDagen, jaarprijs,
              });
              creditnotaResult = res;
              if ("ok" in res && res.ok && !("skipped" in res)) {
                await supabase.from("leads").update({
                  exact_creditnota_id: res.creditnotaId,
                  exact_creditnota_amount: res.amount,
                  exact_creditnota_created_at: new Date().toISOString(),
                }).eq("id", lead_id);
                await logAudit(supabase, {
                  lead_id, actie: "creditnota_aangemaakt", uitgevoerd_door: uid, rol,
                  details: { context: "opzegging_na_pauze", dagen: pauzeDagen, bedrag: res.amount },
                  exact_response: res.raw,
                });
              }
            } catch (e: any) {
              creditnotaResult = { ok: false, summary: e.message };
            }
          }
        }

        await supabase.from("leads").update({
          status: "opgezegd",
          opzeg_datum: today,
          opzeg_reden: reden,
          opzeg_toelichting: toelichting ?? null,
          opzeg_door: uid,
        }).eq("id", lead_id);

        await logAudit(supabase, {
          lead_id, actie: "opzeggen", uitgevoerd_door: uid, rol,
          details: { reden, toelichting, was_gepauzeerd: wasGepauzeerd, creditnota: creditnotaResult },
        });

        await sendMail(recipientKlant, "Je polis is opgezegd",
          mailShell("Polis opgezegd", `
            <p>Hoi ${lead.voornaam},</p>
            <p>Je polis is per <strong>${today}</strong> opgezegd. Schade die vóór deze datum ontstond blijft gedekt volgens de polisvoorwaarden.</p>
            <p><strong>Reden:</strong> ${reden}</p>
            ${toelichting ? `<p><strong>Toelichting:</strong> ${toelichting}</p>` : ""}
            <p>Mocht je in de toekomst weer een polis willen, dan zijn we er voor je.</p>
          `));

        await sendMail(ADMIN_EMAIL, `[Opzegging] ${lead.voornaam} ${lead.achternaam}`,
          mailShell("Polis opgezegd", `
            <p><strong>${lead.voornaam} ${lead.achternaam}</strong> heeft de polis opgezegd.</p>
            <p><strong>Reden:</strong> ${reden}<br/>
            ${toelichting ? `<strong>Toelichting:</strong> ${toelichting}<br/>` : ""}
            <strong>Was gepauzeerd:</strong> ${wasGepauzeerd ? "ja" : "nee"}</p>
          `));

        return json({ ok: true, status: "opgezegd", creditnota: creditnotaResult });
      }

      // ────────── HERACTIVEREN — CHECK ──────────
      case "heractiveren_check": {
        if (!nieuwe_functie) return json({ error: "functie_verplicht" }, 400);
        if (!["opgezegd", "gepauzeerd"].includes(lead.status)) {
          return json({ error: "ongeldige_status", current: lead.status }, 409);
        }
        const huidig = normalizeFunctie(lead.functie_bij_aanvraag);
        const aangevraagd = normalizeFunctie(nieuwe_functie);
        const isZelfde = huidig && huidig === aangevraagd;
        const check = checkFunctieAcceptabel(nieuwe_functie);
        return json({
          ok: true,
          zelfde_functie: !!isZelfde,
          huidige_functie: lead.functie_bij_aanvraag,
          acceptabel: check.acceptabel,
          reden_afwijzing: check.reden ?? null,
        });
      }

      // ────────── HERACTIVEREN — CONFIRM ──────────
      case "heractiveren_confirm": {
        if (!nieuwe_functie) return json({ error: "functie_verplicht" }, 400);
        if (!["opgezegd", "gepauzeerd"].includes(lead.status)) {
          return json({ error: "ongeldige_status", current: lead.status }, 409);
        }
        const check = checkFunctieAcceptabel(nieuwe_functie);
        if (!check.acceptabel) {
          await logAudit(supabase, {
            lead_id, actie: "heractiveren", uitgevoerd_door: uid, rol,
            succes: false, fout_melding: check.reden,
            details: { aangevraagde_functie: nieuwe_functie },
          });
          return json({ ok: false, reden: check.reden }, 422);
        }

        const huidig = normalizeFunctie(lead.functie_bij_aanvraag);
        const aangevraagd = normalizeFunctie(nieuwe_functie);
        const functieGewijzigd = huidig !== aangevraagd;

        await supabase.from("leads").update({
          status: "actief",
          heractivering_datum: today,
          heractivering_door: uid,
          functie_bij_heractivering: functieGewijzigd ? nieuwe_functie : null,
          opzeg_datum: null,
          opzeg_reden: null,
          opzeg_toelichting: null,
          pauze_start_datum: null,
          pauze_reden: null,
        }).eq("id", lead_id);

        await logAudit(supabase, {
          lead_id, actie: "heractiveren", uitgevoerd_door: uid, rol,
          details: {
            nieuwe_functie,
            functie_gewijzigd: functieGewijzigd,
            oude_functie: lead.functie_bij_aanvraag,
          },
        });

        await sendMail(recipientKlant, "Je polis is weer actief",
          mailShell("Welkom terug — polis geheractiveerd", `
            <p>Hoi ${lead.voornaam},</p>
            <p>Je polis is per <strong>${today}</strong> weer actief.</p>
            ${functieGewijzigd ? `<p>We hebben je nieuwe functie geregistreerd: <strong>${nieuwe_functie}</strong></p>` : ""}
            <p><a href="https://zzpproject.lovable.app/portal/polis" style="display:inline-block;background:#E53E2F;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">Naar mijn polis</a></p>
          `));

        await sendMail(ADMIN_EMAIL, `[Heractivering] ${lead.voornaam} ${lead.achternaam}`,
          mailShell("Polis geheractiveerd", `
            <p><strong>${lead.voornaam} ${lead.achternaam}</strong> heeft de polis geheractiveerd.</p>
            <p><strong>Functie:</strong> ${nieuwe_functie} ${functieGewijzigd ? "(gewijzigd t.o.v. aanvraag: " + (lead.functie_bij_aanvraag ?? "onbekend") + ")" : "(ongewijzigd)"}</p>
          `));

        return json({ ok: true, status: "actief", functie_gewijzigd: functieGewijzigd });
      }

      default:
        return json({ error: "unknown_action", action }, 400);
    }
  } catch (e: any) {
    console.error("polis-lifecycle error", e);
    await logAudit(supabase, {
      lead_id, actie: action, uitgevoerd_door: uid, rol,
      succes: false, fout_melding: e.message ?? String(e),
    });
    return json({ error: "internal", message: e.message }, 500);
  }
});

// Polis-lifecycle: pauzeren / hervatten / opzeggen / heractiveren
// Financiële afhandeling:
//   - pauzeren                   → creditnota Type 8021 voor resterende dagen polisjaar
//   - hervatten                  → nieuwe factuur Type 8020 voor resterende dagen
//   - opzeggen vanuit actief     → creditnota Type 8021 voor resterende dagen (geen jaarcontract-lock-in, USP)
//   - opzeggen vanuit gepauzeerd → GEEN tweede creditnota (klant heeft al gekregen via pauze-creditnota)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { checkAcceptance } from "../_shared/acceptanceCriteria.ts";
import {
  getJaarprijs, calculatePauzeCredit, calculateHervatFactuur, calcPolisEinddatum, isMaandPolis,
} from "../_shared/polisProRata.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const ADMIN_EMAIL = "info@zpzaken.nl";
const ONEFELLOW_EMAIL = "info@onefellow.nl";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_ADDRESS = Deno.env.get("RESEND_FROM_ADDRESS") || "ZP Zaken <onboarding@resend.dev>";

// Exact master-data
const INV_JOURNAL = "70";
const INV_PAYMENT_COND = "IN";
const INV_VAT_CODE = "0";
const INV_GL_ACCOUNT = "d40fbb95-43b0-4503-9fe8-287f14d59120"; // 81000 Premie-omzet
const INV_STATUS_CONCEPT = 20;
// Exact API vereist 8020 (SalesInvoice) en 8021 (SalesCreditNote).
// Eerdere waarden 20/21 werden door Exact alleen via tolerantie geaccepteerd
// voor het factuur-pad en leidden bij creditnota's tot "Ongeldig: Type".
const TYPE_SALES_INVOICE = 8020;
const TYPE_SALES_CREDIT = 8021;

function fmtNL(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2, "0")}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${d.getUTCFullYear()}`;
}

// Datum-only helper: gebruikt Europe/Amsterdam zodat een actie kort na middernacht
// NL-tijd niet op de "vorige" UTC-dag terechtkomt. Returnt "YYYY-MM-DD".
function todayAmsterdam(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

function checkFunctieAcceptabel(functie: string): { acceptabel: boolean; reden?: string } {
  const res = checkAcceptance(functie);
  return { acceptabel: res.accepted, reden: res.reason };
}
function normalizeFunctie(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

// deno-lint-ignore no-explicit-any
async function logAudit(supabase: any, params: {
  lead_id: string; actie: string; uitgevoerd_door: string | null; rol: string;
  details?: Record<string, unknown>; exact_response?: unknown;
  succes?: boolean; fout_melding?: string | null;
}) {
  try {
    await supabase.from("polis_audit_log").insert({
      lead_id: params.lead_id, actie: params.actie,
      uitgevoerd_door: params.uitgevoerd_door, rol: params.rol,
      details: params.details ?? {}, exact_response: params.exact_response ?? null,
      succes: params.succes ?? true, fout_melding: params.fout_melding ?? null,
    });
  } catch (e) { console.error("logAudit failed", e); }
}

async function sendMail(to: string | string[], subject: string, html: string) {
  const recipients = Array.isArray(to) ? to : [to];
  if (!RESEND_API_KEY) return { ok: false, error: "missing_resend_key", to: recipients };
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({ from: FROM_ADDRESS, to: recipients, subject, html }),
    });
    const txt = await r.text();
    let parsed: any = null; try { parsed = JSON.parse(txt); } catch { /* */ }
    if (!r.ok) { console.error("Resend error", r.status, txt); return { ok: false, status: r.status, error: txt.slice(0, 400), to: recipients }; }
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

// ── Exact: token + error capture ──────────────────────────────────────────
// deno-lint-ignore no-explicit-any
async function ensureValidToken(supabase: any, config: any): Promise<string> {
  const baseUrl = config.base_url || "https://start.exactonline.nl";
  const expiresAt = config.access_token_expires_at ? new Date(config.access_token_expires_at) : new Date(0);
  if (expiresAt.getTime() - Date.now() > 60_000 && config.access_token) return config.access_token;
  return await refreshAccessToken(supabase, config, /*reloadOn401*/ true);
}

// deno-lint-ignore no-explicit-any
async function refreshAccessToken(supabase: any, config: any, reloadOn401: boolean): Promise<string> {
  const baseUrl = config.base_url || "https://start.exactonline.nl";
  if (!config.refresh_token) throw new Error("Geen refresh_token in exact_config");
  const r = await fetch(`${baseUrl}/api/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token", refresh_token: config.refresh_token,
      client_id: config.client_id, client_secret: config.client_secret,
    }).toString(),
  });
  const td = await r.json();
  if (!r.ok || !td.access_token) {
    // Race-recovery: een parallelle call kan net een nieuwere refresh_token hebben opgeslagen.
    // Herlaad config één keer en probeer met de verse waarde.
    if (reloadOn401 && r.status === 401) {
      const { data: fresh } = await supabase.from("exact_config").select("*").eq("id", config.id).single();
      if (fresh && fresh.refresh_token && fresh.refresh_token !== config.refresh_token) {
        return await refreshAccessToken(supabase, fresh, /*reloadOn401*/ false);
      }
      // Geen nieuwere token in DB → admin moet opnieuw verbinden via /admin/exact-koppeling.
      throw new Error(
        `Refresh mislukt (401) — Exact heeft het refresh_token ongeldig verklaard. ` +
        `Verbind Exact opnieuw via /admin/exact-koppeling. Detail: ${JSON.stringify(td)}`
      );
    }
    throw new Error(`Refresh mislukt (${r.status}): ${JSON.stringify(td)}`);
  }
  const newExpiresAt = new Date(Date.now() + td.expires_in * 1000).toISOString();
  await supabase.from("exact_config").update({
    access_token: td.access_token, refresh_token: td.refresh_token,
    access_token_expires_at: newExpiresAt, token_expires_at: newExpiresAt,
    refresh_token_obtained_at: new Date().toISOString(),
  }).eq("id", config.id);
  return td.access_token;
}

async function captureExactError(label: string, res: Response) {
  const bodyText = await res.text().catch(() => "");
  let bodyJson: unknown = null;
  try { bodyJson = JSON.parse(bodyText); } catch { /* */ }
  return {
    summary: `${label} ${res.status} ${res.statusText} — ${bodyText.slice(0, 600)}`,
    detail: { label, http_status: res.status, body_raw: bodyText, body_json: bodyJson },
  };
}

// Post een SalesInvoice (Type 20 = factuur, 21 = creditnota) in Exact.
// YourRef = lead.id (Exact truncate naar 30 chars — eerste 30 van een UUID is uniek genoeg).
async function postSalesInvoice(opts: {
  baseUrl: string; div: string; headers: Record<string, string>;
  // deno-lint-ignore no-explicit-any
  lead: any; itemId: string | null;
  type: typeof TYPE_SALES_INVOICE | typeof TYPE_SALES_CREDIT;
  description: string;
  lineDescription: string;
  unitPrice: number; // positief voor beide types; Exact 8021 draait zelf het teken om
  periodStart?: string; // YYYY-MM-DD — dekkingsperiode regelniveau
  periodEnd?: string;   // YYYY-MM-DD
}): Promise<
  | { ok: true; invoiceId: string; invoiceNumber: string | null; amount: number; raw: unknown; request: unknown }
  | { ok: false; summary: string; detail: Record<string, unknown>; request: unknown; httpStatus: number }
> {
  const { baseUrl, div, headers, lead, itemId, type, description, lineDescription, unitPrice, periodStart, periodEnd } = opts;
  const nowIso = new Date().toISOString();
  // deno-lint-ignore no-explicit-any
  const line: any = {
    GLAccount: INV_GL_ACCOUNT,
    VATCode: INV_VAT_CODE,
    Quantity: 1,
    UnitPrice: unitPrice,
    Description: lineDescription,
  };
  if (itemId) line.Item = itemId;
  if (periodStart) line.StartTime = `${periodStart}T00:00:00`;
  if (periodEnd) line.EndTime = `${periodEnd}T00:00:00`;
  const payload = {
    InvoiceTo: lead.exact_account_id,
    OrderedBy: lead.exact_account_id,
    Journal: INV_JOURNAL,
    PaymentCondition: INV_PAYMENT_COND,
    Type: type,
    Status: INV_STATUS_CONCEPT,
    InvoiceDate: nowIso,
    OrderDate: nowIso,
    YourRef: String(lead.id),
    Description: description,
    SalesInvoiceLines: [line],
  };
  const r = await fetch(`${baseUrl}/api/v1/${div}/salesinvoice/SalesInvoices`, {
    method: "POST", headers, body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const { summary, detail } = await captureExactError(`SalesInvoices POST (Type ${type})`, r);
    return { ok: false, summary, detail, request: payload, httpStatus: r.status };
  }
  const j = await r.json().catch(() => ({}));
  const d: any = (j as any)?.d ?? j;
  const invoiceId: string = d?.InvoiceID || d?.ID || "";
  const invoiceNumber: string | null = d?.InvoiceNumber != null ? String(d.InvoiceNumber) : null;
  return { ok: true, invoiceId, invoiceNumber, amount: Math.abs(unitPrice), raw: d, request: payload };
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
  const { action, lead_id, reden, toelichting, pauze_toelichting, nieuwe_functie, rol_hint } = body ?? {};
  if (!action || !lead_id) return json({ error: "missing_params" }, 400);

  // Auth: bepaal exacte rol (admin / supervisor / medewerker / klant / system)
  let uid: string | null = null;
  let rol = "klant";
  const authHeader = req.headers.get("authorization") || "";
  if (authHeader.startsWith("Bearer ")) {
    const { data: { user } } = await supabase.auth.getUser(authHeader.slice(7));
    uid = user?.id ?? null;
    if (uid) {
      const { data: roleRows } = await supabase
        .from("user_roles").select("role").eq("user_id", uid);
      const roles = (roleRows ?? []).map((r: any) => r.role);
      if (roles.includes("admin")) rol = "admin";
      else if (roles.includes("supervisor")) rol = "supervisor";
      else if (roles.includes("medewerker")) rol = "medewerker";
    }
  }
  if (rol_hint === "system") rol = "system";

  const { data: lead, error: leadErr } = await supabase
    .from("leads").select("*").eq("id", lead_id).single();
  if (leadErr || !lead) return json({ error: "lead_not_found" }, 404);

  if (rol === "klant") {
    const { data: pol } = await supabase
      .from("policies").select("user_id").eq("lead_id", lead_id).limit(1).maybeSingle();
    if (!pol || pol.user_id !== uid) return json({ error: "forbidden" }, 403);
  }

  // Server-side rolafscherming: medewerker (intern) mag NIET opzeggen of activatie terugdraaien.
  // Klanten (portal) en system-cron behouden hun bestaande paden.
  const GATED_INTERNAL_ACTIONS = new Set(["opzeggen", "heractiveren_check", "heractiveren_confirm"]);
  if (rol === "medewerker" && GATED_INTERNAL_ACTIONS.has(action)) {
    await logAudit(supabase, {
      lead_id, actie: `${action}_geweigerd_rolafscherming`,
      uitgevoerd_door: uid, rol,
      succes: false, fout_melding: "medewerker zonder supervisor/admin-rechten",
    });
    return json({ error: "forbidden", message: "Deze actie is voorbehouden aan supervisor/admin." }, 403);
  }

  const today = todayAmsterdam();
  const recipientKlant = lead.email;

  // Helper: laad Exact-config + headers (lazy, alleen als nodig)
  async function exactCtx() {
    const { data: cfg } = await supabase.from("exact_config").select("*").limit(1).maybeSingle();
    if (!cfg?.is_actief || !cfg.divisie_code) return null;
    const token = await ensureValidToken(supabase, cfg);
    return {
      cfg, baseUrl: cfg.base_url || "https://start.exactonline.nl", div: cfg.divisie_code,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        Prefer: "return=representation",
      },
      itemId: cfg.exact_item_id_bav_avb as string | null,
    };
  }

  try {
    switch (action) {
      // ────────── PAUZEREN (B1: creditnota direct) ──────────
      case "pauzeren": {
        if (lead.status !== "klant" && lead.status !== "actief") {
          return json({ error: "ongeldige_status", current: lead.status }, 409);
        }
        if (!reden) return json({ error: "reden_verplicht" }, 400);
        if (reden === "andere_reden" && !(pauze_toelichting ?? "").trim()) {
          return json({ error: "toelichting_verplicht" }, 400);
        }
        if (!lead.ingangsdatum) return json({ error: "geen_ingangsdatum_op_lead" }, 400);

        const jaarprijs = getJaarprijs(lead.gekozen_pakket);
        const eind = lead.polis_einddatum ?? calcPolisEinddatum(lead.ingangsdatum);
        const calc = calculatePauzeCredit({
          ingangsdatum: lead.ingangsdatum, polis_einddatum: eind,
          jaarprijs, pauze_datum: today,
        });

        // Creditnota in Exact (alleen als account + factuur reeds bestaan)
        // Maandpolis: GEEN creditnota (toekomstige maandfacturen worden simpelweg gestopt).
        let creditResult: any = { skipped: true, reden: "Geen Exact-account gekoppeld" };
        if (isMaandPolis(lead.gekozen_pakket)) {
          creditResult = { skipped: true, reden: "Maandpolis — geen creditnota, maandcron stopt vanzelf" };
        } else if (lead.exact_account_id && calc.credit_bedrag > 0) {
          const ctx = await exactCtx();
          if (!ctx) {
            return json({ error: "exact_niet_beschikbaar" }, 500);
          }
          const res = await postSalesInvoice({
            baseUrl: ctx.baseUrl, div: ctx.div, headers: ctx.headers,
            lead, itemId: ctx.itemId,
            type: TYPE_SALES_CREDIT,
            description: `Creditnota pauze polis BAV-AVB per ${fmtNL(today)}`,
            lineDescription: `Restitutie pauze - Periode ${fmtNL(today)} t/m ${fmtNL(eind)} (${calc.resterende_dagen} dagen × € ${calc.dagprijs.toFixed(4)})`,
            unitPrice: calc.credit_bedrag,
            periodStart: today, periodEnd: eind,
          });
          if (!res.ok) {
            // Logging-gat dichten: ook naar exact_sync_log naast polis_audit_log
            await supabase.from("exact_sync_log").insert({
              lead_id, admin_user_id: uid, trigger_type: "creditnota_pauze",
              status: "error", http_status: res.httpStatus,
              error_message: res.summary,
              payload: { request: res.request, response: res.detail, berekening: calc },
            }).then(() => {}, (e: unknown) => console.error("sync_log insert failed", e));
            // ROLLBACK: status niet wijzigen, audit log met fout, klant ziet error
            await logAudit(supabase, {
              lead_id, actie: "creditnota_aangemaakt", uitgevoerd_door: uid, rol,
              succes: false, fout_melding: res.summary,
              details: { berekening: calc, request: res.request },
              exact_response: res.detail,
            });
            return json({ error: "creditnota_failed", summary: res.summary, detail: res.detail }, 502);
          }
          creditResult = { ok: true, invoiceId: res.invoiceId, bedrag: calc.credit_bedrag };
          await supabase.from("leads").update({
            exact_credit_invoice_id_pauze: res.invoiceId,
            exact_credit_invoice_bedrag: calc.credit_bedrag,
            exact_credit_invoice_aangemaakt_op: new Date().toISOString(),
          }).eq("id", lead_id);
          await supabase.from("exact_sync_log").insert({
            lead_id, admin_user_id: uid, trigger_type: "creditnota_pauze",
            status: "success", http_status: 201,
            payload: { request: res.request, exact_invoice_id: res.invoiceId, berekening: calc },
          }).then(() => {}, (e: unknown) => console.error("sync_log insert failed", e));
          await logAudit(supabase, {
            lead_id, actie: "creditnota_aangemaakt", uitgevoerd_door: uid, rol,
            details: { context: "pauze", berekening: calc, exact_invoice_id: res.invoiceId },
            exact_response: res.raw,
          });
        }

        await supabase.from("leads").update({
          status: "gepauzeerd",
          pauze_start_datum: today,
          pauze_reden: reden,
          pauze_toelichting: pauze_toelichting ?? null,
          pauze_door: uid,
          pauze_reminder_verzonden_op: null,
        }).eq("id", lead_id);

        await logAudit(supabase, {
          lead_id, actie: "pauzeren", uitgevoerd_door: uid, rol,
          details: {
            reden, toelichting: pauze_toelichting ?? null,
            pauze_start_datum: today, vorige_status: lead.status,
            credit: creditResult,
          },
        });

        const creditZin = ("ok" in creditResult && creditResult.ok)
          ? `<p>Je ontvangt binnenkort een creditnota van <strong>€ ${calc.credit_bedrag.toFixed(2).replace(".", ",")}</strong> voor de resterende ${calc.resterende_dagen} dagen tot ${fmtNL(eind)}.</p>`
          : `<p>Je polis is gepauzeerd. Onze administratie verwerkt de financiële afhandeling.</p>`;
        const mailResults: any[] = [];
        mailResults.push(await sendMail(recipientKlant, "Je polis is gepauzeerd",
          mailShell("Polis gepauzeerd", `
            <p>Hoi ${lead.voornaam},</p>
            <p>Je polis is per <strong>${fmtNL(today)}</strong> gepauzeerd. Tijdens de pauze ben je niet meer gedekt voor nieuwe schade. Schade van vóór de pauze blijft gedekt.</p>
            <p><strong>Reden:</strong> ${reden.replace(/_/g, " ")}</p>
            ${pauze_toelichting ? `<p><strong>Toelichting:</strong> ${pauze_toelichting}</p>` : ""}
            ${creditZin}
            <p>Klaar om weer te starten? Log in op je portaal en klik op 'Hervatten'. Je krijgt dan een nieuwe factuur voor de resterende dagen tot ${fmtNL(eind)}.</p>
            <p><a href="https://zzpproject.lovable.app/portal/polis" style="display:inline-block;background:#E53E2F;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">Naar mijn polis</a></p>
          `)));

        mailResults.push(await sendMail(ADMIN_EMAIL, `[Pauze] ${lead.voornaam} ${lead.achternaam}`,
          mailShell("Polis gepauzeerd", `
            <p><strong>${lead.voornaam} ${lead.achternaam}</strong> (${lead.email}) heeft de polis gepauzeerd.</p>
            <p><strong>Reden:</strong> ${reden}<br/><strong>Datum:</strong> ${fmtNL(today)}</p>
            ${pauze_toelichting ? `<p><strong>Toelichting:</strong> ${pauze_toelichting}</p>` : ""}
            <p><strong>Creditnota:</strong> ${"ok" in creditResult && creditResult.ok ? `€ ${calc.credit_bedrag.toFixed(2)} (Exact ID ${creditResult.invoiceId})` : (creditResult.reden ?? "n.v.t.")}</p>
            ${lead.exact_invoice_status === 50 ? `<p style="background:#fff7ed;border:1px solid #fed7aa;padding:10px;border-radius:6px"><strong>⚠️ Let op:</strong> originele factuur staat op Status 50 (definitief). Controleer of de eerstvolgende SEPA-incassobatch deze klant nog bevat en verwijder indien nodig handmatig in Exact → Cashflow → Incasso.</p>` : ""}
          `)));

        if (reden === "geen_opdrachten") {
          mailResults.push(await sendMail(ONEFELLOW_EMAIL, `[ZP Zaken cross-sell] Klant zoekt opdrachten: ${lead.voornaam} ${lead.achternaam}`,
            mailShell("Cross-sell signal", `
              <p>Een klant van ZP Zaken heeft de polis gepauzeerd wegens geen opdrachten.</p>
              <p><strong>Naam:</strong> ${lead.voornaam} ${lead.achternaam}<br/>
              <strong>Email:</strong> ${lead.email}<br/>
              <strong>Telefoon:</strong> ${lead.telefoon ?? "-"}<br/>
              <strong>Functie:</strong> ${lead.functie_bij_aanvraag ?? lead.beroep ?? "-"}<br/>
              <strong>Bedrijf:</strong> ${lead.bedrijfsnaam ?? "-"}</p>
            `)));
        }

        return json({
          ok: true, status: "gepauzeerd", pauze_start_datum: today,
          credit: creditResult, berekening: calc, mails: mailResults,
        });
      }

      // ────────── HERVATTEN (B1: nieuwe factuur Type 20) ──────────
      case "hervatten": {
        if (lead.status !== "gepauzeerd") {
          return json({ error: "niet_gepauzeerd", current: lead.status }, 409);
        }
        if (!lead.ingangsdatum) return json({ error: "geen_ingangsdatum" }, 400);

        const jaarprijs = getJaarprijs(lead.gekozen_pakket);
        const eind = lead.polis_einddatum ?? calcPolisEinddatum(lead.ingangsdatum);
        const calc = calculateHervatFactuur({
          ingangsdatum: lead.ingangsdatum, polis_einddatum: eind,
          jaarprijs, hervat_datum: today,
        });

        let factuurResult: any = { skipped: true, reden: "Geen Exact-account of bedrag = 0" };
        if (isMaandPolis(lead.gekozen_pakket)) {
          factuurResult = { skipped: true, reden: "Maandpolis — geen pro-rata factuur, maandcron hervat vanaf 1e van komende maand" };
        } else if (lead.exact_account_id && calc.factuur_bedrag > 0) {
          const ctx = await exactCtx();
          if (!ctx) return json({ error: "exact_niet_beschikbaar" }, 500);
          const res = await postSalesInvoice({
            baseUrl: ctx.baseUrl, div: ctx.div, headers: ctx.headers,
            lead, itemId: ctx.itemId,
            type: TYPE_SALES_INVOICE,
            description: `Premie BAV-AVB vanaf ${fmtNL(today)} t/m ${fmtNL(eind)}`,
            lineDescription: `BAV-AVB premie hervat - Periode ${fmtNL(today)} t/m ${fmtNL(eind)} (${calc.resterende_dagen} dagen × € ${calc.dagprijs.toFixed(4)})`,
            unitPrice: calc.factuur_bedrag,
            periodStart: today, periodEnd: eind,
          });
          if (!res.ok) {
            await supabase.from("exact_sync_log").insert({
              lead_id, admin_user_id: uid, trigger_type: "factuur_hervat",
              status: "error", http_status: res.httpStatus,
              error_message: res.summary,
              payload: { request: res.request, response: res.detail, berekening: calc },
            }).then(() => {}, (e: unknown) => console.error("sync_log insert failed", e));
            await logAudit(supabase, {
              lead_id, actie: "hervat_factuur", uitgevoerd_door: uid, rol,
              succes: false, fout_melding: res.summary,
              details: { berekening: calc, request: res.request },
              exact_response: res.detail,
            });
            return json({ error: "hervat_factuur_failed", summary: res.summary, detail: res.detail }, 502);
          }
          factuurResult = { ok: true, invoiceId: res.invoiceId, invoiceNumber: res.invoiceNumber, bedrag: calc.factuur_bedrag };
          await supabase.from("leads").update({
            exact_factuur_id_hervat: res.invoiceId,
            exact_factuur_bedrag_hervat: calc.factuur_bedrag,
            exact_factuur_aangemaakt_op_hervat: new Date().toISOString(),
          }).eq("id", lead_id);
          await supabase.from("exact_sync_log").insert({
            lead_id, admin_user_id: uid, trigger_type: "factuur_hervat",
            status: "success", http_status: 201,
            payload: { request: res.request, exact_invoice_id: res.invoiceId, exact_invoice_number: res.invoiceNumber, berekening: calc },
          }).then(() => {}, (e: unknown) => console.error("sync_log insert failed", e));
          await logAudit(supabase, {
            lead_id, actie: "hervat_factuur", uitgevoerd_door: uid, rol,
            details: { berekening: calc, exact_invoice_id: res.invoiceId, exact_invoice_number: res.invoiceNumber },
            exact_response: res.raw,
          });
        }

        await supabase.from("leads").update({
          status: "actief",
          pauze_start_datum: null,
          pauze_reden: null,
          pauze_toelichting: null,
          pauze_door: null,
          pauze_reminder_verzonden_op: null,
        }).eq("id", lead_id);

        await logAudit(supabase, {
          lead_id, actie: "hervatten", uitgevoerd_door: uid, rol,
          details: { hervat_datum: today, factuur: factuurResult, berekening: calc },
        });

        const factuurZin = ("ok" in factuurResult && factuurResult.ok)
          ? `<p>Je ontvangt een nieuwe factuur van <strong>€ ${calc.factuur_bedrag.toFixed(2).replace(".", ",")}</strong> voor de resterende ${calc.resterende_dagen} dagen tot ${fmtNL(eind)}.</p>`
          : `<p>Je polis is weer actief. Onze administratie verwerkt de financiële afhandeling.</p>`;
        await sendMail(recipientKlant, "Je polis is weer actief",
          mailShell("Polis weer actief", `
            <p>Hoi ${lead.voornaam},</p>
            <p>Je polis is per <strong>${fmtNL(today)}</strong> weer actief. Je bent weer volledig gedekt.</p>
            ${factuurZin}
            <p><a href="https://zzpproject.lovable.app/portal/polis" style="display:inline-block;background:#E53E2F;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">Naar mijn polis</a></p>
          `));
        await sendMail(ADMIN_EMAIL, `[Hervat] ${lead.voornaam} ${lead.achternaam}`,
          mailShell("Polis hervat", `
            <p><strong>${lead.voornaam} ${lead.achternaam}</strong> heeft de polis hervat.</p>
            <p><strong>Datum:</strong> ${fmtNL(today)}<br/>
            <strong>Nieuwe factuur:</strong> ${"ok" in factuurResult && factuurResult.ok ? `€ ${calc.factuur_bedrag.toFixed(2)} (Exact ID ${factuurResult.invoiceId})` : (factuurResult.reden ?? "n.v.t.")}</p>
          `));

        return json({
          ok: true, status: "actief", hervat_datum: today,
          factuur: factuurResult, berekening: calc,
        });
      }

      // ────────── OPZEGGEN ──────────
      // - vanuit ACTIEF/klant: creditnota Type 8021 voor resterende dagen → status='opgezegd'
      // - vanuit GEPAUZEERD:   status='opgezegd', GEEN tweede creditnota (al gedaan bij pauze)
      case "opzeggen": {
        if (["opgezegd", "afgewezen"].includes(lead.status)) {
          return json({ error: "al_opgezegd", current: lead.status }, 409);
        }
        if (!reden) return json({ error: "reden_verplicht" }, 400);
        if (reden === "andere_reden" && !(toelichting ?? "").trim()) {
          return json({ error: "toelichting_verplicht" }, 400);
        }
        const wasGepauzeerd = lead.status === "gepauzeerd";
        const vanuitActief = lead.status === "actief" || lead.status === "klant";

        // ─ Creditnota bij opzegging vanuit actief ─
        let creditResult: any = wasGepauzeerd
          ? { skipped: true, reden: "Al gecrediteerd bij pauze" }
          : { skipped: true, reden: "Geen Exact-account gekoppeld" };
        let calc: ReturnType<typeof calculatePauzeCredit> | null = null;
        let eindForMail: string | null = null;

        if (vanuitActief && lead.exact_account_id && !isMaandPolis(lead.gekozen_pakket)) {
          if (!lead.ingangsdatum) return json({ error: "geen_ingangsdatum_op_lead" }, 400);
          const jaarprijs = getJaarprijs(lead.gekozen_pakket);
          const eind = lead.polis_einddatum ?? calcPolisEinddatum(lead.ingangsdatum);
          eindForMail = eind;
          calc = calculatePauzeCredit({
            ingangsdatum: lead.ingangsdatum, polis_einddatum: eind,
            jaarprijs, pauze_datum: today,
          });

          if (calc.credit_bedrag > 0) {
            const ctx = await exactCtx();
            if (!ctx) return json({ error: "exact_niet_beschikbaar" }, 500);
            const res = await postSalesInvoice({
              baseUrl: ctx.baseUrl, div: ctx.div, headers: ctx.headers,
              lead, itemId: ctx.itemId,
              type: TYPE_SALES_CREDIT,
              description: `Creditnota opzegging polis BAV-AVB per ${fmtNL(today)}`,
              lineDescription: `Restitutie opzegging - Periode ${fmtNL(today)} t/m ${fmtNL(eind)} (${calc.resterende_dagen} dagen × € ${calc.dagprijs.toFixed(4)})`,
              unitPrice: calc.credit_bedrag,
              periodStart: today, periodEnd: eind,
            });
            if (!res.ok) {
              await supabase.from("exact_sync_log").insert({
                lead_id, admin_user_id: uid, trigger_type: "creditnota_opzeg",
                status: "error", http_status: res.httpStatus,
                error_message: res.summary,
                payload: { request: res.request, response: res.detail, berekening: calc },
              }).then(() => {}, (e: unknown) => console.error("sync_log insert failed", e));
              await logAudit(supabase, {
                lead_id, actie: "creditnota_aangemaakt", uitgevoerd_door: uid, rol,
                succes: false, fout_melding: res.summary,
                details: { context: "opzeg", berekening: calc, request: res.request },
                exact_response: res.detail,
              });
              // ROLLBACK: status blijft ongewijzigd, klant ziet error.
              return json({ error: "creditnota_failed", summary: res.summary, detail: res.detail }, 502);
            }
            creditResult = { ok: true, invoiceId: res.invoiceId, bedrag: calc.credit_bedrag };
            await supabase.from("leads").update({
              exact_credit_invoice_id_opzeg: res.invoiceId,
              exact_credit_invoice_bedrag_opzeg: calc.credit_bedrag,
              exact_credit_invoice_aangemaakt_op_opzeg: new Date().toISOString(),
            }).eq("id", lead_id);
            await supabase.from("exact_sync_log").insert({
              lead_id, admin_user_id: uid, trigger_type: "creditnota_opzeg",
              status: "success", http_status: 201,
              payload: { request: res.request, exact_invoice_id: res.invoiceId, berekening: calc },
            }).then(() => {}, (e: unknown) => console.error("sync_log insert failed", e));
            await logAudit(supabase, {
              lead_id, actie: "creditnota_aangemaakt", uitgevoerd_door: uid, rol,
              details: { context: "opzeg", berekening: calc, exact_invoice_id: res.invoiceId },
              exact_response: res.raw,
            });
          } else {
            creditResult = { skipped: true, reden: "Berekend bedrag is 0" };
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
          details: {
            reden, toelichting, was_gepauzeerd: wasGepauzeerd,
            creditnota: creditResult,
          },
        });

        const creditBlokKlant = creditResult?.ok && calc
          ? `<p>Je ontvangt een creditnota van <strong>€ ${calc.credit_bedrag.toFixed(2).replace(".", ",")}</strong> voor ${calc.resterende_dagen} dagen restdekking tot ${fmtNL(eindForMail!)}.</p>`
          : "";
        const creditBlokAdmin = creditResult?.ok && calc
          ? `<strong>Creditnota:</strong> € ${calc.credit_bedrag.toFixed(2)} (${calc.resterende_dagen} dagen, Exact ID ${creditResult.invoiceId})<br/>`
          : `<strong>Creditnota:</strong> ${creditResult?.reden ?? "geen"}<br/>`;

        await sendMail(recipientKlant, "Je polis is opgezegd",
          mailShell("Polis opgezegd", `
            <p>Hoi ${lead.voornaam},</p>
            <p>Je polis is per <strong>${fmtNL(today)}</strong> opgezegd. Schade van vóór deze datum blijft gedekt volgens de polisvoorwaarden.</p>
            <p><strong>Reden:</strong> ${reden.replace(/_/g, " ")}</p>
            ${toelichting ? `<p><strong>Toelichting:</strong> ${toelichting}</p>` : ""}
            ${creditBlokKlant}
            <p>Mocht je in de toekomst weer een polis willen, dan zijn we er voor je.</p>
          `));
        await sendMail(ADMIN_EMAIL, `[Opzegging] ${lead.voornaam} ${lead.achternaam}`,
          mailShell("Polis opgezegd", `
            <p><strong>${lead.voornaam} ${lead.achternaam}</strong> heeft de polis opgezegd.</p>
            <p><strong>Reden:</strong> ${reden}<br/>
            ${toelichting ? `<strong>Toelichting:</strong> ${toelichting}<br/>` : ""}
            <strong>Was gepauzeerd:</strong> ${wasGepauzeerd ? "ja" : "nee"}<br/>
            ${creditBlokAdmin}</p>
          `));

        return json({
          ok: true, status: "opgezegd", was_gepauzeerd: wasGepauzeerd,
          credit: creditResult, berekening: calc,
        });
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
          ok: true, zelfde_functie: !!isZelfde,
          huidige_functie: lead.functie_bij_aanvraag,
          acceptabel: check.acceptabel, reden_afwijzing: check.reden ?? null,
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
          status: "actief", heractivering_datum: today, heractivering_door: uid,
          functie_bij_heractivering: functieGewijzigd ? nieuwe_functie : null,
          opzeg_datum: null, opzeg_reden: null, opzeg_toelichting: null,
          pauze_start_datum: null, pauze_reden: null,
        }).eq("id", lead_id);

        await logAudit(supabase, {
          lead_id, actie: "heractiveren", uitgevoerd_door: uid, rol,
          details: { nieuwe_functie, functie_gewijzigd: functieGewijzigd, oude_functie: lead.functie_bij_aanvraag },
        });

        await sendMail(recipientKlant, "Je polis is weer actief",
          mailShell("Welkom terug — polis geheractiveerd", `
            <p>Hoi ${lead.voornaam},</p>
            <p>Je polis is per <strong>${fmtNL(today)}</strong> weer actief.</p>
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

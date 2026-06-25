// Maandelijkse premie-cron voor maandpolissen.
// Draait dagelijks om 06:00 UTC; doet alleen werk als (today.day==1) of force_date is meegegeven.
// Per maandpolis (gekozen_pakket='maandelijks', status='actief'): factuur €55 voor de hele maand,
// idempotent via monthly_invoices_log (unique on lead_id+jaar+maand).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  isMaandPolis, getMaandprijs, firstOfMonth, lastOfMonth,
  calcMaandProrata, MAAND_NAMEN_NL,
} from "../_shared/polisProRata.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Exact master-data (sync met polis-lifecycle / lead-to-exact-activate)
const INV_JOURNAL = "70";
const INV_PAYMENT_COND = "IN";
const INV_VAT_CODE = "0";
const INV_GL_ACCOUNT = "d40fbb95-43b0-4503-9fe8-287f14d59120";
const INV_STATUS_CONCEPT = 20;
const TYPE_SALES_INVOICE = 8020;

function todayAmsterdam(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

// deno-lint-ignore no-explicit-any
async function ensureValidToken(supabase: any, config: any): Promise<string> {
  const baseUrl = config.base_url || "https://start.exactonline.nl";
  const expiresAt = config.access_token_expires_at ? new Date(config.access_token_expires_at) : new Date(0);
  if (expiresAt.getTime() - Date.now() > 60_000 && config.access_token) return config.access_token;
  if (!config.refresh_token) throw new Error("Geen refresh_token");
  const r = await fetch(`${baseUrl}/api/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token", refresh_token: config.refresh_token,
      client_id: config.client_id, client_secret: config.client_secret,
    }).toString(),
  });
  const td = await r.json();
  if (!r.ok || !td.access_token) throw new Error(`Refresh mislukt: ${JSON.stringify(td)}`);
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Auth: CRON_SECRET via header of query, OF service-role JWT.
  const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
  const url = new URL(req.url);
  const providedSecret = url.searchParams.get("secret") ?? req.headers.get("x-cron-secret") ?? "";
  if (!cronSecret || providedSecret !== cronSecret) {
    return json({ error: "unauthorized" }, 401);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  // force_date voor test-runs: ?force_date=2026-07-01
  const forceDate = url.searchParams.get("force_date");
  const dryRun = url.searchParams.get("dry_run") === "1";
  const today = forceDate || todayAmsterdam();
  const todayDay = parseInt(today.slice(8, 10), 10);

  // Guard: alleen op de 1ste van de maand draaien (tenzij force_date).
  if (!forceDate && todayDay !== 1) {
    return json({ ok: true, skipped: true, reason: "not_first_of_month", today });
  }

  const periodeStart = firstOfMonth(today);
  const periodeEind = lastOfMonth(today);
  const jaar = parseInt(today.slice(0, 4), 10);
  const maand = parseInt(today.slice(5, 7), 10);
  const maandNaam = MAAND_NAMEN_NL[maand - 1];

  // Exact config (lazy)
  const { data: cfg } = await supabase.from("exact_config").select("*").limit(1).maybeSingle();
  if (!cfg?.is_actief || !cfg.divisie_code) {
    return json({ error: "exact_niet_actief" }, 500);
  }
  const baseUrl = cfg.base_url || "https://start.exactonline.nl";
  const div = cfg.divisie_code;
  const token = await ensureValidToken(supabase, cfg);
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    Prefer: "return=representation",
  };
  const itemId = cfg.exact_item_id_bav_avb as string | null;

  // Selecteer maandpolissen die deze maand gefactureerd moeten worden.
  // Voorwaarden: status='actief', gekozen_pakket maandpolis, exact_account_id aanwezig,
  // ingangsdatum <= periode_eind, polis_einddatum (computed) >= periode_start.
  const { data: leads, error: leadsErr } = await supabase
    .from("leads")
    .select("id,voornaam,achternaam,bedrijfsnaam,gekozen_pakket,status,ingangsdatum,polis_einddatum,exact_account_id")
    .eq("status", "actief")
    .eq("gekozen_pakket", "maandelijks")
    .not("exact_account_id", "is", null)
    .lte("ingangsdatum", periodeEind);

  if (leadsErr) return json({ error: "lead_query_failed", detail: leadsErr.message }, 500);

  const results: Array<Record<string, unknown>> = [];
  let created = 0, skipped = 0, errors = 0;

  for (const lead of leads ?? []) {
    if (!isMaandPolis(lead.gekozen_pakket)) { skipped++; continue; }

    const polisEind = lead.polis_einddatum as string | null;
    if (polisEind && polisEind < periodeStart) {
      results.push({ lead_id: lead.id, skipped: "polis_geeindigd" });
      skipped++; continue;
    }

    // Idempotentie: pre-flight check op monthly_invoices_log
    const { data: existing } = await supabase
      .from("monthly_invoices_log")
      .select("id,status,exact_invoice_id")
      .eq("lead_id", lead.id).eq("factuur_jaar", jaar).eq("factuur_maand", maand)
      .maybeSingle();
    if (existing && existing.status === "success") {
      results.push({ lead_id: lead.id, skipped: "already_invoiced", exact_invoice_id: existing.exact_invoice_id });
      skipped++; continue;
    }

    const maandprijs = getMaandprijs(lead.gekozen_pakket);
    // Pro-rata indien ingang midden in deze maand valt
    const effStart = (lead.ingangsdatum as string) > periodeStart ? (lead.ingangsdatum as string) : periodeStart;
    const effEnd = polisEind && polisEind < periodeEind ? polisEind : periodeEind;
    const calc = calcMaandProrata({ maandprijs, vanaf_datum: effStart, tot_datum: effEnd });

    if (calc.bedrag <= 0) { skipped++; continue; }

    if (dryRun) {
      results.push({ lead_id: lead.id, dry_run: true, bedrag: calc.bedrag, periode_start: effStart, periode_eind: effEnd });
      continue;
    }

    const fmtNL = (iso: string) => {
      const d = new Date(iso);
      return `${String(d.getUTCDate()).padStart(2, "0")}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${d.getUTCFullYear()}`;
    };
    const header = `BAV-AVB premie ${maandNaam} ${jaar}`;
    const lineDesc = `BAV-AVB premie ${maandNaam} ${jaar} - Periode ${fmtNL(effStart)} t/m ${fmtNL(effEnd)} (${calc.dagen} dagen)`;

    // deno-lint-ignore no-explicit-any
    const line: any = {
      GLAccount: INV_GL_ACCOUNT, VATCode: INV_VAT_CODE,
      Quantity: 1, UnitPrice: calc.bedrag, Description: lineDesc,
      StartTime: `${effStart}T00:00:00`,
      EndTime: `${effEnd}T00:00:00`,
    };
    if (itemId) line.Item = itemId;

    const payload = {
      InvoiceTo: lead.exact_account_id, OrderedBy: lead.exact_account_id,
      Journal: INV_JOURNAL, PaymentCondition: INV_PAYMENT_COND,
      Type: TYPE_SALES_INVOICE, Status: INV_STATUS_CONCEPT,
      InvoiceDate: new Date().toISOString(), OrderDate: new Date().toISOString(),
      YourRef: String(lead.id), Description: header,
      SalesInvoiceLines: [line],
    };

    // pre-log 'pending'
    await supabase.from("monthly_invoices_log").upsert({
      lead_id: lead.id, factuur_jaar: jaar, factuur_maand: maand,
      periode_start: effStart, periode_eind: effEnd, polis_einddatum: polisEind,
      bedrag: calc.bedrag, status: "pending", payload: { request: payload, berekening: calc },
    }, { onConflict: "lead_id,factuur_jaar,factuur_maand" });

    const r = await fetch(`${baseUrl}/api/v1/${div}/salesinvoice/SalesInvoices`, {
      method: "POST", headers, body: JSON.stringify(payload),
    });

    if (!r.ok) {
      const { summary, detail } = await captureExactError("MaandcronSalesInvoices", r);
      await supabase.from("monthly_invoices_log").update({
        status: "error", error_message: summary,
        payload: { request: payload, response: detail, berekening: calc },
      }).eq("lead_id", lead.id).eq("factuur_jaar", jaar).eq("factuur_maand", maand);
      await supabase.from("exact_sync_log").insert({
        lead_id: lead.id, trigger_type: "monthly_invoices_cron",
        status: "error", http_status: r.status, error_message: summary,
        payload: { request: payload, response: detail, berekening: calc },
      });
      results.push({ lead_id: lead.id, error: summary });
      errors++; continue;
    }
    const j = await r.json().catch(() => ({}));
    // deno-lint-ignore no-explicit-any
    const d: any = (j as any)?.d ?? j;
    const invoiceId: string = d?.InvoiceID || d?.ID || "";
    const invoiceNumber: string | null = d?.InvoiceNumber != null ? String(d.InvoiceNumber) : null;

    await supabase.from("monthly_invoices_log").update({
      status: "success", exact_invoice_id: invoiceId, exact_invoice_number: invoiceNumber,
      payload: { request: payload, response: d, berekening: calc },
    }).eq("lead_id", lead.id).eq("factuur_jaar", jaar).eq("factuur_maand", maand);

    await supabase.from("exact_sync_log").insert({
      lead_id: lead.id, trigger_type: "monthly_invoices_cron",
      status: "success", http_status: 201,
      payload: { exact_invoice_id: invoiceId, exact_invoice_number: invoiceNumber, berekening: calc },
    });

    results.push({ lead_id: lead.id, exact_invoice_id: invoiceId, exact_invoice_number: invoiceNumber, bedrag: calc.bedrag });
    created++;
  }

  return json({
    ok: true, today, jaar, maand, periode_start: periodeStart, periode_eind: periodeEind,
    total_candidates: leads?.length ?? 0, created, skipped, errors,
    dry_run: dryRun, force_date: forceDate, results,
  });
});

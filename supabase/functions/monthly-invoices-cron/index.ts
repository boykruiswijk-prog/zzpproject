// Maandelijkse premie-cron voor maandpolissen.
// Draait dagelijks om 06:00 UTC; doet alleen werk als (today.day==1) of force_date is meegegeven.
// Per maandpolis (gekozen_pakket='maandelijks', status='actief'): factuur €55 voor de hele maand,
// idempotent via monthly_invoices_log (unique on lead_id+jaar+maand).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  isMaandPolis, getMaandprijs, firstOfMonth, lastOfMonth,
  calcMaandProrata, MAAND_NAMEN_NL,
} from "../_shared/polisProRata.ts";
import { ensureValidToken } from "../_shared/exactToken.ts";
import { cachedBavGlAccountId, getBavGlAccountId } from "../_shared/exactGl.ts";
import { sendExactAlarm } from "../_shared/exactAlarm.ts";
import { factuurReferentie, kopOmschrijving, maandIsAlGefactureerd, regelNotities, regelOmschrijving } from "../_shared/factuurTekst.ts";

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
// Grootboekrekening BAV-AVB: via _shared/exactGl.ts (exact_config.gl_code_bav, standaard 8003).
let INV_GL_ACCOUNT = "";
const INV_STATUS_CONCEPT = 20;
const TYPE_SALES_INVOICE = 8020;

function todayAmsterdam(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
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

  // Auth: alleen header x-cron-secret, getoetst tegen Vault via verify_cron_secret.
  const url = new URL(req.url);
  const providedSecret = req.headers.get("x-cron-secret") ?? "";
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );
  if (!providedSecret) return json({ error: "unauthorized" }, 401);
  const { data: secretOk } = await supabase.rpc("verify_cron_secret", { p_secret: providedSecret });
  if (secretOk !== true) return json({ error: "unauthorized" }, 401);

  // force_date voor test-runs: ?force_date=2026-07-01
  const forceDate = url.searchParams.get("force_date");
  const dryRun = url.searchParams.get("dry_run") === "1";
  // include_test=1 neemt testleads mee, maar uitsluitend bij een droogrun.
  const includeTest = url.searchParams.get("include_test") === "1";
  if (includeTest && !dryRun) {
    return json({ error: "include_test_requires_dry_run" }, 400);
  }
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
  // Fouten vóór de factuurlus altijd loggen (geen stille 500). Nooit tokens loggen.
  const logCronError = async (message: string) => {
    try {
      await supabase.from("exact_sync_log").insert({
        trigger_type: "monthly_invoices_cron", status: "error",
        error_message: message.replace(/(access_token|refresh_token)"?\s*[:=]\s*"?[^",\s}]+/gi, "$1=[redacted]").slice(0, 1000),
        payload: { today, dry_run: dryRun, include_test: includeTest },
      });
    } catch (e) { console.error("exact_sync_log insert failed", e); }
  };
  if (!cfg?.is_actief || !cfg.divisie_code) {
    await logCronError("exact_niet_actief");
    await sendExactAlarm(supabase, "Exact-koppeling staat niet actief of heeft geen divisie (maandcron).", "monthly-invoices-cron", null);
    return json({ error: "exact_niet_actief" }, 500);
  }
  const baseUrl = cfg.base_url || "https://start.exactonline.nl";
  const div = cfg.divisie_code;
  let token = "";
  // Droogrun: geen Exact-aanroep, dus ook geen tokenverversing.
  if (!dryRun) {
    try {
      token = await ensureValidToken(supabase, cfg);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("monthly-invoices-cron: token error");
      await logCronError(`token_error: ${msg}`);
      await sendExactAlarm(supabase, `Token vernieuwen mislukt in maandcron: ${msg}`, "monthly-invoices-cron", null);
      return json({ error: "exact_token_error", message: "Exact-token kon niet worden vernieuwd; zie exact_sync_log." }, 502);
    }
  }
  // Grootboek BAV-AVB: echte run → opzoeken (of cache); droogrun → alleen cache.
  let glInfo: string;
  if (!dryRun) {
    try {
      INV_GL_ACCOUNT = await getBavGlAccountId(supabase, cfg, token);
      glInfo = INV_GL_ACCOUNT;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await logCronError(`gl_error: ${msg}`);
      return json({ error: "grootboek_bav_niet_gevonden", message: msg }, 502);
    }
  } else {
    const c = cachedBavGlAccountId(cfg);
    glInfo = c ?? "niet opgezocht (droogrun)";
    if (c) INV_GL_ACCOUNT = c;
  }
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
    .select("id,voornaam,achternaam,bedrijfsnaam,gekozen_pakket,status,ingangsdatum,polis_einddatum,exact_account_id,exact_relatie_code")
    .eq("status", "actief")
    .eq("gekozen_pakket", "maandelijks")
    .not("exact_account_id", "is", null)
    .lte("ingangsdatum", periodeEind)
    // Testleads nooit echt factureren; alleen meenemen bij dry_run + include_test.
    .or(includeTest ? "is_test.is.null,is_test.eq.false,is_test.eq.true" : "is_test.is.null,is_test.eq.false");

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
    if (existing && maandIsAlGefactureerd(existing.status)) {
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

    const header = kopOmschrijving(`BAV-AVB premie ${maandNaam} ${jaar}`);
    const lineDesc = regelOmschrijving("premie", effStart, effEnd);
    const { data: policyRef } = await supabase.from("policies").select("certificate_number").eq("lead_id", lead.id).limit(1).maybeSingle();

    // deno-lint-ignore no-explicit-any
    const line: any = {
      GLAccount: INV_GL_ACCOUNT, VATCode: INV_VAT_CODE,
      Quantity: 1, UnitPrice: calc.bedrag, Description: lineDesc,
      Notes: regelNotities(calc.dagen, calc.dagprijs, `${maandNaam} ${jaar}`),
      StartTime: `${effStart}T00:00:00`,
      EndTime: `${effEnd}T00:00:00`,
    };
    if (itemId) line.Item = itemId;

    const payload = {
      InvoiceTo: lead.exact_account_id, OrderedBy: lead.exact_account_id,
      Journal: INV_JOURNAL, PaymentCondition: INV_PAYMENT_COND,
      Type: TYPE_SALES_INVOICE, Status: INV_STATUS_CONCEPT,
      InvoiceDate: new Date().toISOString(), OrderDate: new Date().toISOString(),
      YourRef: factuurReferentie(policyRef?.certificate_number, lead.exact_relatie_code), Description: header,
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
    dry_run: dryRun, force_date: forceDate, gl: glInfo, results,
  });
});

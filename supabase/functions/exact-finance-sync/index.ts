// Financieel overzicht: STRIKT ALLEEN-LEZEN uit Exact (alleen GET, afgedwongen in exactGet, met call-plafond).
// Schrijft alleen in eigen cachetabellen (upsert op Exact-id) en exact_finance_runs. Nooit iets naar Exact.
// Toegang: cron (x-cron-secret uit Vault, dagelijks 05:50 NL) of supervisor/admin met 2FA (knop "Nu verversen").
//
// Endpoints:
//  - facturen:    salesinvoice/SalesInvoices (Type 8020 factuur, 8021 creditnota; Status 50 verwerkt). Bedrag = AmountDC incl. btw.
//  - open posten: read/financial/ReceivablesList (momentopname van wat nu open staat; alle pagina's of de run telt niet als volledig).
//  - betalingen:  cashflow/Receivables (IsFullyPaid, LastPaymentDate, Status, TransactionIsReversal voor terugboekingen).
// Niet gebruikt: cashflow/DirectDebitMandates (geen betaalinformatie). Storno's levert Exact niet als eigen soort; alleen
// TransactionIsReversal in cashflow/Receivables geeft een terugboeking aan, als Exact dat veld vult.
// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { ensureValidToken, refreshAccessToken } from "../_shared/exactToken.ts";
import { cronOfSupervisor, uurNL } from "../_shared/cronOfSupervisor.ts";

const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const MAX_CALLS = 400;
const MAX_PAGINAS = 120;

const datum = (v: any): string | null => {
  const m = /\/Date\((-?\d+)/.exec(String(v ?? ""));
  if (m) return new Date(Number(m[1])).toISOString().slice(0, 10);
  return v ? String(v).slice(0, 10) : null;
};
const tekst = (v: any) => (v == null || v === "" ? null : String(v).trim());
const getal = (v: any) => (v == null || v === "" || isNaN(Number(v)) ? null : Number(v));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const toegang = await cronOfSupervisor(req, admin);
  if (toegang instanceof Response) return json({ error: "geen_toegang" }, toegang.status);
  // Cron draait om 03:50 en 04:50 UTC; alleen het moment dat het 05 uur NL is telt.
  // Eenmalige run buiten het tijdvak alleen met het cron-secret en expliciet {"nu": true}.
  const verzoek = await req.json().catch(() => ({}));
  if (toegang.cron && uurNL() !== 5 && verzoek?.nu !== true) return json({ overgeslagen: "niet 05:50 NL" });

  const { data: cfg } = await admin.from("exact_config").select("*").limit(1).maybeSingle();
  if (!cfg?.is_actief || !cfg.divisie_code) return json({ error: "exact_niet_actief" }, 400);

  // Periode: vanaf 1-1-2026, of eerder als factuur_planning een eerdere factuur kent.
  const { data: eerste } = await admin.from("factuur_planning").select("invoice_date").not("invoice_date", "is", null).order("invoice_date").limit(1).maybeSingle();
  const vanaf = eerste?.invoice_date && eerste.invoice_date < "2026-01-01" ? eerste.invoice_date : "2026-01-01";

  const { data: run, error: runFout } = await admin.from("exact_finance_runs")
    .insert({ bron: toegang.cron ? "cron" : "handmatig", vanaf }).select("id").single();
  if (runFout) return json({ error: runFout.message }, 500);
  const runId = run.id as string;

  const base = `${cfg.base_url || "https://start.exactonline.nl"}/api/v1/${String(cfg.divisie_code).trim()}/`;
  let token: string;
  try { token = await ensureValidToken(admin, cfg); }
  catch (e) {
    await admin.from("exact_finance_runs").update({ status: "fout", klaar_op: new Date().toISOString(), fouten: [{ stap: "token", fout: String(e) }] }).eq("id", runId);
    return json({ run_id: runId, error: "token", detail: String(e) }, 502);
  }
  let calls = 0;

  // Enige toegang tot Exact: alleen GET.
  async function exactGet(url: string): Promise<{ ok: boolean; status: number; body: any }> {
    for (let poging = 0; poging < 2; poging++) {
      if (++calls > MAX_CALLS) throw new Error("call-plafond bereikt");
      const res = await fetch(url, { method: "GET", headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
      if (res.status === 401 && poging === 0) { await res.text(); token = await refreshAccessToken(admin, cfg); continue; }
      const t = await res.text();
      let body: any = null; try { body = JSON.parse(t); } catch { body = t.slice(0, 300); }
      return { ok: res.ok, status: res.status, body };
    }
    return { ok: false, status: 401, body: null };
  }

  async function haalAlles(eerste: string, fallback?: string) {
    let url: string | null = eerste; let r = await exactGet(url);
    let gebruikt = eerste;
    if (!r.ok && fallback) { gebruikt = fallback; url = fallback; r = await exactGet(url); }
    const status = r.status; const rijen: any[] = []; let pag = 0;
    const fout = r.ok ? null : (typeof r.body === "string" ? r.body : r.body?.error?.message?.value ?? `http ${r.status}`);
    while (r.ok) {
      const d = r.body?.d ?? {};
      rijen.push(...(d.results ?? (Array.isArray(d) ? d : [])));
      url = d.__next ?? null; pag++;
      if (!url || pag >= MAX_PAGINAS) break;
      r = await exactGet(url);
      if (!r.ok) break;
    }
    return { status, rijen, volledig: r.ok && !url, url: gebruikt.replace(base, ""), fout };
  }

  async function upsert(tabel: string, rijen: any[]) {
    for (let i = 0; i < rijen.length; i += 500) {
      const { error } = await admin.from(tabel).upsert(rijen.slice(i, i + 500), { onConflict: "exact_id" });
      if (error) throw new Error(`${tabel}: ${error.message}`);
    }
  }

  const nu = new Date().toISOString();
  const endpoints: Record<string, unknown> = {}; const fouten: any[] = []; const aantallen: Record<string, number> = {};
  const filterDatum = `datetime'${vanaf}T00:00:00'`;

  try {
    // 1. Verkoopfacturen
    const sel = "InvoiceID,InvoiceNumber,InvoiceTo,InvoiceToName,AmountDC,InvoiceDate,DueDate,Type,Status,Description";
    const f = await haalAlles(`${base}salesinvoice/SalesInvoices?$select=${sel}&$filter=InvoiceDate ge ${filterDatum}`,
      `${base}salesinvoice/SalesInvoices?$filter=InvoiceDate ge ${filterDatum}`);
    endpoints.facturen = { endpoint: f.url, http: f.status, rijen: f.rijen.length, volledig: f.volledig, fout: f.fout };
    const fr = f.rijen.filter((x) => x.InvoiceID).map((x) => ({
      exact_id: String(x.InvoiceID), factuurnummer: tekst(x.InvoiceNumber), account_id: tekst(x.InvoiceTo), account_code: null,
      account_naam: tekst(x.InvoiceToName), bedrag: getal(x.AmountDC), factuurdatum: datum(x.InvoiceDate), vervaldatum: datum(x.DueDate),
      soort: Number(x.Type) === 8021 || Number(x.AmountDC) < 0 ? "creditnota" : "factuur", exact_type: getal(x.Type), exact_status: getal(x.Status),
      omschrijving: tekst(x.Description), raw: x, opgehaald_op: nu, sync_run_id: runId,
    }));
    await upsert("exact_facturen_cache", fr); aantallen.facturen = fr.length;

    // 2. Openstaande posten (momentopname)
    const o = await haalAlles(`${base}read/financial/ReceivablesList`);
    endpoints.open_posten = { endpoint: o.url, http: o.status, rijen: o.rijen.length, volledig: o.volledig, fout: o.fout };
    const or = o.rijen.map((x) => ({
      exact_id: String(x.HID ?? x.Id ?? `${x.EntryNumber}-${x.InvoiceNumber}-${x.AccountCode}`), factuurnummer: tekst(x.InvoiceNumber),
      account_id: tekst(x.AccountId), account_code: tekst(x.AccountCode), account_naam: tekst(x.AccountName), bedrag: getal(x.Amount),
      factuurdatum: datum(x.InvoiceDate), vervaldatum: datum(x.DueDate), omschrijving: tekst(x.Description), raw: x, opgehaald_op: nu, sync_run_id: runId,
    }));
    await upsert("exact_open_posten_cache", or); aantallen.open_posten = or.length;

    // 3. Betalingen en afletteringen
    // Exact eist hier een $select; zonder geldige veldenlijst geeft hij 400. Tweede poging met minimale velden.
    const bsel = "ID,Account,AccountCode,AmountDC,InvoiceDate,InvoiceNumber,DueDate,Status,IsFullyPaid,LastPaymentDate,TransactionIsReversal";
    const b = await haalAlles(`${base}cashflow/Receivables?$select=${bsel}&$filter=InvoiceDate ge ${filterDatum}`,
      `${base}cashflow/Receivables?$select=ID,AccountCode,AmountDC,InvoiceNumber,InvoiceDate,DueDate,Status&$filter=InvoiceDate ge ${filterDatum}`);
    endpoints.betalingen = { endpoint: b.url, http: b.status, rijen: b.rijen.length, volledig: b.volledig, fout: b.fout,
      velden: b.rijen[0] ? Object.keys(b.rijen[0]).filter((k) => k !== "__metadata") : [] };
    const br = b.rijen.filter((x) => x.ID).map((x) => ({
      exact_id: String(x.ID), factuurnummer: tekst(x.InvoiceNumber), account_id: tekst(x.Account), account_code: tekst(x.AccountCode),
      bedrag: getal(x.AmountDC), factuurdatum: datum(x.InvoiceDate), vervaldatum: datum(x.DueDate), exact_status: getal(x.Status),
      volledig_betaald: typeof x.IsFullyPaid === "boolean" ? x.IsFullyPaid : null, laatste_betaling: datum(x.LastPaymentDate),
      is_terugboeking: x.TransactionIsReversal === true, raw: x, opgehaald_op: nu, sync_run_id: runId,
    }));
    await upsert("exact_betalingen_cache", br); aantallen.betalingen = br.length;
  } catch (e) {
    fouten.push({ fout: String(e) });
  }

  for (const [k, v] of Object.entries(endpoints)) if ((v as any).fout) fouten.push({ endpoint: k, fout: (v as any).fout });
  const status = fouten.length === 0 ? "ok" : Object.keys(aantallen).length ? "deels" : "fout";
  await admin.from("exact_finance_runs").update({ status, klaar_op: new Date().toISOString(), calls, endpoints, aantallen, fouten }).eq("id", runId);
  return json({ run_id: runId, status, vanaf, calls, endpoints, aantallen, fouten });
});

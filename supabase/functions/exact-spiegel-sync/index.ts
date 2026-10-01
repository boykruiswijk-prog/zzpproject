// Fase 1: STRIKT ALLEEN-LEZEN spiegel van Exact (relaties, abonnementen, regels, types, artikelen).
// Doet uitsluitend GET-verzoeken naar Exact (afgedwongen in exactGet). Schrijft alleen in eigen spiegeltabellen,
// ondernemingen.exact_* (via exact_koppel_accounts) en één regel per run in exact_sync_log. Geen mails.
import { createClient } from "npm:@supabase/supabase-js@2";
import { ensureValidToken } from "../_shared/exactToken.ts";
import { checkConfiguredDivision } from "../_shared/exactDivision.ts";
import { requireSupervisor } from "../_shared/teamAuth.ts";
import { exactCodeNorm, exactDatum } from "../_shared/exactCodeMatch.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
};
const json = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const STAPPEN = ["probe", "accounts", "types", "artikelen", "abonnementen", "regels", "afleiden", "koppel"] as const;
type Stap = typeof STAPPEN[number];
const MAX_CALLS_PER_RUN = 400;
const PAUZE_MS = 1300; // ≤ ~46 calls/min, onder de Exact-limiet van 60/min

const num = (v: unknown) => (v == null || v === "" ? null : Number(v));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const intern = Deno.env.get("INTERNAL_FUNCTION_SECRET");
  const gegeven = req.headers.get("x-internal-secret");
  if (!(intern && gegeven && gegeven === intern)) {
    const auth = await requireSupervisor(req, admin);
    if (auth instanceof Response) return json({ error: "geen_toegang" }, auth.status);
  }

  let stap: Stap = "probe";
  try { const b = await req.json(); if (STAPPEN.includes(b?.stap)) stap = b.stap; else return json({ error: "onbekende_stap", stappen: STAPPEN }, 400); }
  catch { return json({ error: "body_vereist", stappen: STAPPEN }, 400); }

  const { data: cfg } = await admin.from("exact_config").select("*").limit(1).maybeSingle();
  if (!cfg?.is_actief || !cfg.divisie_code) return json({ error: "exact_niet_actief" }, 400);
  const baseUrl = cfg.base_url || "https://start.exactonline.nl";
  const div = String(cfg.divisie_code).trim();
  let token = await ensureValidToken(admin, cfg);
  const runId = crypto.randomUUID();
  let calls = 0;

  // Enige toegang tot Exact: alleen GET.
  async function exactGet(url: string): Promise<any> {
    if (calls >= MAX_CALLS_PER_RUN) throw new Error("call-plafond bereikt");
    for (let poging = 0; poging < 3; poging++) {
      calls++;
      const res = await fetch(url, { method: "GET", headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
      if (res.status === 429) {
        const reset = Number(res.headers.get("X-RateLimit-Minutely-Reset") ?? res.headers.get("X-RateLimit-Reset") ?? 0);
        await sleep(Math.min(65_000, Math.max(5_000, reset ? reset - Date.now() : 60_000)));
        continue;
      }
      if (res.status === 401 && poging === 0) { token = await ensureValidToken(admin, { ...cfg, access_token_expires_at: new Date(0).toISOString() }); continue; }
      if (!res.ok) throw new Error(`Exact GET ${res.status}: ${(await res.text()).slice(0, 300)}`);
      await sleep(PAUZE_MS);
      return res.json();
    }
    throw new Error("Exact GET mislukt na herhaalde pogingen");
  }
  async function alles(pad: string): Promise<any[]> {
    const rows: any[] = [];
    let url: string | null = `${baseUrl}/api/v1/${div}/${pad}`;
    while (url) {
      const body = await exactGet(url);
      const d = body?.d ?? {};
      rows.push(...(d.results ?? (Array.isArray(d) ? d : [])));
      url = d.__next ?? null;
    }
    return rows;
  }
  async function upsert(tabel: string, rijen: any[], key: string) {
    for (let i = 0; i < rijen.length; i += 500) {
      const { error } = await admin.from(tabel).upsert(rijen.slice(i, i + 500), { onConflict: key });
      if (error) throw new Error(`${tabel}: ${error.message}`);
    }
  }

  let resultaat: Record<string, unknown> = {};
  try {
    const dc = await checkConfiguredDivision(baseUrl, div, token);
    calls++;
    if (!dc.ok) throw new Error(dc.error ?? "divisie niet toegankelijk");

    if (stap === "probe") {
      const pr: Record<string, unknown> = {};
      for (const p of ["subscription/Subscriptions", "subscription/SubscriptionLines", "subscription/SubscriptionTypes"]) {
        const b = await exactGet(`${baseUrl}/api/v1/${div}/${p}?$top=1`);
        const r = (b?.d?.results ?? [])[0] ?? {};
        pr[p] = Object.keys(r).filter((k) => k !== "__metadata");
      }
      resultaat = pr;
    } else if (stap === "accounts") {
      const rows = await alles("bulk/CRM/Accounts?$select=ID,Code,Name,ChamberOfCommerce,Status,IsSales,Blocked");
      await upsert("exact_accounts_spiegel", rows.map((a) => ({
        id: a.ID, code: a.Code, code_norm: exactCodeNorm(a.Code), naam: a.Name?.trim() ?? null, kvk: a.ChamberOfCommerce ?? null,
        status: a.Status ?? null, is_sales: a.IsSales ?? null, blocked: a.Blocked ?? null, opgehaald_op: new Date().toISOString(), sync_run_id: runId,
      })), "id");
      resultaat = { accounts: rows.length };
    } else if (stap === "types") {
      const rows = await alles("subscription/SubscriptionTypes?$select=ID,Code,Description");
      await upsert("exact_abonnementstypes_spiegel", rows.map((t) => ({ id: t.ID, code: t.Code, omschrijving: t.Description, raw: t, opgehaald_op: new Date().toISOString(), sync_run_id: runId })), "id");
      resultaat = { types: rows.length };
    } else if (stap === "artikelen") {
      const rows = await alles("bulk/Logistics/Items?$select=ID,Code,Description");
      await upsert("exact_artikelen_spiegel", rows.map((t) => ({ id: t.ID, code: t.Code?.trim(), omschrijving: t.Description, opgehaald_op: new Date().toISOString(), sync_run_id: runId })), "id");
      resultaat = { artikelen: rows.length };
    } else if (stap === "abonnementen") {
      const rows = await alles("subscription/Subscriptions?$select=EntryID,Number,Description,OrderedBy,InvoiceTo,SubscriptionType,StartDate,EndDate,CancellationDate,InvoicedTo,InvoicingStartDate,InvoiceDay,PaymentCondition,Classification,BlockEntry");
      await upsert("exact_abonnementen_spiegel", rows.map((s) => {
        const inv = exactDatum(s.InvoicedTo);
        return {
          entry_id: s.EntryID, nummer: s.Number != null ? String(s.Number) : null, omschrijving: s.Description ?? null,
          ordered_by: s.OrderedBy ?? null, invoice_to: s.InvoiceTo ?? null, subscription_type: s.SubscriptionType ?? null,
          start_date: exactDatum(s.StartDate), end_date: exactDatum(s.EndDate), cancellation_date: exactDatum(s.CancellationDate),
          invoiced_to: inv, invoiced_to_bron: inv ? "exact" : null, invoicing_start_date: exactDatum(s.InvoicingStartDate),
          invoice_day: num(s.InvoiceDay), payment_condition: s.PaymentCondition ?? null, classification: s.Classification ?? null,
          block_entry: s.BlockEntry ?? null, raw: s, opgehaald_op: new Date().toISOString(), sync_run_id: runId,
        };
      }), "entry_id");
      resultaat = { abonnementen: rows.length, zonder_invoiced_to: rows.filter((s) => !exactDatum(s.InvoicedTo)).length };
    } else if (stap === "regels") {
      const rows = await alles("subscription/SubscriptionLines?$select=ID,EntryID,Item,ItemDescription,Quantity,UnitPrice,NetPrice,AmountDC,FromDate,ToDate,LineType,UnitCode,VATCode");
      const { data: art } = await admin.from("exact_artikelen_spiegel").select("id,code").range(0, 9999);
      const code = new Map((art ?? []).map((a: any) => [a.id, a.code]));
      await upsert("exact_abonnementsregels_spiegel", rows.map((l) => ({
        id: l.ID, entry_id: l.EntryID, item: l.Item ?? null, item_code: code.get(l.Item) ?? null, item_omschrijving: l.ItemDescription ?? null,
        quantity: num(l.Quantity), unit_price: num(l.UnitPrice), net_price: num(l.NetPrice), amount_dc: num(l.AmountDC),
        from_date: exactDatum(l.FromDate), to_date: exactDatum(l.ToDate), line_type: l.LineType != null ? String(l.LineType) : null,
        unit_code: l.UnitCode ?? null, vat_code: l.VATCode ?? null, raw: l, opgehaald_op: new Date().toISOString(), sync_run_id: runId,
      })), "id");
      resultaat = { regels: rows.length, zonder_artikelcode: rows.filter((l) => !code.get(l.Item)).length };
    } else if (stap === "afleiden") {
      // Lege InvoicedTo: laatste gefactureerde periode afleiden uit SalesInvoiceLines (alleen lezen).
      const { data: leeg } = await admin.from("exact_abonnementen_spiegel").select("entry_id").is("invoiced_to", null).range(0, 9999);
      let afgeleid = 0;
      for (const s of leeg ?? []) {
        const b = await exactGet(`${baseUrl}/api/v1/${div}/salesinvoice/SalesInvoiceLines?$select=EndTime&$filter=${encodeURIComponent(`Subscription eq guid'${s.entry_id}'`)}&$orderby=EndTime desc&$top=1`);
        const eind = exactDatum((b?.d?.results ?? [])[0]?.EndTime);
        if (eind) {
          await admin.from("exact_abonnementen_spiegel").update({ invoiced_to: eind, invoiced_to_bron: "afgeleid" }).eq("entry_id", s.entry_id);
          afgeleid++;
        }
      }
      resultaat = { zonder_invoiced_to: leeg?.length ?? 0, afgeleid };
    } else if (stap === "koppel") {
      const { data, error } = await admin.rpc("exact_koppel_accounts");
      if (error) throw new Error(error.message);
      resultaat = data as Record<string, unknown>;
    }

    await admin.from("exact_sync_log").insert({ trigger_type: "spiegel_sync", status: "success", http_status: 200, payload: { stap, run_id: runId, calls, ...resultaat } });
    return json({ success: true, stap, calls, ...resultaat });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await admin.from("exact_sync_log").insert({ trigger_type: "spiegel_sync", status: "error", error_message: msg.slice(0, 500), payload: { stap, run_id: runId, calls } });
    return json({ success: false, stap, calls, error: "Spiegel-sync mislukt", detail: msg.slice(0, 300) }, 502);
  }
});

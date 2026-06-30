// Eenmalige testfunctie: maakt 2 concept-verkoopfacturen in Exact aan op
// 2 nieuwe testrelaties ("TEST Maandbetaler" / "TEST Jaarbetaler"), met
// StartTime/EndTime op SalesInvoiceLine-niveau. Status = 20 (Concept), zodat
// ze handmatig verwijderbaar zijn in Exact.
//
// Auth: alleen admin of supervisor.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Vaste master data — zelfde als lead-to-exact-activate
const INV_JOURNAL = "70";
const INV_PAYMENT_COND = "IN";
const INV_VAT_CODE = "0";
const INV_GL_ACCOUNT = "d40fbb95-43b0-4503-9fe8-287f14d59120";
const INV_STATUS_CONCEPT = 20;

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

async function captureError(label: string, res: Response) {
  const bodyText = await res.text().catch(() => "");
  let bodyJson: unknown = null;
  try { bodyJson = JSON.parse(bodyText); } catch (_) { /* */ }
  return {
    label, http_status: res.status, http_status_text: res.statusText,
    body_raw: bodyText.slice(0, 2000), body_json: bodyJson,
  };
}

async function createTestAccount(opts: {
  baseUrl: string; div: string; headers: Record<string, string>; name: string;
}): Promise<{ ok: true; accountId: string } | { ok: false; error: unknown }> {
  const { baseUrl, div, headers, name } = opts;
  const payload = {
    Name: name,
    Status: "C", // Klant
    IsSales: true,
  };
  const res = await fetch(`${baseUrl}/api/v1/${opts.div}/crm/Accounts`, {
    method: "POST", headers, body: JSON.stringify(payload),
  });
  if (!res.ok) return { ok: false, error: await captureError("Accounts POST", res) };
  const j = await res.json().catch(() => ({}));
  // deno-lint-ignore no-explicit-any
  const d: any = (j as any)?.d ?? j;
  return { ok: true, accountId: d?.ID };
}

async function createConceptInvoice(opts: {
  baseUrl: string; div: string; headers: Record<string, string>;
  accountId: string; description: string;
  unitPrice: number; lineDescription: string;
  startISO: string; endISO: string;
  itemId: string;
}): Promise<{ ok: true; invoiceId: string; invoiceNumber: string | null; raw: unknown } | { ok: false; error: unknown; payload: unknown }> {
  const today = new Date().toISOString();
  const line = {
    Item: opts.itemId,
    GLAccount: INV_GL_ACCOUNT,
    VATCode: INV_VAT_CODE,
    Quantity: 1,
    UnitPrice: opts.unitPrice,
    Description: opts.lineDescription,
    StartTime: opts.startISO,
    EndTime: opts.endISO,
  };
  const payload = {
    InvoiceTo: opts.accountId,
    OrderedBy: opts.accountId,
    Journal: INV_JOURNAL,
    PaymentCondition: INV_PAYMENT_COND,
    Type: 8020,
    Status: INV_STATUS_CONCEPT,
    InvoiceDate: today,
    OrderDate: today,
    Description: opts.description,
    SalesInvoiceLines: [line],
  };
  const res = await fetch(`${opts.baseUrl}/api/v1/${opts.div}/salesinvoice/SalesInvoices`, {
    method: "POST", headers: opts.headers, body: JSON.stringify(payload),
  });
  if (!res.ok) return { ok: false, error: await captureError("SalesInvoices POST", res), payload };
  const j = await res.json().catch(() => ({}));
  // deno-lint-ignore no-explicit-any
  const d: any = (j as any)?.d ?? j;
  return {
    ok: true,
    invoiceId: d?.InvoiceID || d?.ID || "",
    invoiceNumber: d?.InvoiceNumber != null ? String(d.InvoiceNumber) : null,
    raw: d,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "method_not_allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return json({ success: false, error: "unauthorized" }, 401);
  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) return json({ success: false, error: "unauthorized" }, 401);
  const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  // deno-lint-ignore no-explicit-any
  const roles = (roleRows ?? []).map((r: any) => r.role);
  if (!roles.includes("admin") && !roles.includes("supervisor")) {
    return json({ success: false, error: "forbidden" }, 403);
  }

  const { data: config } = await supabase.from("exact_config").select("*").maybeSingle();
  if (!config?.is_actief) return json({ success: false, error: "exact_niet_actief" }, 400);
  const baseUrl = config.base_url || "https://start.exactonline.nl";
  const div = config.divisie_code;
  const accessToken = await ensureValidToken(supabase, config);
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    Prefer: "return=representation",
  };
  const itemId = config.exact_item_id_bav_avb;
  if (!itemId) return json({ success: false, error: "exact_item_id_bav_avb_ontbreekt" }, 400);

  // Parse body — verify_invoice_ids → alleen verificatie, geen nieuwe inserts.
  // deno-lint-ignore no-explicit-any
  let body: any = {};
  try { body = await req.json(); } catch (_) { /* */ }
  const verifyOnlyIds: string[] | null = Array.isArray(body?.verify_invoice_ids) ? body.verify_invoice_ids : null;

  const results: Record<string, unknown> = {};



  if (!verifyOnlyIds) {
  // ── Test 1: Maandbetaler ──
  const acc1 = await createTestAccount({ baseUrl, div, headers, name: "TEST Maandbetaler" });
  if (!acc1.ok) return json({ success: false, step: "account_maand", error: acc1.error }, 500);
  const inv1 = await createConceptInvoice({
    baseUrl, div, headers,
    accountId: acc1.accountId,
    description: "TEST Maandbetaler — BAV-AVB premie dekking 01-10-2026 t/m 31-10-2026",
    unitPrice: 55,
    lineDescription: "BAV-AVB premie - Dekking 01-10-2026 t/m 31-10-2026",
    startISO: "2026-10-01T00:00:00",
    endISO: "2026-10-31T00:00:00",
    itemId,
  });
  if (!inv1.ok) return json({ success: false, step: "invoice_maand", account_id: acc1.accountId, error: inv1.error, payload: inv1.payload }, 500);
  results.maand = {
    account_id: acc1.accountId,
    invoice_id: inv1.invoiceId,
    invoice_number: inv1.invoiceNumber,
    line_start_time: "2026-10-01T00:00:00",
    line_end_time: "2026-10-31T00:00:00",
    amount: 55,
  };

  // ── Test 2: Jaarbetaler ──
  const acc2 = await createTestAccount({ baseUrl, div, headers, name: "TEST Jaarbetaler" });
  if (!acc2.ok) return json({ success: false, step: "account_jaar", error: acc2.error, results }, 500);
  const inv2 = await createConceptInvoice({
    baseUrl, div, headers,
    accountId: acc2.accountId,
    description: "TEST Jaarbetaler — BAV-AVB premie dekking 01-10-2026 t/m 30-09-2027",
    unitPrice: 660,
    lineDescription: "BAV-AVB premie - Dekking 01-10-2026 t/m 30-09-2027",
    startISO: "2026-10-01T00:00:00",
    endISO: "2027-09-30T00:00:00",
    itemId,
  });
  if (!inv2.ok) return json({ success: false, step: "invoice_jaar", account_id: acc2.accountId, error: inv2.error, payload: inv2.payload, results }, 500);
  results.jaar = {
    account_id: acc2.accountId,
    invoice_id: inv2.invoiceId,
    invoice_number: inv2.invoiceNumber,
    line_start_time: "2026-10-01T00:00:00",
    line_end_time: "2027-09-30T00:00:00",
    amount: 660,
  };
  } // end !verifyOnlyIds



  // ── Verificatie: regels ophalen om StartTime/EndTime zichtbaar te bevestigen
  const verifyOne = async (invoiceId: string) => {
    const url = `${baseUrl}/api/v1/${div}/salesinvoice/SalesInvoiceLines?$filter=InvoiceID eq guid'${invoiceId}'&$select=Description,UnitPrice,Quantity,StartTime,EndTime,InvoiceNumber`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } });
    if (!r.ok) return { ok: false, error: await captureError("verify GET", r) };
    const j = await r.json().catch(() => ({}));
    // deno-lint-ignore no-explicit-any
    const d: any = (j as any)?.d ?? j;
    const linesRaw = d?.results ?? (Array.isArray(d) ? d : []);
    return {
      ok: true,
      invoice_number: linesRaw[0]?.InvoiceNumber,
      // deno-lint-ignore no-explicit-any
      lines: linesRaw.map((l: any) => ({
        description: l.Description,
        unit_price: l.UnitPrice,
        start_time: l.StartTime,
        end_time: l.EndTime,
      })),
    };
  };
  // Skip-her-verify als invoice_id leeg is
  if (verifyOnlyIds) {
    for (let i = 0; i < verifyOnlyIds.length; i++) {
      results[`verify_${i}`] = { invoice_id: verifyOnlyIds[i], ...(await verifyOne(verifyOnlyIds[i])) };
    }
  } else {
    // deno-lint-ignore no-explicit-any
    const m: any = results.maand; const y: any = results.jaar;
    results.maand_verify = m?.invoice_id ? await verifyOne(m.invoice_id) : { ok: false, error: "no_invoice_id" };
    results.jaar_verify = y?.invoice_id ? await verifyOne(y.invoice_id) : { ok: false, error: "no_invoice_id" };
  }

  return json({ success: true, results });
});

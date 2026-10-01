// Portal: haalt live verkoopfacturen (Status=50) uit Exact voor de ingelogde klant.
// Lookup via _shared/klantAccounts.ts (polis én persoon → onderneming). Alleen Status=50 vanaf 17-10-2026.
// Geen lokale caching. Single source of truth = Exact.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { ensureValidToken } from "../_shared/exactToken.ts";
import { accountIdsVoorGebruiker, PORTAL_FACTUREN_VANAF } from "../_shared/klantAccounts.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });



async function captureExactError(label: string, res: Response) {
  const bodyText = await res.text().catch(() => "");
  let bodyJson: unknown = null;
  try { bodyJson = JSON.parse(bodyText); } catch (_) { /* */ }
  const headersObj: Record<string, string> = {};
  res.headers.forEach((v, k) => { headersObj[k] = v; });
  return {
    summary: `${label} ${res.status} ${res.statusText} — ${bodyText.slice(0, 600)}`,
    detail: { label, http_status: res.status, url: res.url, headers: headersObj, body_raw: bodyText, body_json: bodyJson },
  };
}

// deno-lint-ignore no-explicit-any
async function logSync(supabase: any, params: any) {
  try { await supabase.from("exact_sync_log").insert(params); } catch (e) { console.error("logSync failed", e); }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  try {
    // JWT-auth
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: "unauthorized" }, 401);

    const accountIds = await accountIdsVoorGebruiker(admin, user.id, user.email);
    if (accountIds.length === 0) return json({ invoices: [], reason: "no_exact_account" });

    // Exact config
    const { data: config } = await admin.from("exact_config").select("*").maybeSingle();
    if (!config?.is_actief) return json({ invoices: [], unavailable: true, message: "Facturen zijn tijdelijk niet beschikbaar" });
    if (!config?.divisie_code) throw new Error("exact_config niet gevonden of zonder divisie_code");
    const divisie = config.divisie_code;
    const baseUrl = config.base_url || "https://start.exactonline.nl";

    const token = await ensureValidToken(admin, config);

    // Bouw $filter: alle account-ids, status 50 (Open/definitief)
    const accountFilter = accountIds.map((a) => `InvoiceTo eq guid'${a}'`).join(" or ");
    // Alleen verwerkte facturen (50), nooit concepten, en geen historie vóór de planner-start.
    const filter = `(${accountFilter}) and Status eq 50 and InvoiceDate ge datetime'${PORTAL_FACTUREN_VANAF}'`;
    const select = [
      "InvoiceID", "InvoiceNumber", "InvoiceDate", "DueDate",
      "AmountFC", "Description", "Status", "PaymentReference",
      "YourRef", "InvoiceTo", "Type",
    ].join(",");


    const url = `${baseUrl}/api/v1/${divisie}/salesinvoice/SalesInvoices`
      + `?$filter=${encodeURIComponent(filter)}`
      + `&$select=${select}`
      + `&$orderby=InvoiceDate desc`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });

    if (!res.ok) {
      const err = await captureExactError("GET SalesInvoices", res);
      await logSync(admin, {
        trigger_type: "portal_invoices_fetch",
        status: "error",
        http_status: res.status,
        error_message: err.summary,
        payload: { user_id: user.id, account_ids: accountIds, detail: err.detail },
      });
      return json({ error: "exact_api_error", detail: err.summary }, 502);
    }

    const data = await res.json();
    // deno-lint-ignore no-explicit-any
    const rows: any[] = data?.d?.results ?? data?.d ?? [];

    const invIds = rows.map((r) => r.InvoiceID).filter(Boolean);
    const { data: plan } = invIds.length
      ? await admin.from("factuur_planning").select("exact_invoice_id,periode_start,periode_eind").in("exact_invoice_id", invIds)
      : { data: [] };
    const { data: cred } = invIds.length
      ? await admin.from("factuur_credit_planning").select("exact_invoice_id,credit_vanaf,credit_tm").in("exact_invoice_id", invIds)
      : { data: [] };
    const periode = new Map<string, { periode_start: string; periode_eind: string }>((plan ?? []).map((p) => [p.exact_invoice_id, p]));
    for (const c of cred ?? []) periode.set(c.exact_invoice_id, { periode_start: c.credit_vanaf, periode_eind: c.credit_tm });
    // Geen betaalstatus: alleen nummer, datum, periode en bedrag.
    const invoices = rows.map((r) => ({
      id: r.InvoiceID,
      factuurnummer: r.InvoiceNumber != null ? String(r.InvoiceNumber) : "",
      datum: r.InvoiceDate ?? null,
      periode_start: periode.get(r.InvoiceID)?.periode_start ?? null,
      periode_eind: periode.get(r.InvoiceID)?.periode_eind ?? null,
      bedrag: Number(r.AmountFC ?? 0),
      omschrijving: r.Description ?? "",
      soort: Number(r.Type) === 8021 ? "creditnota" : "factuur",
    }));

    await logSync(admin, {
      trigger_type: "portal_invoices_fetch",
      status: "ok",
      http_status: 200,
      payload: {
        user_id: user.id,
        account_ids: accountIds,
        count: invoices.length,
      },
    });


    return json({ invoices });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("get-customer-invoices error:", msg);
    await logSync(admin, {
      trigger_type: "portal_invoices_fetch",
      status: "error",
      error_message: msg,
      payload: { error: msg },
    });
    return json({ error: msg }, 500);
  }
});

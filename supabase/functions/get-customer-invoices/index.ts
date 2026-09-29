// Portal: haalt live verkoopfacturen (Status=50) uit Exact voor de ingelogde klant.
// Lookup: auth.uid() → policies.user_id → policies.lead_id → leads.exact_account_id.
// Geen lokale caching. Single source of truth = Exact.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { ensureValidToken } from "../_shared/exactToken.ts";

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

function mapStatus(dueDate: string | null): "vervallen" | "open" {
  // Geen PaymentStatus op SalesInvoice. Betaald-status volgt later via ReceivablesList (backlog v1.1).
  if (dueDate && new Date(dueDate).getTime() < Date.now()) return "vervallen";
  return "open";
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

    // Lookup lead via policies.user_id → lead_id → leads.exact_account_id
    const { data: pols } = await admin
      .from("policies")
      .select("lead_id")
      .eq("user_id", user.id)
      .not("lead_id", "is", null);

    const leadIds = Array.from(new Set((pols ?? []).map((p) => p.lead_id).filter(Boolean))) as string[];
    if (leadIds.length === 0) return json({ invoices: [], reason: "no_policies" });

    const { data: leads } = await admin
      .from("leads")
      .select("id, exact_account_id")
      .in("id", leadIds)
      .not("exact_account_id", "is", null);

    const accountIds = Array.from(new Set((leads ?? []).map((l) => l.exact_account_id).filter(Boolean))) as string[];
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
    const filter = `(${accountFilter}) and Status eq 50`;
    const select = [
      "InvoiceID", "InvoiceNumber", "InvoiceDate", "DueDate",
      "AmountFC", "Description", "Status", "PaymentReference",
      "YourRef", "InvoiceTo",
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

    const invoices = rows.map((r) => ({
      id: r.InvoiceID,
      factuurnummer: r.InvoiceNumber != null ? String(r.InvoiceNumber) : "",
      datum: r.InvoiceDate ?? null,
      vervaldatum: r.DueDate ?? null,
      bedrag: Number(r.AmountFC ?? 0),
      status: mapStatus(r.DueDate ?? null),
      omschrijving: r.Description ?? "",
      payment_reference: r.PaymentReference ?? null,
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

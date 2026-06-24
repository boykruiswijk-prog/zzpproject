// Portal: streamt PDF van één Exact verkoopfactuur naar de ingelogde klant.
// Validatie: factuur moet bij een lead horen waar de user via policies aan gekoppeld is.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// deno-lint-ignore no-explicit-any
async function ensureValidToken(supabase: any, config: any): Promise<string> {
  const baseUrl = config.base_url || "https://start.exactonline.nl";
  const expiresAt = config.access_token_expires_at
    ? new Date(config.access_token_expires_at)
    : new Date(0);
  if (expiresAt.getTime() - Date.now() > 60_000 && config.access_token) {
    return config.access_token;
  }
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
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const invoiceId = String(body?.invoice_id ?? "").trim();
    if (!invoiceId || !/^[0-9a-f-]{36}$/i.test(invoiceId)) return json({ error: "invalid_invoice_id" }, 400);

    // Whitelist: account_ids die bij deze user horen
    const { data: pols } = await admin
      .from("policies").select("lead_id").eq("user_id", user.id).not("lead_id", "is", null);
    const leadIds = Array.from(new Set((pols ?? []).map((p) => p.lead_id))) as string[];
    if (leadIds.length === 0) return json({ error: "forbidden" }, 403);
    const { data: leads } = await admin
      .from("leads").select("exact_account_id").in("id", leadIds).not("exact_account_id", "is", null);
    const allowedAccountIds = new Set((leads ?? []).map((l) => l.exact_account_id));
    if (allowedAccountIds.size === 0) return json({ error: "forbidden" }, 403);

    const { data: config } = await admin.from("exact_config").select("*").maybeSingle();
    if (!config?.divisie_code) throw new Error("exact_config niet gevonden");
    const divisie = config.divisie_code;
    const baseUrl = config.base_url || "https://start.exactonline.nl";
    const token = await ensureValidToken(admin, config);

    // Stap 1: valideer eigenaarschap via Exact lookup
    const checkUrl = `${baseUrl}/api/v1/${divisie}/salesinvoice/SalesInvoices(guid'${invoiceId}')?$select=InvoiceID,InvoiceTo,InvoiceNumber,Status`;
    const checkRes = await fetch(checkUrl, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
    if (!checkRes.ok) {
      const bodyText = await checkRes.text();
      await logSync(admin, {
        trigger_type: "customer_invoice_pdf",
        status: "error",
        http_status: checkRes.status,
        error_message: `validate ${checkRes.status}: ${bodyText.slice(0, 300)}`,
        payload: { user_id: user.id, invoice_id: invoiceId, phase: "validate" },
      });
      return json({ error: "invoice_lookup_failed" }, 404);
    }
    const checkData = await checkRes.json();
    const invoice = checkData?.d ?? null;
    if (!invoice || !allowedAccountIds.has(invoice.InvoiceTo)) {
      await logSync(admin, {
        trigger_type: "customer_invoice_pdf", status: "forbidden", http_status: 403,
        error_message: "ownership_mismatch",
        payload: { user_id: user.id, invoice_id: invoiceId, invoice_to: invoice?.InvoiceTo ?? null },
      });
      return json({ error: "forbidden" }, 403);
    }

    // Stap 2: download PDF. Endpoint: docs/PrintDocument.aspx (Exact REST geeft geen native PDF terug,
    // de officiele PDF-route is XMLDownload.aspx).
    const pdfUrl = `${baseUrl}/docs/XMLDownload.aspx?Topic=SalesInvoice&Format=Pdf&Params_InvoiceID=${invoiceId}&Division=${divisie}`;
    const pdfRes = await fetch(pdfUrl, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/pdf" },
    });
    if (!pdfRes.ok) {
      const bodyText = await pdfRes.text().catch(() => "");
      await logSync(admin, {
        trigger_type: "customer_invoice_pdf", status: "error", http_status: pdfRes.status,
        error_message: `pdf ${pdfRes.status}: ${bodyText.slice(0, 300)}`,
        payload: { user_id: user.id, invoice_id: invoiceId, phase: "pdf", url: pdfUrl },
      });
      return json({ error: "pdf_fetch_failed", detail: bodyText.slice(0, 300) }, 502);
    }
    const ctype = pdfRes.headers.get("content-type") || "";
    const buf = await pdfRes.arrayBuffer();

    if (!ctype.toLowerCase().includes("pdf")) {
      // Exact gaf HTML terug (login-redirect of error-pagina). Log voor diagnose.
      await logSync(admin, {
        trigger_type: "customer_invoice_pdf", status: "error", http_status: pdfRes.status,
        error_message: `unexpected_content_type: ${ctype}`,
        payload: { user_id: user.id, invoice_id: invoiceId, content_type: ctype, byte_length: buf.byteLength },
      });
      return json({ error: "pdf_endpoint_invalid", content_type: ctype }, 502);
    }

    await logSync(admin, {
      trigger_type: "customer_invoice_pdf", status: "ok", http_status: 200,
      payload: { user_id: user.id, invoice_id: invoiceId, byte_length: buf.byteLength, invoice_number: invoice.InvoiceNumber },
    });

    const filename = `factuur-${invoice.InvoiceNumber || invoiceId}.pdf`;
    return new Response(buf, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("get-invoice-pdf error:", msg);
    await logSync(admin, { trigger_type: "customer_invoice_pdf", status: "error", error_message: msg, payload: { error: msg } });
    return json({ error: msg }, 500);
  }
});

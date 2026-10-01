// Portal: streamt PDF van één Exact verkoopfactuur naar de ingelogde klant.
// Validatie: factuur hoort bij een account van de klant (polis of persoon), Status 50, vanaf 17-10-2026.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { ensureValidToken } from "../_shared/exactToken.ts";
import { accountIdsVoorGebruiker, PORTAL_FACTUREN_VANAF } from "../_shared/klantAccounts.ts";
import { haalFactuurPdf } from "../_shared/exactFactuurPdf.ts";

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

    const allowedAccountIds = new Set(await accountIdsVoorGebruiker(admin, user.id, user.email));
    if (allowedAccountIds.size === 0) return json({ error: "forbidden" }, 403);

    const { data: config } = await admin.from("exact_config").select("*").maybeSingle();
    if (!config?.is_actief) return json({ error: "exact_unavailable", message: "Facturen zijn tijdelijk niet beschikbaar" }, 503);
    if (!config?.divisie_code) throw new Error("exact_config niet gevonden");
    const divisie = config.divisie_code;
    const baseUrl = config.base_url || "https://start.exactonline.nl";
    const token = await ensureValidToken(admin, config);

    // Stap 1: valideer eigenaarschap via Exact lookup
    const checkUrl = `${baseUrl}/api/v1/${divisie}/salesinvoice/SalesInvoices(guid'${invoiceId}')?$select=InvoiceID,InvoiceTo,InvoiceNumber,Status,InvoiceDate`;
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
    const datumMs = Number(String(invoice?.InvoiceDate ?? "").match(/\d+/)?.[0] ?? 0);
    const datum = datumMs ? new Date(datumMs).toISOString().slice(0, 10) : "";
    if (!invoice || !allowedAccountIds.has(invoice.InvoiceTo) || Number(invoice.Status) !== 50 || datum < PORTAL_FACTUREN_VANAF) {
      await logSync(admin, {
        trigger_type: "customer_invoice_pdf", status: "forbidden", http_status: 403,
        error_message: "ownership_mismatch",
        payload: { user_id: user.id, invoice_id: invoiceId, invoice_to: invoice?.InvoiceTo ?? null },
      });
      return json({ error: "forbidden" }, 403);
    }

    // Stap 2: PDF via Exact-documenten (alleen lezen), zie _shared/exactFactuurPdf.ts.
    const pdf = await haalFactuurPdf(baseUrl, divisie, token, invoice.InvoiceNumber);
    if (!pdf.ok) {
      await logSync(admin, {
        trigger_type: "customer_invoice_pdf", status: "error", http_status: pdf.http ?? null,
        error_message: `pdf: ${pdf.reden}`, payload: { user_id: user.id, invoice_id: invoiceId, phase: "pdf" },
      });
      return json({ error: "pdf_fetch_failed", reden: pdf.reden }, 502);
    }
    const buf = pdf.bytes;

    await logSync(admin, {
      trigger_type: "customer_invoice_pdf", status: "ok", http_status: 200,
      payload: { user_id: user.id, invoice_id: invoiceId, byte_length: buf.length, invoice_number: invoice.InvoiceNumber },
    });

    const filename = `factuur-${invoice.InvoiceNumber || invoiceId}.pdf`;
    return new Response(buf as unknown as BodyInit, {
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

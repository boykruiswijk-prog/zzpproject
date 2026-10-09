// Exact Online sync — handelt tokenrefresh automatisch af en kan
// een test-call doen of een nieuwe relatie aanmaken.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { ensureValidToken } from "../_shared/exactToken.ts";
import { requireSupervisor } from "../_shared/teamAuth.ts";
import { checkConfiguredDivision } from "../_shared/exactDivision.ts";
import { metExactMelding } from "../_shared/exactBoekingMelding.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};



// deno-lint-ignore no-explicit-any
async function logSync(supabase: any, params: {
  trigger_type: string;
  status: string;
  exact_account_id?: string | null;
  error_message?: string | null;
  payload?: unknown;
  http_status?: number | null;
}) {
  await supabase.from("exact_sync_log").insert(params);
}

Deno.serve(metExactMelding("exact-sync", async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const auth = await requireSupervisor(req, supabase);
  if (auth instanceof Response) return new Response(await auth.text(), { status: auth.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  // deno-lint-ignore no-explicit-any
  let body: any = {};
  try {
    body = await req.json();
  } catch (_) { /* leeg body ok */ }

  const triggerType = body.trigger_type || "manual";
  const testMode = body.test === true;
  const syncNow = body.action === "sync_now";
  const switchDivision = body.action === "switch_division";
  const exploreMode = body.action === "explore";

  try {
    const { data: config } = await supabase
      .from("exact_config")
      .select("*")
      .maybeSingle();

    if (!config?.is_actief) {
      await logSync(supabase, {
        trigger_type: triggerType,
        status: "skipped",
        error_message: "Koppeling is niet actief",
      });
      return new Response(
        JSON.stringify({
          success: true,
          exact_actief: false,
          message: "Exact Online koppeling staat op niet-actief.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!config.client_id || !config.client_secret) {
      throw new Error("client_id of client_secret ontbreekt in exact_config");
    }

    const accessToken = await ensureValidToken(supabase, config);
    const baseUrl = config.base_url || "https://start.exactonline.nl";

    const divisionCode = String(config.divisie_code ?? "");
    if (!divisionCode) throw new Error("Geen geconfigureerde Exact-administratie.");

    if (testMode) {
      const testData = await checkConfiguredDivision(baseUrl, divisionCode, accessToken);
      if (!testData.ok) {
        await logSync(supabase, {
          trigger_type: triggerType,
          status: "error",
          error_message: testData.error,
          http_status: testData.status,
        });
        throw new Error(`Test mislukt (${testData.status})`);
      }

      await logSync(supabase, {
        trigger_type: triggerType,
        status: "success",
        payload: testData,
        http_status: testData.status,
      });

      await supabase
        .from("exact_config")
        .update({ last_sync_at: new Date().toISOString() })
        .eq("id", config.id);

      return new Response(
        JSON.stringify({ success: true, test: true, exact_data: testData, divisie_code: divisionCode }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (syncNow) {
      const headers = { Authorization: `Bearer ${accessToken}`, Accept: "application/json" };
      const accRes = await fetch(
        `${baseUrl}/api/v1/${divisionCode}/crm/Accounts?$select=ID,Name,Email,ChamberOfCommerce&$top=50&$orderby=Modified desc`,
        { headers },
      );
      const accJson = await accRes.json();
      if (!accRes.ok) {
        await logSync(supabase, {
          trigger_type: triggerType, status: "error",
          error_message: `Accounts ophalen mislukt: ${JSON.stringify(accJson)}`,
          http_status: accRes.status,
        });
        await supabase.from("exact_config")
          .update({ last_error: `Accounts ${accRes.status}` }).eq("id", config.id);
        throw new Error(`Accounts ophalen mislukt (${accRes.status})`);
      }
      const accounts = Array.isArray(accJson?.d?.results)
        ? accJson.d.results
        : Array.isArray(accJson?.d) ? accJson.d : [];

      const invRes = await fetch(
        `${baseUrl}/api/v1/${divisionCode}/salesinvoice/SalesInvoices?$select=InvoiceID,InvoiceNumber,InvoiceDate,AmountDC,Status&$top=10&$orderby=InvoiceDate desc`,
        { headers },
      );
      const invJson = await invRes.json();
      const invoices = invRes.ok
        ? (Array.isArray(invJson?.d?.results) ? invJson.d.results : Array.isArray(invJson?.d) ? invJson.d : [])
        : [];

      const accountsSample = accounts.slice(0, 3).map((a: { Name?: string }) => a?.Name ?? "—");
      await logSync(supabase, {
        trigger_type: triggerType, status: "success",
        payload: {
          accounts_count: accounts.length,
          invoices_count: invoices.length,
          accounts_sample: accountsSample,
          accounts_preview: accounts.slice(0, 10),
          invoices_preview: invoices.slice(0, 10),
        },
        http_status: accRes.status,
      });
      await supabase.from("exact_config")
        .update({ last_sync_at: new Date().toISOString(), last_error: null })
        .eq("id", config.id);

      return new Response(
        JSON.stringify({
          success: true, sync_now: true,
          divisie_code: divisionCode,
          accounts_count: accounts.length,
          invoices_count: invoices.length,
          accounts_sample: accounts.slice(0, 3),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (switchDivision) {
      return new Response(
        JSON.stringify({ error: "switch_division_uitgeschakeld" }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (exploreMode) {
      const h = { Authorization: `Bearer ${accessToken}`, Accept: "application/json" };
      const fetchJson = async (url: string) => {
        const r = await fetch(url, { headers: h });
        const j = await r.json().catch(() => ({}));
        const arr = Array.isArray(j?.d?.results) ? j.d.results : Array.isArray(j?.d) ? j.d : [];
        return { status: r.status, ok: r.ok, data: arr, raw: j };
      };
      const items = await fetchJson(`${baseUrl}/api/v1/${divisionCode}/logistics/Items?$select=ID,Code,Description,SalesVatCode&$top=20`);
      const gl = await fetchJson(`${baseUrl}/api/v1/${divisionCode}/financial/GLAccounts?$select=ID,Code,Description&$filter=startswith(Code,'8')&$top=20`);
      const vat = await fetchJson(`${baseUrl}/api/v1/${divisionCode}/vat/VATCodes?$select=ID,Code,Description,Percentage&$top=100`);
      return new Response(
        JSON.stringify({ success: true, divisie_code: divisionCode, items, gl_accounts: gl, vat_codes: vat }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const relatie = body.relatie;
    if (!relatie || !relatie.Name) {
      throw new Error("Geen relatie-data meegegeven (verwacht body.relatie met minimaal Name)");
    }

    // deno-lint-ignore no-explicit-any
    const accountPayload: any = {
      Name: relatie.Name,
      Email: relatie.Email || null,
      Phone: relatie.Phone || null,
      ChamberOfCommerce: relatie.ChamberOfCommerce || null,
      IsSupplier: false,
      Status: "C",
    };
    if (relatie.AddressLine1) accountPayload.AddressLine1 = relatie.AddressLine1;
    if (relatie.Postcode) accountPayload.Postcode = relatie.Postcode;
    if (relatie.City) accountPayload.City = relatie.City;
    if (relatie.Country) accountPayload.Country = relatie.Country;
    if (relatie.VATNumber) accountPayload.VATNumber = relatie.VATNumber;

    const accountRes = await fetch(
      `${baseUrl}/api/v1/${config.divisie_code}/crm/Accounts`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(accountPayload),
      },
    );

    const accountData = await accountRes.json();

    if (!accountRes.ok) {
      await logSync(supabase, {
        trigger_type: triggerType,
        status: "error",
        error_message: `Account-creatie mislukt: ${JSON.stringify(accountData)}`,
        payload: accountPayload,
        http_status: accountRes.status,
      });
      await supabase
        .from("exact_config")
        .update({
          last_error: `Account-creatie ${accountRes.status}: ${JSON.stringify(accountData).slice(0, 500)}`,
        })
        .eq("id", config.id);
      throw new Error(`Account-creatie mislukt (${accountRes.status})`);
    }

    const exactAccountId = accountData?.d?.ID || accountData?.ID;

    await logSync(supabase, {
      trigger_type: triggerType,
      status: "success",
      exact_account_id: exactAccountId,
      payload: accountPayload,
      http_status: accountRes.status,
    });

    await supabase
      .from("exact_config")
      .update({ last_sync_at: new Date().toISOString(), last_error: null })
      .eq("id", config.id);

    return new Response(
      JSON.stringify({
        success: true,
        exact_account_id: exactAccountId,
        message: "Relatie aangemaakt in Exact Online",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
}));

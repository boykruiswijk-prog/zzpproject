// Exact Online sync — handelt tokenrefresh automatisch af en kan
// een test-call doen of een nieuwe relatie aanmaken.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// deno-lint-ignore no-explicit-any
async function ensureValidToken(supabase: any, config: any): Promise<string> {
  const baseUrl = config.base_url || "https://start.exactonline.nl";
  const expiresAt = config.access_token_expires_at
    ? new Date(config.access_token_expires_at)
    : new Date(0);

  if (expiresAt.getTime() - Date.now() > 60_000 && config.access_token) {
    return config.access_token;
  }

  if (!config.refresh_token) {
    throw new Error("Geen refresh_token aanwezig. Start de OAuth-flow opnieuw vanuit admin.");
  }

  const tokenRes = await fetch(`${baseUrl}/api/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: config.refresh_token,
      client_id: config.client_id,
      client_secret: config.client_secret,
    }).toString(),
  });

  const tokenData = await tokenRes.json();
  if (!tokenRes.ok || !tokenData.access_token) {
    throw new Error(`Refresh mislukt (${tokenRes.status}): ${JSON.stringify(tokenData)}`);
  }

  const newExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();
  await supabase
    .from("exact_config")
    .update({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      access_token_expires_at: newExpiresAt,
      token_expires_at: newExpiresAt,
      refresh_token_obtained_at: new Date().toISOString(),
      last_error: null,
    })
    .eq("id", config.id);

  return tokenData.access_token;
}

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // deno-lint-ignore no-explicit-any
  let body: any = {};
  try {
    body = await req.json();
  } catch (_) { /* leeg body ok */ }

  const triggerType = body.trigger_type || "manual";
  const testMode = body.test === true;

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

    if (!config.client_id || !config.client_secret || !config.divisie_code) {
      throw new Error("client_id, client_secret of divisie_code ontbreekt in exact_config");
    }

    const accessToken = await ensureValidToken(supabase, config);
    const baseUrl = config.base_url || "https://start.exactonline.nl";

    if (testMode) {
      const testRes = await fetch(
        `${baseUrl}/api/v1/current/Me?$select=CurrentDivision,UserName`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json",
          },
        },
      );
      const testData = await testRes.json();

      if (!testRes.ok) {
        await logSync(supabase, {
          trigger_type: triggerType,
          status: "error",
          error_message: `Test API call mislukt: ${JSON.stringify(testData)}`,
          http_status: testRes.status,
        });
        throw new Error(`Test mislukt (${testRes.status})`);
      }

      await logSync(supabase, {
        trigger_type: triggerType,
        status: "success",
        payload: testData,
        http_status: testRes.status,
      });

      await supabase
        .from("exact_config")
        .update({ last_sync_at: new Date().toISOString() })
        .eq("id", config.id);

      return new Response(
        JSON.stringify({ success: true, test: true, exact_data: testData }),
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
});

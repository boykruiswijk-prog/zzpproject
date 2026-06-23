// Lead-to-Exact Fase 1: maakt Account + Contact + BankAccount + SEPA-mandaat
// aan in Exact divisie 4401707 (ZP Zaken B.V.) op basis van een lead.
// Doet GEEN factuur — fase 2.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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
  if (!r.ok || !td.access_token) {
    throw new Error(`Refresh mislukt (${r.status}): ${JSON.stringify(td)}`);
  }
  const newExpiresAt = new Date(Date.now() + td.expires_in * 1000).toISOString();
  await supabase
    .from("exact_config")
    .update({
      access_token: td.access_token,
      refresh_token: td.refresh_token,
      access_token_expires_at: newExpiresAt,
      token_expires_at: newExpiresAt,
      refresh_token_obtained_at: new Date().toISOString(),
    })
    .eq("id", config.id);
  return td.access_token;
}

// deno-lint-ignore no-explicit-any
async function logSync(supabase: any, params: any) {
  try {
    await supabase.from("exact_sync_log").insert(params);
  } catch (e) {
    console.error("logSync failed", e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") return json({ success: false, error: "method_not_allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // ── Auth: admin only ──
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return json({ success: false, error: "unauthorized" }, 401);
  }
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) return json({ success: false, error: "unauthorized" }, 401);
  const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
  if (!isAdmin) return json({ success: false, error: "forbidden" }, 403);

  // deno-lint-ignore no-explicit-any
  let body: any = {};
  try { body = await req.json(); } catch (_) {}
  const leadId = body?.lead_id;
  if (!leadId || typeof leadId !== "string") {
    return json({ success: false, error: "lead_id_required" }, 400);
  }

  // ── Pre-flight: lead ophalen ──
  const { data: lead, error: leadErr } = await supabase
    .from("leads").select("*").eq("id", leadId).maybeSingle();
  if (leadErr || !lead) return json({ success: false, error: "lead_not_found" }, 404);

  if (lead.exact_account_id) {
    return json({
      success: false,
      error: `Lead is al gekoppeld aan Exact relatie ${lead.exact_account_id}`,
      exact_account_id: lead.exact_account_id,
    }, 409);
  }
  if (lead.status === "afgewezen") {
    return json({ success: false, error: "Afgewezen leads kunnen niet worden geactiveerd" }, 400);
  }

  const missing: string[] = [];
  if (!lead.voornaam) missing.push("voornaam");
  if (!lead.achternaam) missing.push("achternaam");
  if (!lead.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)) missing.push("email");
  if (!lead.telefoon) missing.push("telefoon");
  if (!lead.bedrijfsnaam) missing.push("bedrijfsnaam");
  if (!lead.kvk_nummer || !/^\d{8}$/.test(String(lead.kvk_nummer))) missing.push("kvk_nummer");
  if (!lead.adres_postcode) missing.push("adres_postcode");
  if (!lead.adres_huisnummer) missing.push("adres_huisnummer");
  if (!lead.adres_straat) missing.push("adres_straat");
  if (!lead.adres_plaats) missing.push("adres_plaats");
  if (!lead.branche) missing.push("branche");
  if (!lead.gekozen_pakket) missing.push("gekozen_pakket");
  if (!lead.iban) missing.push("iban");
  if (!lead.sepa_akkoord) missing.push("sepa_akkoord");
  if (!lead.ingangsdatum) missing.push("ingangsdatum");
  if (missing.length) {
    return json({ success: false, error: "velden_ontbreken", missing }, 400);
  }

  // ── Exact config laden ──
  const { data: config } = await supabase.from("exact_config").select("*").maybeSingle();
  if (!config?.is_actief) return json({ success: false, error: "exact_niet_actief" }, 400);
  if (!config.divisie_code) return json({ success: false, error: "divisie_code_ontbreekt" }, 400);

  const baseUrl = config.base_url || "https://start.exactonline.nl";
  const div = config.divisie_code;
  const accessToken = await ensureValidToken(supabase, config);
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    Prefer: "return=representation",
  };

  // ── Duplicate check op KvK in Exact ──
  const kvk = String(lead.kvk_nummer);
  try {
    const dupRes = await fetch(
      `${baseUrl}/api/v1/${div}/crm/Accounts?$select=ID,Name,ChamberOfCommerce&$filter=ChamberOfCommerce eq '${kvk}'&$top=1`,
      { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } },
    );
    const dupJson = await dupRes.json().catch(() => ({}));
    const dupArr = Array.isArray(dupJson?.d?.results) ? dupJson.d.results : Array.isArray(dupJson?.d) ? dupJson.d : [];
    if (dupArr.length > 0) {
      return json({
        success: false,
        error: "duplicate_kvk_in_exact",
        exact_account_id: dupArr[0]?.ID,
        exact_account_name: dupArr[0]?.Name,
      }, 409);
    }
  } catch (e) {
    console.warn("Duplicate check failed (continuing):", e);
  }

  const ingangFmt = (() => {
    try {
      const d = new Date(lead.ingangsdatum);
      return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
    } catch { return String(lead.ingangsdatum); }
  })();

  const accountPayload = {
    Name: String(lead.bedrijfsnaam),
    ChamberOfCommerce: kvk,
    Email: lead.email,
    Phone: lead.telefoon,
    AddressLine1: `${lead.adres_straat} ${lead.adres_huisnummer}`.trim(),
    Postcode: String(lead.adres_postcode).toUpperCase().replace(/\s+/g, " "),
    City: lead.adres_plaats,
    Country: "NL",
    Status: "C",
    IsSales: true,
    Remarks:
      `Online aanvraag via zpzaken.nl op ${new Date().toLocaleDateString("nl-NL")}\n` +
      `Gekozen pakket: ${lead.gekozen_pakket}\n` +
      `Branche: ${lead.branche}\n` +
      `Ingangsdatum: ${ingangFmt}`,
  };

  // ── Stap D: Account aanmaken ──
  const accRes = await fetch(`${baseUrl}/api/v1/${div}/crm/Accounts`, {
    method: "POST", headers, body: JSON.stringify(accountPayload),
  });
  const accData = await accRes.json().catch(() => ({}));
  if (!accRes.ok) {
    await logSync(supabase, {
      trigger_type: "lead_activation", status: "error",
      lead_id: leadId, admin_user_id: user.id,
      http_status: accRes.status,
      error_message: `Account-creatie mislukt: ${JSON.stringify(accData).slice(0, 1000)}`,
      payload: accountPayload,
    });
    return json({ success: false, error: "exact_account_create_failed", detail: accData, http_status: accRes.status }, 500);
  }
  const exactAccountId: string = accData?.d?.ID || accData?.ID;
  if (!exactAccountId) {
    return json({ success: false, error: "no_account_id_returned", raw: accData }, 500);
  }

  // ── Helper voor rollback ──
  const deleteAccount = async () => {
    try {
      await fetch(`${baseUrl}/api/v1/${div}/crm/Accounts(guid'${exactAccountId}')`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
      });
    } catch (e) { console.error("Rollback delete account failed:", e); }
  };

  // ── Stap E: Contact ──
  let exactContactId: string | null = null;
  try {
    const cRes = await fetch(`${baseUrl}/api/v1/${div}/crm/Contacts`, {
      method: "POST", headers,
      body: JSON.stringify({
        Account: exactAccountId,
        FirstName: lead.voornaam,
        LastName: lead.achternaam,
        Email: lead.email,
        Phone: lead.telefoon,
        IsMainContact: true,
      }),
    });
    const cJson = await cRes.json().catch(() => ({}));
    if (!cRes.ok) throw new Error(`Contact ${cRes.status}: ${JSON.stringify(cJson).slice(0, 500)}`);
    exactContactId = cJson?.d?.ID || cJson?.ID || null;
  } catch (e) {
    await deleteAccount();
    const msg = e instanceof Error ? e.message : String(e);
    await logSync(supabase, {
      trigger_type: "lead_activation", status: "error",
      lead_id: leadId, admin_user_id: user.id,
      error_message: `Contact creatie mislukt (rollback uitgevoerd): ${msg}`,
    });
    return json({ success: false, error: "contact_create_failed", detail: msg }, 500);
  }

  // ── Stap F: BankAccount ──
  let exactBankAccountId: string | null = null;
  try {
    const ibanClean = String(lead.iban).replace(/\s+/g, "").toUpperCase();
    const bRes = await fetch(`${baseUrl}/api/v1/${div}/crm/BankAccounts`, {
      method: "POST", headers,
      body: JSON.stringify({
        Account: exactAccountId,
        BankAccount: ibanClean,
        BankAccountHolderName: lead.bedrijfsnaam,
        Type: 10,
      }),
    });
    const bJson = await bRes.json().catch(() => ({}));
    if (!bRes.ok) throw new Error(`BankAccount ${bRes.status}: ${JSON.stringify(bJson).slice(0, 500)}`);
    exactBankAccountId = bJson?.d?.ID || bJson?.ID || null;
  } catch (e) {
    await deleteAccount();
    const msg = e instanceof Error ? e.message : String(e);
    await logSync(supabase, {
      trigger_type: "lead_activation", status: "error",
      lead_id: leadId, admin_user_id: user.id,
      error_message: `BankAccount creatie mislukt (rollback): ${msg}`,
    });
    return json({ success: false, error: "bankaccount_create_failed", detail: msg }, 500);
  }

  // ── Stap G: SEPA-mandaat (DirectDebitMandate) — niet-fataal ──
  let exactMandateId: string | null = null;
  let mandateWarning: string | null = null;
  try {
    const mandateDate = lead.sepa_akkoord_datum
      ? new Date(lead.sepa_akkoord_datum).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0];
    const mRes = await fetch(`${baseUrl}/api/v1/${div}/cashflow/DirectDebitMandates`, {
      method: "POST", headers,
      body: JSON.stringify({
        Account: exactAccountId,
        BankAccount: exactBankAccountId,
        MandateDate: mandateDate,
        Reference: `MNDT-${leadId.slice(0, 8)}`,
        Type: "B2B",
      }),
    });
    const mJson = await mRes.json().catch(() => ({}));
    if (!mRes.ok) {
      mandateWarning = `SEPA-mandaat niet aangemaakt (${mRes.status}): ${JSON.stringify(mJson).slice(0, 300)}. Account + bankrekening staan wel klaar.`;
      console.warn(mandateWarning);
    } else {
      exactMandateId = mJson?.d?.ID || mJson?.ID || null;
    }
  } catch (e) {
    mandateWarning = `SEPA-mandaat exception: ${e instanceof Error ? e.message : e}`;
  }

  // ── Stap H: lead updaten ──
  const auditEntry = {
    timestamp: new Date().toISOString(),
    action: "Polis geactiveerd in Exact",
    admin_user_id: user.id,
    admin_email: user.email,
    exact_account_id: exactAccountId,
    exact_contact_id: exactContactId,
    exact_bankaccount_id: exactBankAccountId,
    exact_mandate_id: exactMandateId,
    mandate_warning: mandateWarning,
  };
  const newLog = Array.isArray(lead.activatie_log)
    ? [...lead.activatie_log, auditEntry]
    : [auditEntry];

  await supabase.from("leads").update({
    exact_account_id: exactAccountId,
    exact_relatie_id: exactAccountId,
    status: "actief",
    geactiveerd_door: user.id,
    geactiveerd_op: new Date().toISOString(),
    activatie_log: newLog,
    exact_status: "gesynchroniseerd",
    exact_sync_op: new Date().toISOString(),
    exact_fout: null,
  }).eq("id", leadId);

  await logSync(supabase, {
    trigger_type: "lead_activation",
    status: "success",
    lead_id: leadId,
    admin_user_id: user.id,
    exact_account_id: exactAccountId,
    http_status: 201,
    payload: {
      account: accountPayload,
      exact_account_id: exactAccountId,
      exact_contact_id: exactContactId,
      exact_bankaccount_id: exactBankAccountId,
      exact_mandate_id: exactMandateId,
      mandate_warning: mandateWarning,
    },
  });

  return json({
    success: true,
    exact_account_id: exactAccountId,
    exact_contact_id: exactContactId,
    exact_bankaccount_id: exactBankAccountId,
    exact_mandate_id: exactMandateId,
    mandate_warning: mandateWarning,
    message: "Klant succesvol geactiveerd in Exact",
  });
});

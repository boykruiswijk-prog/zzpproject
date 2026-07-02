// Lead-to-Exact Fase 1: maakt Account + Contact + BankAccount + SEPA-mandaat
// aan in Exact divisie 4401707 (ZP Zaken B.V.) op basis van een lead.
// Doet GEEN factuur — fase 2.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  isMaandPolis, getMaandprijs, lastOfMonth, calcMaandProrata, calcPolisEinddatum,
} from "../_shared/polisProRata.ts";

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

// Vangt complete Exact API error-response (headers + body) en geeft een rijk error-object terug.
async function captureExactError(label: string, res: Response): Promise<{ summary: string; detail: Record<string, unknown> }> {
  const bodyText = await res.text().catch(() => "");
  const headersObj: Record<string, string> = {};
  res.headers.forEach((v, k) => { headersObj[k] = v; });
  let bodyJson: unknown = null;
  try { bodyJson = JSON.parse(bodyText); } catch (_) { /* niet-JSON */ }
  const detail = {
    label,
    http_status: res.status,
    http_status_text: res.statusText,
    url: res.url,
    headers: headersObj,
    body_raw: bodyText,
    body_json: bodyJson,
  };
  const summary = `${label} ${res.status} ${res.statusText} — ${bodyText.slice(0, 600)}`;
  return { summary, detail };
}

// ── Fase 2: factuur-aanmaak helpers ────────────────────────────────────────
// Master data uit schema-introspectie ($metadata + lookups) — vaste codes.
const INV_JOURNAL = "70";              // Verkoopboek (Edm.String)
const INV_PAYMENT_COND = "IN";         // Incasso, 7 dagen, Method=I (Edm.String)
const INV_VAT_CODE = "0";              // BTW 0% (Edm.String)
const INV_GL_ACCOUNT = "d40fbb95-43b0-4503-9fe8-287f14d59120"; // 81000 Premie-omzet (Guid)
const INV_STATUS_CONCEPT = 20;         // 20 = Concept, 50 = Open

const PAKKET_INVOICE: Record<string, { naam: string; bedrag: number; betalingsregel: string }> = {
  "maandelijks": {
    naam: "BAV & AVB Maandelijks",
    bedrag: 660,
    betalingsregel: "Betaling: 12 termijnen van € 55 via SEPA-incasso",
  },
  "jaarlijks": {
    naam: "BAV & AVB Jaarlijks",
    bedrag: 600,
    betalingsregel: "Betaling: jaarlijks vooraf via SEPA-incasso",
  },
  "jaarlijks-cyber": {
    naam: "BAV & AVB Jaarlijks + Cyber",
    bedrag: 750,
    betalingsregel: "Betaling: jaarlijks vooraf via SEPA-incasso",
  },
  "jaarlijks_cyber": {
    naam: "BAV & AVB Jaarlijks + Cyber",
    bedrag: 750,
    betalingsregel: "Betaling: jaarlijks vooraf via SEPA-incasso",
  },
};

function resolvePakketInvoice(pakket: string | null | undefined) {
  if (!pakket) return null;
  return PAKKET_INVOICE[pakket] ?? null;
}

// Zorgt dat de ItemGroup 'DIENSTEN' bestaat in Exact en geeft de Guid terug.
// Schrijft naar exact_config.exact_item_group_id zodra bekend.
// deno-lint-ignore no-explicit-any
async function ensureItemGroup(opts: {
  supabase: any; config: any; baseUrl: string; div: string;
  headers: Record<string, string>; accessToken: string; logCtx: any;
}): Promise<{ ok: true; groupId: string; created: boolean; foundExisting: boolean } | { ok: false; summary: string; detail: Record<string, unknown>; httpStatus: number }> {
  const { supabase, config, baseUrl, div, headers, accessToken, logCtx } = opts;
  if (config.exact_item_group_id) {
    return { ok: true, groupId: config.exact_item_group_id, created: false, foundExisting: false };
  }
  // 1) Lookup op Code
  const lookupRes = await fetch(
    `${baseUrl}/api/v1/${div}/logistics/ItemGroups?$select=ID,Code&$filter=Code eq 'DIENSTEN'&$top=1`,
    { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } },
  );
  if (lookupRes.ok) {
    const lj = await lookupRes.json().catch(() => ({}));
    const arr = Array.isArray(lj?.d?.results) ? lj.d.results : Array.isArray(lj?.d) ? lj.d : [];
    if (arr[0]?.ID) {
      await supabase.from("exact_config").update({ exact_item_group_id: arr[0].ID }).eq("id", config.id);
      config.exact_item_group_id = arr[0].ID;
      return { ok: true, groupId: arr[0].ID, created: false, foundExisting: true };
    }
  }
  // 2) Aanmaken — minimale payload. Exact ItemGroup vereist alleen Code + Description.
  const groupPayload = { Code: "DIENSTEN", Description: "Verzekeringsdiensten" };
  const gRes = await fetch(`${baseUrl}/api/v1/${div}/logistics/ItemGroups`, {
    method: "POST", headers, body: JSON.stringify(groupPayload),
  });
  if (!gRes.ok) {
    const { summary, detail } = await captureExactError("ItemGroups POST", gRes);
    await supabase.from("exact_sync_log").insert({
      ...logCtx, trigger_type: "itemgroup_bootstrap", status: "error",
      http_status: gRes.status, error_message: summary,
      payload: { request: groupPayload, response: detail },
    });
    return { ok: false, summary, detail, httpStatus: gRes.status };
  }
  const gJson = await gRes.json().catch(() => ({}));
  const groupId: string = gJson?.d?.ID || gJson?.ID || "";
  await supabase.from("exact_config").update({ exact_item_group_id: groupId }).eq("id", config.id);
  config.exact_item_group_id = groupId;
  await supabase.from("exact_sync_log").insert({
    ...logCtx, trigger_type: "itemgroup_bootstrap", status: "success",
    http_status: gRes.status, payload: { request: groupPayload, exact_item_group_id: groupId },
  });
  return { ok: true, groupId, created: true, foundExisting: false };
}

// Zorgt dat het BAV-AVB artikel in Exact bestaat en geeft de Guid terug.
// Schrijft de Guid naar exact_config.exact_item_id_bav_avb zodra bekend.
// deno-lint-ignore no-explicit-any
async function ensureBavAvbItem(opts: {
  supabase: any; config: any; baseUrl: string; div: string;
  headers: Record<string, string>; accessToken: string;
  // deno-lint-ignore no-explicit-any
  logCtx: any;
}): Promise<{ ok: true; itemId: string; created: boolean; foundExisting: boolean } | { ok: false; summary: string; detail: Record<string, unknown>; httpStatus: number }> {
  const { supabase, config, baseUrl, div, headers, accessToken, logCtx } = opts;
  if (config.exact_item_id_bav_avb) {
    return { ok: true, itemId: config.exact_item_id_bav_avb, created: false, foundExisting: false };
  }
  // 0) Zorg eerst dat ItemGroup bestaat (vereist in administratie 4401707)
  const groupRes = await ensureItemGroup({ supabase, config, baseUrl, div, headers, accessToken, logCtx });
  if (!groupRes.ok) return groupRes;

  // 1) Lookup op Code
  const lookupRes = await fetch(
    `${baseUrl}/api/v1/${div}/logistics/Items?$select=ID,Code&$filter=Code eq 'BAV-AVB'&$top=1`,
    { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } },
  );
  if (lookupRes.ok) {
    const lj = await lookupRes.json().catch(() => ({}));
    const arr = Array.isArray(lj?.d?.results) ? lj.d.results : Array.isArray(lj?.d) ? lj.d : [];
    if (arr[0]?.ID) {
      await supabase.from("exact_config").update({ exact_item_id_bav_avb: arr[0].ID }).eq("id", config.id);
      config.exact_item_id_bav_avb = arr[0].ID;
      return { ok: true, itemId: arr[0].ID, created: false, foundExisting: true };
    }
  }
  // 2) Aanmaken — ItemGroup is verplicht in deze administratie.
  const itemPayload = {
    Code: "BAV-AVB",
    Description: "Beroeps- en bedrijfsaansprakelijkheidsverzekering",
    SalesVatCode: INV_VAT_CODE,
    IsSalesItem: true,
    IsStockItem: false,
    ItemGroup: groupRes.groupId,
  };
  const itemRes = await fetch(`${baseUrl}/api/v1/${div}/logistics/Items`, {
    method: "POST", headers, body: JSON.stringify(itemPayload),
  });
  if (!itemRes.ok) {
    const { summary, detail } = await captureExactError("Items POST", itemRes);
    await supabase.from("exact_sync_log").insert({
      ...logCtx, trigger_type: "item_bootstrap", status: "error",
      http_status: itemRes.status, error_message: summary,
      payload: { request: itemPayload, response: detail },
    });
    return { ok: false, summary, detail, httpStatus: itemRes.status };
  }
  const itemJson = await itemRes.json().catch(() => ({}));
  const itemId: string = itemJson?.d?.ID || itemJson?.ID || "";
  await supabase.from("exact_config").update({ exact_item_id_bav_avb: itemId }).eq("id", config.id);
  config.exact_item_id_bav_avb = itemId;
  await supabase.from("exact_sync_log").insert({
    ...logCtx, trigger_type: "item_bootstrap", status: "success",
    http_status: itemRes.status, payload: { request: itemPayload, exact_item_id: itemId },
  });
  return { ok: true, itemId, created: true, foundExisting: false };
}


// deno-lint-ignore no-explicit-any
async function createExactInvoice(opts: {
  baseUrl: string;
  div: string;
  headers: Record<string, string>;
  accountId: string;
  lead: any;
  pakketSpec: { naam: string; bedrag: number; betalingsregel: string };
  itemId: string | null;
  // Pro-rata override voor maandpolis-instap
  override?: {
    amount: number;
    headerDescription: string;
    lineDescription: string;
    periodStart: string; // YYYY-MM-DD
    periodEnd: string;   // YYYY-MM-DD
  };
}): Promise<
  | { ok: true; invoiceId: string; invoiceNumber: string | null; amount: number; raw: unknown }
  | { ok: false; httpStatus: number; summary: string; detail: Record<string, unknown>; request: unknown }
> {
  const { baseUrl, div, headers, accountId, lead, pakketSpec, itemId, override } = opts;
  const today = new Date();
  const invoiceDate = today.toISOString();

  // Dekkingsperiode op regelniveau:
  // - Jaarpolis: ingangsdatum → polis_einddatum
  // - Maandpolis-instap: override.periodStart → override.periodEnd
  const ingang = lead.ingangsdatum ? String(lead.ingangsdatum).slice(0, 10) : null;
  const eind = (lead.polis_einddatum ?? (ingang ? calcPolisEinddatum(ingang) : null));
  const periodStart = override?.periodStart ?? ingang;
  const periodEnd = override?.periodEnd ?? eind;

  const fmtNL = (iso: string) => {
    const d = new Date(iso);
    return `${String(d.getUTCDate()).padStart(2, "0")}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${d.getUTCFullYear()}`;
  };

  const lineDescription = override?.lineDescription
    ?? (periodStart && periodEnd
      ? `BAV-AVB premie - Dekking ${fmtNL(periodStart)} t/m ${fmtNL(periodEnd)}\n${pakketSpec.betalingsregel}`
      : `${pakketSpec.naam}\n${pakketSpec.betalingsregel}`);
  const headerDescription = override?.headerDescription
    ?? `${pakketSpec.naam} voor ${lead.bedrijfsnaam}${periodStart && periodEnd ? ` — dekking ${fmtNL(periodStart)} t/m ${fmtNL(periodEnd)}` : ""}`;
  const unitPrice = override?.amount ?? pakketSpec.bedrag;

  // deno-lint-ignore no-explicit-any
  const line: any = {
    GLAccount: INV_GL_ACCOUNT,
    VATCode: INV_VAT_CODE,
    Quantity: 1,
    UnitPrice: unitPrice,
    Description: lineDescription,
  };
  if (itemId) line.Item = itemId;
  if (periodStart) line.StartTime = `${periodStart}T00:00:00`;
  if (periodEnd) line.EndTime = `${periodEnd}T00:00:00`;

  const payload = {
    InvoiceTo: accountId,
    OrderedBy: accountId,
    Journal: INV_JOURNAL,
    PaymentCondition: INV_PAYMENT_COND,
    Type: 8020,
    Status: INV_STATUS_CONCEPT,
    InvoiceDate: invoiceDate,
    OrderDate: invoiceDate,
    YourRef: String(lead.id),
    Description: headerDescription,
    SalesInvoiceLines: [line],
  };

  const res = await fetch(`${baseUrl}/api/v1/${div}/salesinvoice/SalesInvoices`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const { summary, detail } = await captureExactError("SalesInvoices POST", res);
    return { ok: false, httpStatus: res.status, summary, detail, request: payload };
  }
  const j = await res.json().catch(() => ({}));
  // deno-lint-ignore no-explicit-any
  const d: any = (j as any)?.d ?? j;
  const invoiceId: string = d?.InvoiceID || d?.ID || "";
  const invoiceNumber: string | null =
    d?.InvoiceNumber != null ? String(d.InvoiceNumber) : null;
  return { ok: true, invoiceId, invoiceNumber, amount: unitPrice, raw: d };
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

  // ── Auth: team members (medewerker / supervisor / admin) ──
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return json({ success: false, error: "unauthorized" }, 401);
  }
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) return json({ success: false, error: "unauthorized" }, 401);
  const { data: roleRows } = await supabase
    .from("user_roles").select("role").eq("user_id", user.id);
  const roles = (roleRows ?? []).map((r: any) => r.role);
  const isTeamMember = roles.includes("admin") || roles.includes("supervisor") || roles.includes("medewerker");
  if (!isTeamMember) return json({ success: false, error: "forbidden" }, 403);

  // deno-lint-ignore no-explicit-any
  let body: any = {};
  try { body = await req.json(); } catch (_) {}
  const leadId = body?.lead_id;
  const action = body?.action || "activate";
  if (!leadId || typeof leadId !== "string") {
    return json({ success: false, error: "lead_id_required" }, 400);
  }

  // ── Pre-flight: lead ophalen ──
  const { data: lead, error: leadErr } = await supabase
    .from("leads").select("*").eq("id", leadId).maybeSingle();
  if (leadErr || !lead) return json({ success: false, error: "lead_not_found" }, 404);

  // ── Exact config (gedeeld door beide acties) ──
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

  // ── Actie: schema-introspectie ($metadata) ──
  if (action === "introspect_metadata") {
    const entity = body?.entity || "DirectDebitMandate";
    const section = body?.section || "cashflow";
    const url = `${baseUrl}/api/v1/${div}/${section}/$metadata`;
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/xml" },
    });
    const xml = await r.text();
    // Pak alleen <EntityType Name="<entity>"> ... </EntityType>
    const re = new RegExp(`<EntityType[^>]*Name="${entity}"[\\s\\S]*?</EntityType>`);
    const match = xml.match(re);
    return json({
      success: r.ok,
      http_status: r.status,
      entity,
      entity_xml: match ? match[0] : null,
      raw_length: xml.length,
    });
  }

  // ── Actie: BAV-AVB artikel aanmaken in Exact (eenmalig) ──
  if (action === "bootstrap_item") {
    // Idempotent: als kolom al gevuld is, gewoon teruggeven.
    if (config.exact_item_id_bav_avb && !body?.force) {
      return json({
        success: true,
        already_exists: true,
        exact_item_id_bav_avb: config.exact_item_id_bav_avb,
      });
    }

    // 1) Check of artikel met Code BAV-AVB al bestaat in Exact
    const lookupRes = await fetch(
      `${baseUrl}/api/v1/${div}/logistics/Items?$select=ID,Code,Description&$filter=Code eq 'BAV-AVB'&$top=1`,
      { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } },
    );
    if (lookupRes.ok) {
      const lj = await lookupRes.json().catch(() => ({}));
      const arr = Array.isArray(lj?.d?.results) ? lj.d.results : Array.isArray(lj?.d) ? lj.d : [];
      if (arr.length > 0 && arr[0]?.ID) {
        await supabase.from("exact_config")
          .update({ exact_item_id_bav_avb: arr[0].ID }).eq("id", config.id);
        return json({
          success: true, found_existing: true,
          exact_item_id_bav_avb: arr[0].ID, code: arr[0].Code,
        });
      }
    }

    // 2) Aanmaken — eerst ItemGroup garanderen (verplicht veld).
    const groupRes = await ensureItemGroup({
      supabase, config, baseUrl, div, headers, accessToken,
      logCtx: { admin_user_id: user.id, lead_id: null },
    });
    if (!groupRes.ok) {
      return json({ success: false, error: "itemgroup_create_failed", detail: groupRes.detail, http_status: groupRes.httpStatus }, 500);
    }
    const itemPayload = {
      Code: "BAV-AVB",
      Description: "Beroeps- en bedrijfsaansprakelijkheidsverzekering",
      SalesVatCode: INV_VAT_CODE,
      IsSalesItem: true,
      IsStockItem: false,
      ItemGroup: groupRes.groupId,
    };
    const itemRes = await fetch(`${baseUrl}/api/v1/${div}/logistics/Items`, {
      method: "POST", headers, body: JSON.stringify(itemPayload),
    });

    if (!itemRes.ok) {
      const { summary, detail } = await captureExactError("Items POST", itemRes);
      await logSync(supabase, {
        trigger_type: "item_bootstrap", status: "error",
        admin_user_id: user.id, http_status: itemRes.status,
        error_message: summary,
        payload: { request: itemPayload, response: detail },
      });
      return json({ success: false, error: "item_create_failed", detail, http_status: itemRes.status }, 500);
    }
    const itemJson = await itemRes.json().catch(() => ({}));
    const itemId: string = itemJson?.d?.ID || itemJson?.ID || "";
    if (!itemId) {
      return json({ success: false, error: "no_item_id_returned", raw: itemJson }, 500);
    }
    await supabase.from("exact_config")
      .update({ exact_item_id_bav_avb: itemId }).eq("id", config.id);
    await logSync(supabase, {
      trigger_type: "item_bootstrap", status: "success",
      admin_user_id: user.id, http_status: itemRes.status,
      payload: { request: itemPayload, exact_item_id: itemId },
    });
    return json({ success: true, created: true, exact_item_id_bav_avb: itemId });
  }


  // ── Actie: alleen SEPA-mandaat (re)try voor reeds-geactiveerde lead ──
  if (action === "retry_mandate") {

    if (!lead.exact_account_id) {
      return json({ success: false, error: "lead_heeft_geen_exact_account" }, 400);
    }
    // Zoek bankrekening in Exact bij dit account
    const baRes = await fetch(
      `${baseUrl}/api/v1/${div}/crm/BankAccounts?$select=ID,BankAccount&$filter=Account eq guid'${lead.exact_account_id}'&$top=1`,
      { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } },
    );
    const baJson = await baRes.json().catch(() => ({}));
    const baArr = Array.isArray(baJson?.d?.results) ? baJson.d.results : Array.isArray(baJson?.d) ? baJson.d : [];
    const bankId = baArr[0]?.ID;
    if (!bankId) {
      return json({ success: false, error: "geen_bankrekening_in_exact" }, 400);
    }
    const signatureDate = lead.sepa_akkoord_datum
      ? new Date(lead.sepa_akkoord_datum).toISOString()
      : new Date().toISOString();
    const mRes = await fetch(`${baseUrl}/api/v1/${div}/cashflow/DirectDebitMandates`, {
      method: "POST", headers,
      body: JSON.stringify({
        Account: lead.exact_account_id,
        BankAccount: bankId,
        Reference: `MNDT-${leadId.slice(0, 8)}`,
        SignatureDate: signatureDate,
        Type: 1, // 0=Core, 1=B2B, 2=Bottomline
      }),
    });
    if (!mRes.ok) {
      const { summary, detail } = await captureExactError("DirectDebitMandates POST (retry)", mRes);
      await logSync(supabase, {
        trigger_type: "lead_activation", status: "error",
        lead_id: leadId, admin_user_id: user.id,
        http_status: mRes.status,
        error_message: summary,
        payload: detail,
      });
      return json({ success: false, error: "mandate_create_failed", detail, http_status: mRes.status }, 500);
    }
    const mJson = await mRes.json().catch(() => ({}));

    const mandateId = mJson?.d?.ID || mJson?.ID || null;
    const entry = {
      timestamp: new Date().toISOString(),
      action: "SEPA-mandaat aangemaakt (retry)",
      admin_user_id: user.id,
      admin_email: user.email,
      exact_account_id: lead.exact_account_id,
      exact_bankaccount_id: bankId,
      exact_mandate_id: mandateId,
    };
    const newLog = Array.isArray(lead.activatie_log) ? [...lead.activatie_log, entry] : [entry];
    await supabase.from("leads").update({ activatie_log: newLog }).eq("id", leadId);
    await logSync(supabase, {
      trigger_type: "lead_activation", status: "success",
      lead_id: leadId, admin_user_id: user.id,
      exact_account_id: lead.exact_account_id, http_status: 201,
      payload: { retry: "mandate", exact_mandate_id: mandateId, exact_bankaccount_id: bankId },
    });
    return json({ success: true, exact_mandate_id: mandateId, exact_bankaccount_id: bankId, message: "SEPA-mandaat aangemaakt" });
  }

  // ── Actie: retry factuur voor reeds-geactiveerde lead ──
  if (action === "retry_invoice") {
    if (!lead.exact_account_id) {
      return json({ success: false, error: "lead_heeft_geen_exact_account" }, 400);
    }
    if (lead.exact_invoice_id) {
      return json({
        success: false,
        error: "factuur_bestaat_al",
        exact_invoice_id: lead.exact_invoice_id,
        exact_invoice_number: lead.exact_invoice_number,
      }, 409);
    }
    const spec = resolvePakketInvoice(lead.gekozen_pakket);
    if (!spec) {
      return json({ success: false, error: "onbekend_pakket", gekozen_pakket: lead.gekozen_pakket }, 400);
    }
    // Zorg dat het BAV-AVB artikel in Exact bestaat (eenmalig, idempotent)
    const itemEnsure = await ensureBavAvbItem({
      supabase, config, baseUrl, div, headers, accessToken,
      logCtx: { lead_id: leadId, admin_user_id: user.id },
    });
    if (!itemEnsure.ok) {
      return json({ success: false, error: "item_bootstrap_failed", detail: itemEnsure.detail, http_status: itemEnsure.httpStatus }, 500);
    }
    // Maandpolis-instap pro-rata override (zelfde regel als initiele activatie)
    let retryOverride: Parameters<typeof createExactInvoice>[0]["override"] = undefined;
    if (isMaandPolis(lead.gekozen_pakket) && lead.ingangsdatum) {
      const startStr = String(lead.ingangsdatum).slice(0, 10);
      const endStr = lastOfMonth(startStr);
      const calc = calcMaandProrata({
        maandprijs: getMaandprijs(lead.gekozen_pakket),
        vanaf_datum: startStr, tot_datum: endStr,
      });
      const fmt = (iso: string) => { const d = new Date(iso); return `${String(d.getUTCDate()).padStart(2, "0")}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${d.getUTCFullYear()}`; };
      retryOverride = {
        amount: calc.bedrag,
        headerDescription: `BAV-AVB premie pro-rata instap ${fmt(startStr)} t/m ${fmt(endStr)}`,
        lineDescription: `BAV-AVB premie pro-rata - Periode ${fmt(startStr)} t/m ${fmt(endStr)} (${calc.dagen} dagen × € ${calc.dagprijs.toFixed(4)})`,
        periodStart: startStr, periodEnd: endStr,
      };
    }
    const invRes = await createExactInvoice({
      baseUrl, div, headers, accountId: lead.exact_account_id, lead, pakketSpec: spec,
      itemId: itemEnsure.itemId, override: retryOverride,
    });


    if (!invRes.ok) {
      await logSync(supabase, {
        trigger_type: "invoice_retry", status: "error",
        lead_id: leadId, admin_user_id: user.id,
        http_status: invRes.httpStatus,
        error_message: invRes.summary,
        payload: { request: invRes.request, response: invRes.detail },
      });
      return json({ success: false, error: "invoice_create_failed", detail: invRes.detail, http_status: invRes.httpStatus }, 500);
    }
    const nowIso = new Date().toISOString();
    const entry = {
      timestamp: nowIso,
      action: `Factuur ${invRes.invoiceNumber ?? "(concept)"} aangemaakt (€${spec.bedrag.toFixed(2).replace(".", ",")})`,
      admin_user_id: user.id,
      admin_email: user.email,
      exact_invoice_id: invRes.invoiceId,
      exact_invoice_number: invRes.invoiceNumber,
      exact_invoice_amount: spec.bedrag,
    };
    const newLog = Array.isArray(lead.activatie_log) ? [...lead.activatie_log, entry] : [entry];
    await supabase.from("leads").update({
      exact_invoice_id: invRes.invoiceId,
      exact_invoice_number: invRes.invoiceNumber,
      exact_invoice_amount: spec.bedrag,
      exact_invoice_created_at: nowIso,
      activatie_log: newLog,
    }).eq("id", leadId);
    await logSync(supabase, {
      trigger_type: "invoice_retry", status: "success",
      lead_id: leadId, admin_user_id: user.id,
      exact_account_id: lead.exact_account_id,
      http_status: 201,
      payload: {
        exact_invoice_id: invRes.invoiceId,
        exact_invoice_number: invRes.invoiceNumber,
        amount: spec.bedrag,
      },
    });
    return json({
      success: true,
      exact_invoice_id: invRes.invoiceId,
      exact_invoice_number: invRes.invoiceNumber,
      amount: spec.bedrag,
      message: "Factuur aangemaakt in Exact",
    });
  }

  // ── Actie: volledige activatie (default) ──
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

  // (Exact config + token reeds geladen bovenaan)



  // ── Duplicate check op KvK in Exact — reuse bij match ──
  const kvk = String(lead.kvk_nummer);
  let reusedAccountId: string | null = null;
  let reusedAccountName: string | null = null;
  try {
    const dupRes = await fetch(
      `${baseUrl}/api/v1/${div}/crm/Accounts?$select=ID,Name,ChamberOfCommerce&$filter=ChamberOfCommerce eq '${kvk}'&$top=1`,
      { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } },
    );
    const dupJson = await dupRes.json().catch(() => ({}));
    const dupArr = Array.isArray(dupJson?.d?.results) ? dupJson.d.results : Array.isArray(dupJson?.d) ? dupJson.d : [];
    if (dupArr.length > 0 && dupArr[0]?.ID) {
      reusedAccountId = dupArr[0].ID;
      reusedAccountName = dupArr[0]?.Name ?? null;
      await logSync(supabase, {
        trigger_type: "lead_activation", status: "success",
        lead_id: leadId, admin_user_id: user.id,
        exact_account_id: reusedAccountId, http_status: 200,
        payload: {
          reuse: "existing_account_by_kvk",
          kvk, exact_account_id: reusedAccountId, exact_account_name: reusedAccountName,
        },
      });
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

  // ── Stap D: Account aanmaken (skip bij reuse van bestaande relatie) ──
  let exactAccountId: string = reusedAccountId ?? "";
  if (!reusedAccountId) {
    const accRes = await fetch(`${baseUrl}/api/v1/${div}/crm/Accounts`, {
      method: "POST", headers, body: JSON.stringify(accountPayload),
    });
    if (!accRes.ok) {
      const { summary, detail } = await captureExactError("Accounts POST", accRes);
      await logSync(supabase, {
        trigger_type: "lead_activation", status: "error",
        lead_id: leadId, admin_user_id: user.id,
        http_status: accRes.status,
        error_message: summary,
        payload: { request: accountPayload, response: detail },
      });
      return json({ success: false, error: "exact_account_create_failed", detail, http_status: accRes.status }, 500);
    }
    const accData = await accRes.json().catch(() => ({}));
    exactAccountId = accData?.d?.ID || accData?.ID;
    if (!exactAccountId) {
      return json({ success: false, error: "no_account_id_returned", raw: accData }, 500);
    }
  }


  // ── Helper voor rollback (alleen bij nieuw aangemaakte account) ──
  const deleteAccount = async () => {
    if (reusedAccountId) return; // nooit een hergebruikte relatie verwijderen
    try {
      await fetch(`${baseUrl}/api/v1/${div}/crm/Accounts(guid'${exactAccountId}')`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
      });
    } catch (e) { console.error("Rollback delete account failed:", e); }
  };

  // ── Stap E: Contact (skip bij reuse) ──
  let exactContactId: string | null = null;
  if (!reusedAccountId) {
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
    if (!cRes.ok) {
      const { summary, detail } = await captureExactError("Contacts POST", cRes);
      await deleteAccount();
      await logSync(supabase, {
        trigger_type: "lead_activation", status: "error",
        lead_id: leadId, admin_user_id: user.id,
        http_status: cRes.status,
        error_message: `Contact creatie mislukt (rollback uitgevoerd): ${summary}`,
        payload: detail,
      });
      return json({ success: false, error: "contact_create_failed", detail }, 500);
    }
    const cJson = await cRes.json().catch(() => ({}));
    exactContactId = cJson?.d?.ID || cJson?.ID || null;
  }

  // ── Stap F: BankAccount (idempotent bij reuse) ──
  let exactBankAccountId: string | null = null;
  let bankAccountReused = false;
  {
    const ibanClean = String(lead.iban).replace(/\s+/g, "").toUpperCase();
    if (reusedAccountId) {
      // Zoek bestaande bankrekening op relatie met zelfde IBAN.
      try {
        const listRes = await fetch(
          `${baseUrl}/api/v1/${div}/crm/BankAccounts?$select=ID,BankAccount&$filter=Account eq guid'${exactAccountId}'`,
          { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } },
        );
        if (listRes.ok) {
          const lj = await listRes.json().catch(() => ({}));
          const arr = Array.isArray(lj?.d?.results) ? lj.d.results : Array.isArray(lj?.d) ? lj.d : [];
          const match = arr.find((x: any) =>
            String(x?.BankAccount ?? "").replace(/\s+/g, "").toUpperCase() === ibanClean);
          if (match?.ID) {
            exactBankAccountId = match.ID;
            bankAccountReused = true;
            await logSync(supabase, {
              trigger_type: "lead_activation", status: "success",
              lead_id: leadId, admin_user_id: user.id,
              exact_account_id: exactAccountId, http_status: 200,
              payload: { reuse: "existing_bankaccount", exact_bankaccount_id: exactBankAccountId, iban: ibanClean },
            });
          }
        }
      } catch (e) {
        console.warn("BankAccount lookup failed (continuing):", e);
      }
    }
    if (!exactBankAccountId) {
      const bRes = await fetch(`${baseUrl}/api/v1/${div}/crm/BankAccounts`, {
        method: "POST", headers,
        body: JSON.stringify({
          Account: exactAccountId,
          BankAccount: ibanClean,
          BankAccountHolderName: lead.bedrijfsnaam,
          Type: 10,
        }),
      });
      if (!bRes.ok) {
        const { summary, detail } = await captureExactError("BankAccounts POST", bRes);
        await deleteAccount();
        await logSync(supabase, {
          trigger_type: "lead_activation", status: "error",
          lead_id: leadId, admin_user_id: user.id,
          http_status: bRes.status,
          error_message: `BankAccount creatie mislukt (rollback): ${summary}`,
          payload: detail,
        });
        return json({ success: false, error: "bankaccount_create_failed", detail }, 500);
      }
      const bJson = await bRes.json().catch(() => ({}));
      exactBankAccountId = bJson?.d?.ID || bJson?.ID || null;
    }
  }

  // ── Stap G: SEPA-mandaat (DirectDebitMandate) — niet-fataal ──
  // Schema (Exact $metadata DirectDebitMandate):
  //   - Account (Guid, required)
  //   - BankAccount (Guid, required)
  //   - Reference (string)              ← officiële veldnaam (NIET 'MandateReference')
  //   - SignatureDate (DateTime)        ← NIET 'MandateDate'
  //   - Type (Int16): 0=Core, 1=B2B, 2=Bottomline (UK)

  let exactMandateId: string | null = null;
  let mandateWarning: string | null = null;
  let mandateReused = false;
  try {
    // Bij hergebruikte bankrekening: kijk of er al een geldig mandaat is.
    if (bankAccountReused && exactBankAccountId) {
      try {
        const listRes = await fetch(
          `${baseUrl}/api/v1/${div}/cashflow/DirectDebitMandates?$select=ID,IsActive,BankAccount&$filter=BankAccount eq guid'${exactBankAccountId}'&$top=5`,
          { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } },
        );
        if (listRes.ok) {
          const lj = await listRes.json().catch(() => ({}));
          const arr = Array.isArray(lj?.d?.results) ? lj.d.results : Array.isArray(lj?.d) ? lj.d : [];
          const active = arr.find((x: any) => x?.IsActive === true) ?? arr[0];
          if (active?.ID) {
            exactMandateId = active.ID;
            mandateReused = true;
            await logSync(supabase, {
              trigger_type: "lead_activation", status: "success",
              lead_id: leadId, admin_user_id: user.id,
              exact_account_id: exactAccountId, http_status: 200,
              payload: { reuse: "existing_mandate", exact_mandate_id: exactMandateId, exact_bankaccount_id: exactBankAccountId },
            });
          }
        }
      } catch (e) {
        console.warn("Mandate lookup failed (continuing):", e);
      }
    }
    if (!exactMandateId) {
      const signatureDate = lead.sepa_akkoord_datum
        ? new Date(lead.sepa_akkoord_datum).toISOString()
        : new Date().toISOString();
      const mRes = await fetch(`${baseUrl}/api/v1/${div}/cashflow/DirectDebitMandates`, {
        method: "POST", headers,
        body: JSON.stringify({
          Account: exactAccountId,
          BankAccount: exactBankAccountId,
          Reference: `MNDT-${leadId.slice(0, 8)}`,
          SignatureDate: signatureDate,
          Type: 1, // 1 = B2B
        }),
      });
      if (!mRes.ok) {
        const { summary, detail } = await captureExactError("DirectDebitMandates POST", mRes);
        mandateWarning = `${summary}. Account + bankrekening staan wel klaar.`;
        await logSync(supabase, {
          trigger_type: "lead_activation", status: "error",
          lead_id: leadId, admin_user_id: user.id,
          http_status: mRes.status,
          error_message: summary,
          payload: detail,
        });
        console.warn(mandateWarning);
      } else {
        const mJson = await mRes.json().catch(() => ({}));
        exactMandateId = mJson?.d?.ID || mJson?.ID || null;
      }
    }
  } catch (e) {
    mandateWarning = `SEPA-mandaat exception: ${e instanceof Error ? e.message : e}`;
  }

  // ── Stap H: SalesInvoice (concept) — niet-fataal voor activatie ──
  // Bij failure: GEEN rollback van account. Lead blijft 'actief', UI toont
  // amber retry-banner. Admin kan retry via action="retry_invoice".
  let exactInvoiceId: string | null = null;
  let exactInvoiceNumber: string | null = null;
  let exactInvoiceAmount: number | null = null;
  let exactInvoiceCreatedAt: string | null = null;
  let invoiceWarning: string | null = null;
  const pakketSpec = resolvePakketInvoice(lead.gekozen_pakket);
  if (!pakketSpec) {
    invoiceWarning = `Onbekend pakket "${lead.gekozen_pakket}" — geen factuur aangemaakt.`;
  } else {
    const itemEnsure = await ensureBavAvbItem({
      supabase, config, baseUrl, div, headers, accessToken,
      logCtx: { lead_id: leadId, admin_user_id: user.id },
    });

    // Maandpolis-instap: pro-rata factuur voor periode vandaag → laatste van die maand.
    // De volle maandfacturen vanaf 1ste volgende maand komen via monthly-invoices-cron.
    let override: Parameters<typeof createExactInvoice>[0]["override"] = undefined;
    if (isMaandPolis(lead.gekozen_pakket)) {
      const startStr = String(lead.ingangsdatum).slice(0, 10);
      const endStr = lastOfMonth(startStr);
      const calc = calcMaandProrata({
        maandprijs: getMaandprijs(lead.gekozen_pakket),
        vanaf_datum: startStr, tot_datum: endStr,
      });
      const fmt = (iso: string) => {
        const d = new Date(iso);
        return `${String(d.getUTCDate()).padStart(2, "0")}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${d.getUTCFullYear()}`;
      };
      override = {
        amount: calc.bedrag,
        headerDescription: `BAV-AVB premie pro-rata instap ${fmt(startStr)} t/m ${fmt(endStr)}`,
        lineDescription: `BAV-AVB premie pro-rata - Periode ${fmt(startStr)} t/m ${fmt(endStr)} (${calc.dagen} dagen × € ${calc.dagprijs.toFixed(4)})`,
        periodStart: startStr, periodEnd: endStr,
      };
    }

    const invRes = itemEnsure.ok
      ? await createExactInvoice({
          baseUrl, div, headers, accountId: exactAccountId, lead, pakketSpec,
          itemId: itemEnsure.itemId, override,
        })
      : { ok: false as const, httpStatus: itemEnsure.httpStatus, summary: `Item bootstrap mislukt: ${itemEnsure.summary}`, detail: itemEnsure.detail, request: null };


    if (!invRes.ok) {
      invoiceWarning = `${invRes.summary}. Account staat klaar — retry via knop.`;
      await logSync(supabase, {
        trigger_type: "invoice_create", status: "error",
        lead_id: leadId, admin_user_id: user.id,
        exact_account_id: exactAccountId,
        http_status: invRes.httpStatus,
        error_message: invRes.summary,
        payload: { request: invRes.request, response: invRes.detail },
      });
    } else {
      exactInvoiceId = invRes.invoiceId;
      exactInvoiceNumber = invRes.invoiceNumber;
      exactInvoiceAmount = invRes.amount;
      exactInvoiceCreatedAt = new Date().toISOString();
      await logSync(supabase, {
        trigger_type: "invoice_create", status: "success",
        lead_id: leadId, admin_user_id: user.id,
        exact_account_id: exactAccountId,
        http_status: 201,
        payload: {
          exact_invoice_id: exactInvoiceId,
          exact_invoice_number: exactInvoiceNumber,
          amount: exactInvoiceAmount,
          override,
        },
      });

      // Bij maandpolis: log instap-maand in monthly_invoices_log zodat cron deze overslaat.
      if (isMaandPolis(lead.gekozen_pakket) && override) {
        const jaar = parseInt(override.periodStart.slice(0, 4), 10);
        const maand = parseInt(override.periodStart.slice(5, 7), 10);
        await supabase.from("monthly_invoices_log").upsert({
          lead_id: leadId, factuur_jaar: jaar, factuur_maand: maand,
          periode_start: override.periodStart, periode_eind: override.periodEnd,
          polis_einddatum: lead.polis_einddatum ?? null,
          bedrag: override.amount, status: "success",
          exact_invoice_id: exactInvoiceId, exact_invoice_number: exactInvoiceNumber,
          payload: { source: "lead_activation_instap" },
        }, { onConflict: "lead_id,factuur_jaar,factuur_maand" });
      }
    }
  }

  // ── Stap I: lead updaten ──
  const auditEntry = {
    timestamp: new Date().toISOString(),
    action: reusedAccountId
      ? "Polis geactiveerd in Exact (bestaande relatie hergebruikt)"
      : "Polis geactiveerd in Exact",
    admin_user_id: user.id,
    admin_email: user.email,
    exact_account_id: exactAccountId,
    exact_contact_id: exactContactId,
    exact_bankaccount_id: exactBankAccountId,
    exact_mandate_id: exactMandateId,
    mandate_warning: mandateWarning,
    reused_account: !!reusedAccountId,
    reused_account_name: reusedAccountName,
    reused_bankaccount: bankAccountReused,
    reused_mandate: mandateReused,
  };
  const log1 = Array.isArray(lead.activatie_log)
    ? [...lead.activatie_log, auditEntry]
    : [auditEntry];
  const log2 = exactInvoiceId && pakketSpec
    ? [...log1, {
        timestamp: exactInvoiceCreatedAt,
        action: `Factuur ${exactInvoiceNumber ?? "(concept)"} aangemaakt (€${pakketSpec.bedrag.toFixed(2).replace(".", ",")})`,
        admin_user_id: user.id,
        admin_email: user.email,
        exact_invoice_id: exactInvoiceId,
        exact_invoice_number: exactInvoiceNumber,
        exact_invoice_amount: exactInvoiceAmount,
      }]
    : log1;
  const newLog = invoiceWarning
    ? [...log2, {
        timestamp: new Date().toISOString(),
        action: "Factuur-aanmaak gefaald",
        admin_user_id: user.id,
        admin_email: user.email,
        invoice_warning: invoiceWarning,
      }]
    : log2;

  // Status pas op 'actief' als de factuur daadwerkelijk is aangemaakt.
  const activationSucceeded = !!exactInvoiceId;
  const leadUpdate: Record<string, unknown> = {
    exact_account_id: exactAccountId,
    exact_relatie_id: exactAccountId,
    activatie_log: newLog,
    exact_status: activationSucceeded ? "gesynchroniseerd" : "deels_gesynchroniseerd",
    exact_sync_op: new Date().toISOString(),
    exact_fout: activationSucceeded ? null : (invoiceWarning ?? mandateWarning ?? null),
    exact_invoice_id: exactInvoiceId,
    exact_invoice_number: exactInvoiceNumber,
    exact_invoice_amount: exactInvoiceAmount,
    exact_invoice_created_at: exactInvoiceCreatedAt,
  };
  if (activationSucceeded) {
    leadUpdate.status = "actief";
    leadUpdate.geactiveerd_door = user.id;
    leadUpdate.geactiveerd_op = new Date().toISOString();
  }
  await supabase.from("leads").update(leadUpdate).eq("id", leadId);

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
      exact_invoice_id: exactInvoiceId,
      exact_invoice_number: exactInvoiceNumber,
      exact_invoice_amount: exactInvoiceAmount,
      invoice_warning: invoiceWarning,
    },
  });

  return json({
    success: true,
    exact_account_id: exactAccountId,
    exact_contact_id: exactContactId,
    exact_bankaccount_id: exactBankAccountId,
    exact_mandate_id: exactMandateId,
    mandate_warning: mandateWarning,
    exact_invoice_id: exactInvoiceId,
    exact_invoice_number: exactInvoiceNumber,
    exact_invoice_amount: exactInvoiceAmount,
    invoice_warning: invoiceWarning,
    message: "Klant succesvol geactiveerd in Exact",
  });
});

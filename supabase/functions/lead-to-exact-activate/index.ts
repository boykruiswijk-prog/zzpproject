// Lead-to-Exact Fase 1: maakt Account + Contact + BankAccount + SEPA-mandaat
// aan in Exact divisie 4401707 (ZP Zaken B.V.) op basis van een lead.
// Doet GEEN factuur — fase 2.
import { nieuweCyber, cyberPremie, cyberJaarEind } from "../_shared/cyber.ts";
import { controleerHandmatigeAcceptatie } from "../_shared/sectorRegels.ts";
import { getBavGlAccountId } from "../_shared/exactGl.ts";
import { ensureValidToken } from "../_shared/exactToken.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  isMaandPolis, getMaandprijs, lastOfMonth, calcMaandProrata, calcPolisEinddatum,
} from "../_shared/polisProRata.ts";
import { mandaatkenmerkVoor } from "../_shared/sepaMachtiging.ts";
import { autoInvitePortalLead } from "../_shared/portalAccess.ts";
import { factuurReferentie, kopOmschrijving, regelNotities, regelOmschrijving } from "../_shared/factuurTekst.ts";
import { landcodeVoor } from "../_shared/landcode.ts";
import { maandprijsVoorLead, pakketSpecVoorLead, starterContractVelden, starterStatus } from "../_shared/starterActivatie.ts";
import { zetInPlanner, factuurLogTekst, type ContractSpec } from "../_shared/klantContractActivatie.ts";

// SEPA-mandaat in Exact. Waarden geverifieerd in de Exact Online REST-documentatie:
// https://start.exactonline.nl/docs/HlpRestAPIResourcesDetails.aspx?name=CashflowDirectDebitMandates
//   Type: 0 = Core, 1 = B2B, 2 = bottomline (UK only)
//   PaymentType: 0 = One-off payment, 1 = Recurrent payment, 2 = AdHoc (UK only)
const EXACT_MANDAAT_TYPE_CORE = 0;
const EXACT_MANDAAT_PAYMENT_DOORLOPEND = 1;

/** Kenmerk ("ZPZ" + lead-UUID) en ondertekeningsdatum uit het bewijsrecord. */
// deno-lint-ignore no-explicit-any
async function mandaatGegevens(supabase: any, leadId: string, fallbackDatum: string | null) {
  const { data: bewijs } = await supabase.from("sepa_machtiging_bewijs")
    .select("mandaatkenmerk, akkoord_op")
    .eq("bron_id", leadId).eq("dienst", "bav")
    .order("created_at", { ascending: true }).limit(1).maybeSingle();
  const datum = bewijs?.akkoord_op ?? fallbackDatum ?? new Date().toISOString();
  return {
    reference: bewijs?.mandaatkenmerk ?? mandaatkenmerkVoor(leadId),
    signatureDate: new Date(datum).toISOString(),
  };
}

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

// deno-lint-ignore no-explicit-any
// Eerste periode → contractregel voor de factuurplanner (vervangt de oude maandcron-log).
function plannerSpec(lead: any, bedragJaar: number, override?: { periodStart: string; periodEnd: string }): ContractSpec | null {
  if (isMaandPolis(lead.gekozen_pakket)) {
    if (!override) return null;
    return { cyclus: "maand", itemcode: "100M", bedrag_per_periode: maandprijsVoorLead(lead, getMaandprijs(lead.gekozen_pakket)), periodeStart: override.periodStart, periodeEind: override.periodEnd, ...starterContractVelden(lead) };
  }
  const ingang = lead.ingangsdatum ? String(lead.ingangsdatum).slice(0, 10) : null;
  if (!ingang) return null;
  const eind = String(lead.polis_einddatum ?? calcPolisEinddatum(ingang)).slice(0, 10);
  return { cyclus: "jaar", itemcode: "100J", bedrag_per_periode: bedragJaar, periodeStart: ingang, periodeEind: eind, ...starterContractVelden(lead) };
}

// ── Fase 2: factuur-aanmaak helpers ────────────────────────────────────────
// Master data uit schema-introspectie ($metadata + lookups) — vaste codes.
const INV_JOURNAL = "70";              // Verkoopboek (Edm.String)
const INV_PAYMENT_COND = "IN";         // Incasso, 7 dagen, Method=I (Edm.String)
const INV_VAT_CODE = "0";              // BTW 0% (Edm.String)
// Grootboekrekening BAV-AVB: via _shared/exactGl.ts (exact_config.gl_code_bav, standaard 8003).
let INV_GL_ACCOUNT = "";
const INV_STATUS_CONCEPT = 20;         // 20 = Concept, 50 = Open

const PAKKET_INVOICE: Record<string, { naam: string; bedrag: number; betalingsregel: string }> = {
  "maandelijks": {
    naam: "BAV & AVB Maandelijks",
    bedrag: 660,
    betalingsregel: "Betaling: maandelijks € 55 via SEPA-incasso, dagelijks opzegbaar",
  },
  "jaarlijks": {
    naam: "BAV & AVB Jaarlijks",
    bedrag: 600,
    betalingsregel: "Betaling: jaarlijks vooraf via SEPA-incasso",
  },
  "maandelijks-cyber": { naam: "BAV & AVB Maandelijks + Cyber", bedrag: 660, betalingsregel: "BAV + AVB maandelijks €55; cyber jaarcontract in 12 termijnen van €27,50" },
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
    lineNotes?: string;
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
    ?? (periodStart && periodEnd ? regelOmschrijving("premie", periodStart, periodEnd) : kopOmschrijving(pakketSpec.naam));
  const lineNotes = override?.lineNotes ?? pakketSpec.betalingsregel;
  const headerDescription = kopOmschrijving(override?.headerDescription ?? `BAV-AVB premie ${lead.bedrijfsnaam ?? ""}`);
  const unitPrice = override?.amount ?? pakketSpec.bedrag;
  const cyberBedrag = nieuweCyber(lead) ? cyberPremie(String(lead.gekozen_pakket)) : 0;

  // deno-lint-ignore no-explicit-any
  const line: any = {
    GLAccount: INV_GL_ACCOUNT,
    VATCode: INV_VAT_CODE,
    Quantity: 1,
    UnitPrice: unitPrice,
    Description: lineDescription,
    Notes: lineNotes,
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
    YourRef: factuurReferentie(lead.certificate_number, lead.exact_relatie_code),
    Description: headerDescription,
    SalesInvoiceLines: [line, ...(cyberBedrag && ingang ? [{ ...line, UnitPrice: cyberBedrag,
      Description: `${regelOmschrijving("premie", ingang, isMaandPolis(lead.gekozen_pakket) ? lastOfMonth(ingang) : cyberJaarEind(ingang))} Cyber`.slice(0,60),
      Notes: "Cyber jaarcontract, 12 maanden. Resterende termijnen blijven verschuldigd bij BAV-opzegging.",
      StartTime: `${ingang}T00:00:00`, EndTime: `${isMaandPolis(lead.gekozen_pakket) ? lastOfMonth(ingang) : cyberJaarEind(ingang)}T00:00:00`,
    }] : [])],
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
  return { ok: true, invoiceId, invoiceNumber, amount: unitPrice + cyberBedrag, raw: d };
}



// Machtigingsomschrijving = naam van de relatie in Exact (bestaand account: Exact-naam; nieuw: bedrijfsnaam,
// anders voor- + achternaam). Description heeft geen gedocumenteerde maximale lengte; afgekapt op 60.
// deno-lint-ignore no-explicit-any
function mandaatOmschrijving(exactNaam: string | null, lead: any): string {
  const naam = (exactNaam ?? "").trim() || String(lead?.bedrijfsnaam ?? "").trim()
    || `${lead?.voornaam ?? ""} ${lead?.achternaam ?? ""}`.trim();
  return naam.slice(0, 60);
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

  // ── Auth: alle teamleden, inclusief verzekering ──
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return json({ success: false, error: "unauthorized" }, 401);
  }
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) return json({ success: false, error: "unauthorized" }, 401);
  const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  const allowedRoles = new Set(["admin", "supervisor", "verzekering", "medewerker"]);
  if (!(roleRows ?? []).some((row: { role: string }) => allowedRoles.has(row.role))) {
    return json({ success: false, error: "forbidden" }, 403);
  }

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

  // Open omzettingsvoorstel: eerst beslissen (anders krijgt de klant een nieuw certificaatnummer).
  if (action === "activate") {
    const { data: oz, error: ozErr } = await userClient.rpc("omzetting_kandidaten", { _lead_id: leadId });
    // deno-lint-ignore no-explicit-any
    if (!ozErr && ((oz as any)?.kandidaten ?? []).some((k: any) => !k.beslissing)) {
      return json({ success: false, error: "Beslis eerst over de omzetting", code: "omzetting_open" }, 409);
    }
  }

  // Testleads krijgen nooit Exact-acties (alleen metadata-inspectie blijft mogelijk).
  if (lead.is_test && action !== "introspect_metadata") {
    return json({ success: false, error: "testlead_geen_exact", reason: "Testlead: geen Exact-acties" }, 409);
  }

  // ── Ontbrekende aanmelding (bv. door een fout na opslaan): alleen toevoegen vanuit de lead, nooit overschrijven ──
  if (action === "activate" && lead.type === "verzekering_aanvraag" && ["maandelijks", "jaarlijks"].includes(String(lead.gekozen_pakket)) && lead.ingangsdatum) {
    const { count } = await supabase.from("bav_aanmeldingen").select("id", { count: "exact", head: true }).eq("lead_id", leadId);
    if ((count ?? 0) === 0) {
      const maand = lead.gekozen_pakket === "maandelijks";
      const starter = lead.tarief_type === "starter";
      const jaar = starter ? (maand ? 540 : 495) : (maand ? 660 : 600);
      // deno-lint-ignore no-explicit-any
      const form: any[] = Array.isArray(lead.extra_data?.formulier) ? lead.extra_data.formulier : [];
      const { error: herstelErr } = await supabase.from("bav_aanmeldingen").insert({
        lead_id: leadId, voornaam: lead.voornaam ?? "", achternaam: lead.achternaam ?? "", email: String(lead.email ?? "").trim().toLowerCase(),
        telefoon: lead.telefoon ?? null, bedrijfsnaam: lead.bedrijfsnaam ?? "", kvk_nummer: lead.kvk_nummer ?? null, beroep: lead.beroep ?? null,
        sector: lead.extra_data?.sector ?? null, pakket: lead.gekozen_pakket, pakket_naam: maand ? "BAV & AVB Maandelijks" : "BAV & AVB Jaarlijks",
        betaalwijze: lead.gekozen_pakket, ingangsdatum: lead.ingangsdatum, maandpremie: maand ? jaar / 12 : Math.round((jaar / 12) * 100) / 100,
        jaarpremie: jaar, premiebedrag: maand ? jaar / 12 : jaar, iban: lead.iban ?? null,
        rekeninghouder: form.find((f) => f?.label === "Rekeninghouder")?.waarde ?? null, is_test: !!lead.is_test,
        kvk_startdatum: lead.kvk_startdatum ?? null, tarief_type: lead.tarief_type ?? "standaard", starter_tot: lead.starter_tot ?? null,
      });
      if (herstelErr) {
        console.error("aanmelding herstel mislukt", herstelErr.message);
        return json({ success: false, error: `Aanmeldgegevens ontbreken en konden niet automatisch worden hersteld (${herstelErr.message}). Meld dit aan Boy.`, reason: "aanmelding_ontbreekt" }, 409);
      }
      try {
        await supabase.from("activiteiten_log").insert({ actie_type: "aanmelding_hersteld", omschrijving: "Ontbrekende aanmeldgegevens automatisch hersteld vanuit de lead bij activatie", uitgevoerd_door: user.id, uitgevoerd_door_naam: user.email ?? null, lead_id: leadId, is_test: !!lead.is_test });
      } catch (_e) { /* logfout blokkeert niet */ }
    }
  }

  // ── Startertarief: eerst met de hand controleren (beoordeel_startertarief), dan pas Exact ──
  if ((action === "activate" || action === "retry_invoice") && starterStatus(lead) === "wacht") {
    return json({ success: false, error: "Eerst het startertarief beoordelen: kies op de leadpagina Startertarief goedkeuren of Afwijzen, normaal tarief. Daarna kun je activeren.", reason: "startertarief_niet_gecontroleerd" }, 409);
  }

  // ── Handmatige acceptatie (zorg/bouw): alleen activeren na bewuste bevestiging ──
  if (action === "activate" && !lead.exact_account_id) {
    const check = controleerHandmatigeAcceptatie(lead.extra_data, body);
    if (!check.ok) return json({ success: false, error: check.error, reason: "handmatige_acceptatie_niet_bevestigd" }, check.status);
    if (check.gemarkeerd) {
      const extra = (lead.extra_data ?? {}) as Record<string, unknown>;
      const ha = (extra.handmatige_acceptatie ?? {}) as Record<string, unknown>;
      const nieuw = { ...extra, handmatige_acceptatie: { ...ha, bevestigd_door: user.id, bevestigd_op: new Date().toISOString() } };
      await supabase.from("leads").update({ extra_data: nieuw }).eq("id", leadId);
      lead.extra_data = nieuw;
      try {
        await supabase.from("activiteiten_log").insert({
          actie_type: "handmatige_acceptatie_bevestigd",
          omschrijving: `Handmatige acceptatie bevestigd (sector ${String(ha.sector ?? "onbekend")}) vóór activatie`,
          uitgevoerd_door: user.id,
          uitgevoerd_door_naam: user.email ?? null,
          lead_id: leadId,
          klant_email: (lead.email ?? "").toLowerCase().trim() || null,
        });
      } catch (_e) { /* logfout blokkeert niet */ }
    }
  }

  // ── Exact config (gedeeld door beide acties) ──
  const { data: config } = await supabase.from("exact_config").select("*").maybeSingle();
  if (!config?.is_actief) return json({ success: false, error: "exact_niet_actief" }, 400);
  if (!config.divisie_code) return json({ success: false, error: "divisie_code_ontbreekt" }, 400);
  const baseUrl = config.base_url || "https://start.exactonline.nl";
  const div = config.divisie_code;
  const accessToken = await ensureValidToken(supabase, config);
  try {
    INV_GL_ACCOUNT = await getBavGlAccountId(supabase, config, accessToken);
  } catch (e) {
    return json({ success: false, error: "grootboek_bav_niet_gevonden", detail: e instanceof Error ? e.message : String(e) }, 500);
  }
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
    const mandaat = await mandaatGegevens(supabase, leadId, lead.sepa_akkoord_datum);
    const mRes = await fetch(`${baseUrl}/api/v1/${div}/cashflow/DirectDebitMandates`, {
      method: "POST", headers,
      body: JSON.stringify({
        Account: lead.exact_account_id,
        BankAccount: bankId,
        Reference: mandaat.reference,
        SignatureDate: mandaat.signatureDate,
        Type: EXACT_MANDAAT_TYPE_CORE,
        PaymentType: EXACT_MANDAAT_PAYMENT_DOORLOPEND,
        Description: mandaatOmschrijving(null, lead),
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
    const spec = pakketSpecVoorLead(lead, resolvePakketInvoice(lead.gekozen_pakket));
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
        maandprijs: maandprijsVoorLead(lead, getMaandprijs(lead.gekozen_pakket)),
        vanaf_datum: startStr, tot_datum: endStr,
      });
      retryOverride = {
        amount: calc.bedrag,
        headerDescription: `BAV-AVB premie instap`,
        lineDescription: regelOmschrijving("premie", startStr, endStr),
        lineNotes: regelNotities(calc.dagen, calc.dagprijs),
        periodStart: startStr, periodEnd: endStr,
      };
    }
    const { data: policyRef } = await supabase.from("policies").select("certificate_number").eq("lead_id", leadId).eq("status", "geldig").limit(1).maybeSingle();
    lead.certificate_number = policyRef?.certificate_number ?? null;
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
      action: factuurLogTekst(invRes.invoiceNumber, invRes.amount ?? spec.bedrag, (() => { const ps = plannerSpec(lead, spec.bedrag, retryOverride); return ps ? { start: ps.periodeStart, eind: ps.periodeEind, naarRato: !!retryOverride } : undefined; })()),
      admin_user_id: user.id,
      admin_email: user.email,
      exact_invoice_id: invRes.invoiceId,
      exact_invoice_number: invRes.invoiceNumber,
      exact_invoice_amount: invRes.amount,
    };
    const newLog = Array.isArray(lead.activatie_log) ? [...lead.activatie_log, entry] : [entry];
    await supabase.from("leads").update({
      exact_invoice_id: invRes.invoiceId,
      exact_invoice_number: invRes.invoiceNumber,
      exact_invoice_amount: invRes.amount,
      exact_invoice_created_at: nowIso,
      activatie_log: newLog,
    }).eq("id", leadId);
    {
      const ps = plannerSpec(lead, spec.bedrag, retryOverride);
      if (ps) {
        const pr = await zetInPlanner(supabase, lead, lead.exact_account_id, ps);
        if (!pr.ok) await logSync(supabase, { trigger_type: "planner_contract", status: "error", lead_id: leadId, admin_user_id: user.id, error_message: pr.fout });
      }
    }
    await logSync(supabase, {
      trigger_type: "invoice_retry", status: "success",
      lead_id: leadId, admin_user_id: user.id,
      exact_account_id: lead.exact_account_id,
      http_status: 201,
      payload: {
        exact_invoice_id: invRes.invoiceId,
        exact_invoice_number: invRes.invoiceNumber,
        amount: invRes.amount,
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
  let exactRelatieCode: string | null = null;
  try {
    const dupRes = await fetch(
      `${baseUrl}/api/v1/${div}/crm/Accounts?$select=ID,Code,Name,ChamberOfCommerce&$filter=ChamberOfCommerce eq '${kvk}'&$top=1`,
      { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } },
    );
    const dupJson = await dupRes.json().catch(() => ({}));
    const dupArr = Array.isArray(dupJson?.d?.results) ? dupJson.d.results : Array.isArray(dupJson?.d) ? dupJson.d : [];
    if (dupArr.length > 0 && dupArr[0]?.ID) {
      reusedAccountId = dupArr[0].ID;
      reusedAccountName = dupArr[0]?.Name ?? null;
      exactRelatieCode = String(dupArr[0]?.Code ?? "").trim() || null;
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

  // dd-mm-jjjj, zelfde notatie als ingangFmt — defensief: alleen tonen als akkoord waar is.
  const sepaAkkoordFmt = (() => {
    if (!lead.sepa_akkoord || !lead.sepa_akkoord_datum) return null;
    try {
      const d = new Date(lead.sepa_akkoord_datum);
      if (Number.isNaN(d.getTime())) return null;
      return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
    } catch { return null; }
  })();

  // Land uit het SEPA-bewijs (adres rekeninghouder zoals ingevuld); anders
  // afgeleid uit het postcodeformaat; standaard NL.
  const { data: bewijsLand } = await supabase.from("sepa_machtiging_bewijs")
    .select("debiteur_adres").eq("bron_id", leadId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const accountCountry = landcodeVoor((bewijsLand as any)?.debiteur_adres?.land, lead.adres_postcode);

  const accountPayload = {
    Name: String(lead.bedrijfsnaam),
    ChamberOfCommerce: kvk,
    Email: lead.email,
    Phone: lead.telefoon,
    AddressLine1: `${lead.adres_straat} ${lead.adres_huisnummer}`.trim(),
    Postcode: String(lead.adres_postcode).toUpperCase().replace(/\s+/g, " "),
    City: lead.adres_plaats,
    Country: accountCountry,
    Status: "C",
    IsSales: true,
    Remarks:
      `Online aanvraag via zpzaken.nl op ${new Date().toLocaleDateString("nl-NL")}\n` +
      `Gekozen pakket: ${lead.gekozen_pakket}\n` +
      `Branche: ${lead.branche}\n` +
      `Ingangsdatum: ${ingangFmt}` +
      (sepaAkkoordFmt ? `\nSEPA-incasso akkoord: Ja, op ${sepaAkkoordFmt}` : ""),
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
    exactRelatieCode = String(accData?.d?.Code ?? accData?.Code ?? "").trim() || null;
  }

  // Exact geeft Code niet altijd terug op POST; lees dan de zojuist aangemaakte relatie terug.
  if (!exactRelatieCode) {
    const codeRes = await fetch(`${baseUrl}/api/v1/${div}/crm/Accounts(guid'${exactAccountId}')?$select=Code`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    });
    if (codeRes.ok) {
      const codeJson = await codeRes.json().catch(() => ({}));
      exactRelatieCode = String(codeJson?.d?.Code ?? codeJson?.Code ?? "").trim() || null;
    }
  }
  lead.exact_relatie_code = exactRelatieCode;


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
  //   - PaymentType (Int16): 0=One-off, 1=Recurrent, 2=AdHoc (UK)
  //   Bron: https://start.exactonline.nl/docs/HlpRestAPIResourcesDetails.aspx?name=CashflowDirectDebitMandates

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
      const mandaat = await mandaatGegevens(supabase, leadId, lead.sepa_akkoord_datum);
      const mRes = await fetch(`${baseUrl}/api/v1/${div}/cashflow/DirectDebitMandates`, {
        method: "POST", headers,
        body: JSON.stringify({
          Account: exactAccountId,
          BankAccount: exactBankAccountId,
          Reference: mandaat.reference,
          SignatureDate: mandaat.signatureDate,
          Type: EXACT_MANDAAT_TYPE_CORE,
          PaymentType: EXACT_MANDAAT_PAYMENT_DOORLOPEND,
          Description: mandaatOmschrijving(reusedAccountName, lead),
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
  let factuurPeriode: { start: string; eind: string; naarRato?: boolean } | undefined;
  let exactInvoiceCreatedAt: string | null = null;
  let invoiceWarning: string | null = null;
  const pakketSpec = pakketSpecVoorLead(lead, resolvePakketInvoice(lead.gekozen_pakket));
  if (!pakketSpec) {
    invoiceWarning = `Onbekend pakket "${lead.gekozen_pakket}" — geen factuur aangemaakt.`;
  } else {
    const { data: policyRef } = await supabase.from("policies").select("certificate_number").eq("lead_id", leadId).eq("status", "geldig").limit(1).maybeSingle();
    lead.certificate_number = policyRef?.certificate_number ?? null;
    const itemEnsure = await ensureBavAvbItem({
      supabase, config, baseUrl, div, headers, accessToken,
      logCtx: { lead_id: leadId, admin_user_id: user.id },
    });

    // Maandpolis-instap: pro-rata factuur voor periode vandaag → laatste van die maand.
    // Vervolgperioden komen via de factuurplanner (klant_contracten).
    let override: Parameters<typeof createExactInvoice>[0]["override"] = undefined;
    if (isMaandPolis(lead.gekozen_pakket)) {
      const startStr = String(lead.ingangsdatum).slice(0, 10);
      const endStr = lastOfMonth(startStr);
      const calc = calcMaandProrata({
        maandprijs: maandprijsVoorLead(lead, getMaandprijs(lead.gekozen_pakket)),
        vanaf_datum: startStr, tot_datum: endStr,
      });
      override = {
        amount: calc.bedrag,
        headerDescription: "BAV-AVB premie instap",
        lineDescription: regelOmschrijving("premie", startStr, endStr),
        lineNotes: regelNotities(calc.dagen, calc.dagprijs),
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

      // Klant meenemen in de factuurplanner vanaf de tweede periode.
      const ps = plannerSpec(lead, pakketSpec.bedrag, override);
      if (ps) factuurPeriode = { start: ps.periodeStart, eind: ps.periodeEind, naarRato: !!override };
      if (ps) {
        const pr = await zetInPlanner(supabase, lead, exactAccountId, ps);
        if (!pr.ok) await logSync(supabase, { trigger_type: "planner_contract", status: "error", lead_id: leadId, admin_user_id: user.id, error_message: pr.fout });
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
        action: factuurLogTekst(exactInvoiceNumber, exactInvoiceAmount ?? pakketSpec.bedrag, factuurPeriode),
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
    exact_relatie_code: exactRelatieCode,
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

  // Log activatie in activiteiten_log (best-effort, mag activatie nooit blokkeren)
  if (activationSucceeded) {
    try {
      await supabase.from("activiteiten_log").insert({
        actie_type: "lead_geactiveerd",
        omschrijving: `Lead geactiveerd: ${[lead.voornaam, lead.achternaam].filter(Boolean).join(" ") || lead.email || leadId}`,
        uitgevoerd_door: user.id,
        uitgevoerd_door_naam: user.email ?? null,
        lead_id: leadId,
        klant_email: (lead.email ?? "").toLowerCase().trim() || null,
      });
    } catch (_e) { /* logfout mag activatie niet laten falen */ }
  }

  // Automatische Mijn ZP-uitnodiging (alleen als er al een polis is en de lead
  // nog nooit is uitgenodigd). Mag de activatie nooit laten mislukken.
  const portaalUitnodiging = activationSucceeded
    ? await autoInvitePortalLead(supabase, req, leadId, user.id, "lead-to-exact-activate")
        .catch((e) => ({ verstuurd: false, error: String(e) }))
    : null;

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
      reused_account: !!reusedAccountId,
      reused_account_name: reusedAccountName,
      reused_bankaccount: bankAccountReused,
      reused_mandate: mandateReused,
      activation_status: activationSucceeded ? "actief" : lead.status,
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
    reused_account: !!reusedAccountId,
    reused_account_name: reusedAccountName,
    reused_bankaccount: bankAccountReused,
    reused_mandate: mandateReused,
    activation_status: activationSucceeded ? "actief" : lead.status,
    portaal_uitnodiging: portaalUitnodiging,
    message: reusedAccountId
      ? "Klant geactiveerd op bestaande Exact-relatie (hergebruik)"
      : "Klant succesvol geactiveerd in Exact",
  });
});

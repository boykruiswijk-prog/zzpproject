// Diagnose-helper voor Exact: metadata, ItemGroups en gecontroleerde invalid-account probes.
// Geen business-fix; probes gebruiken een niet-bestaande relatie zodat geen factuur wordt aangemaakt.
import { exactRegelBedrag } from "../_shared/factuurTekst.ts";
import { getBavGlAccountId } from "../_shared/exactGl.ts";
import { ensureValidToken } from "../_shared/exactToken.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireSupervisor } from "../_shared/teamAuth.ts";
import { metExactMelding } from "../_shared/exactBoekingMelding.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function extractEntityXml(xml: string, entity: string): string | null {
  const re = new RegExp(`<EntityType[^>]*Name="${entity}"[\\s\\S]*?<\\/EntityType>`);
  return xml.match(re)?.[0] ?? null;
}

function extractProperties(entityXml: string | null) {
  if (!entityXml) return [];
  return [...entityXml.matchAll(/<Property\s+([^>]*?)\/>/g)].map((m) => {
    const attrs = m[1];
    const get = (name: string) => attrs.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? null;
    return {
      name: get("Name"),
      type: get("Type"),
      nullable: get("Nullable"),
      sap_label: get("sap:label"),
    };
  }).filter((p) => p.name);
}

function pickDateish(properties: Array<{ name: string | null; type: string | null }>) {
  return properties.filter((p) => {
    const n = (p.name ?? "").toLowerCase();
    const t = (p.type ?? "").toLowerCase();
    return t.includes("datetime") || /date|period|deferred|from|to|term|paymentreference/.test(n);
  });
}

async function readExactBody(res: Response) {
  const text = await res.text().catch(() => "");
  let jsonBody: unknown = null;
  try { jsonBody = JSON.parse(text); } catch { /* non-json */ }
  return { raw: text, json: jsonBody };
}



Deno.serve(metExactMelding("exact-diagnose-itemgroups", async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const auth = await requireSupervisor(req, supabase);
    if (auth instanceof Response) return new Response(await auth.text(), { status: auth.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { data: config, error: cErr } = await supabase.from("exact_config").select("*").limit(1).maybeSingle();
    if (cErr || !config) return json({ error: "exact_config niet gevonden", cErr }, 500);

    const token = await ensureValidToken(supabase, config);
    const baseUrl = config.base_url || "https://start.exactonline.nl";
    const division = config.divisie_code || "4401707";
    const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };

    // Exact $metadata diagnose voor SalesInvoice / SalesInvoiceLine.
    const url = new URL(req.url);
    if (url.searchParams.get("sales_meta") === "1") {
      const mUrl = `${baseUrl}/api/v1/${division}/salesinvoice/$metadata`;
      const mRes = await fetch(mUrl, { headers: { Authorization: `Bearer ${token}`, Accept: "application/xml" } });
      const xml = await mRes.text();
      const invoiceXml = extractEntityXml(xml, "SalesInvoice");
      const lineXml = extractEntityXml(xml, "SalesInvoiceLine");
      const invoiceProperties = extractProperties(invoiceXml);
      const lineProperties = extractProperties(lineXml);
      const probeNames = [
        "StartDate", "EndDate", "DateFrom", "DateTo", "FromDate", "ToDate",
        "PaymentReference", "DeferredCostFromDate", "DeferredCostToDate",
        "DeferredRevenueFromDate", "DeferredRevenueToDate", "DeferredRevenueFrom", "DeferredRevenueTo",
        "CostCenterFrom", "CostCenterTo", "AppliedCost", "Period",
      ];
      const has = (props: Array<{ name: string | null }>, name: string) => props.some((p) => p.name === name);
      return json({
        success: mRes.ok,
        http_status: mRes.status,
        division,
        raw_length: xml.length,
        sales_invoice: {
          all_fields: invoiceProperties,
          date_related_fields: pickDateish(invoiceProperties),
          candidate_presence: Object.fromEntries(probeNames.map((n) => [n, has(invoiceProperties, n)])),
          entity_xml: invoiceXml,
        },
        sales_invoice_line: {
          all_fields: lineProperties,
          date_related_fields: pickDateish(lineProperties),
          candidate_presence: Object.fromEntries(probeNames.map((n) => [n, has(lineProperties, n)])),
          entity_xml: lineXml,
        },
      });
    }

    // Gecontroleerde POST-probe: gebruikt een niet-bestaande account-GUID.
    // Als het veld ongeldig is, meldt Exact dat vóór business-validatie. Als het veld geldig is,
    // verwachten we een account/relatie-validatiefout en is er niets aangemaakt.
    if (url.searchParams.get("sales_probe") === "1") {
      const target = url.searchParams.get("target") || "line";
      const field = url.searchParams.get("field") || "";
      const value = url.searchParams.get("value") || "2026-06-25T00:00:00";
      const bogusAccount = "00000000-0000-0000-0000-000000000001";
      const writeHeaders = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        Prefer: "return=representation",
      };
      const line: any = {
        GLAccount: await getBavGlAccountId(supabase, config, token),
        VATCode: "0",
        ...exactRegelBedrag(8021, 0.01),
        Description: `Metadata probe${field ? ` ${field}` : ""}`,
      };
      if (config.exact_item_id_bav_avb) line.Item = config.exact_item_id_bav_avb;
      const payload: any = {
        InvoiceTo: bogusAccount,
        OrderedBy: bogusAccount,
        Journal: "70",
        PaymentCondition: "IN",
        Type: 8021,
        Status: 20,
        InvoiceDate: "2026-06-25T00:00:00",
        OrderDate: "2026-06-25T00:00:00",
        YourRef: "metadata-probe",
        Description: "Metadata probe - should fail on bogus account",
        SalesInvoiceLines: [line],
      };
      if (field) {
        if (target === "header") payload[field] = value;
        else line[field] = value;
      }
      const r = await fetch(`${baseUrl}/api/v1/${division}/salesinvoice/SalesInvoices`, {
        method: "POST", headers: writeHeaders, body: JSON.stringify(payload),
      });
      const body = await readExactBody(r);
      return json({
        success: false,
        note: "Expected failure: bogus InvoiceTo/OrderedBy prevents creation; use response to distinguish unknown property vs accepted field.",
        target,
        field: field || null,
        http_status: r.status,
        request_payload: payload,
        response_raw: body.raw,
        response_json: body.json,
      });
    }

    // Optioneel: $metadata voor ItemGroup
    if (url.searchParams.get("meta") === "1") {
      const mUrl = `${baseUrl}/api/v1/${division}/logistics/$metadata`;
      const mRes = await fetch(mUrl, { headers: { Authorization: `Bearer ${token}`, Accept: "application/xml" } });
      const xml = await mRes.text();
      const m = xml.match(/<EntityType[^>]*Name="ItemGroup"[\s\S]*?<\/EntityType>/);
      return json({ success: mRes.ok, http_status: mRes.status, entity_xml: m ? m[0] : null, raw_length: xml.length });
    }

    // Diagnose: GET SalesInvoice by ID or by InvoiceTo
    const invId = url.searchParams.get("invoice_id");
    const invTo = url.searchParams.get("invoice_to");
    if (invId || invTo) {
      const filter = invId
        ? `InvoiceID eq guid'${invId}'`
        : `InvoiceTo eq guid'${invTo}'`;
      const u = `${baseUrl}/api/v1/${division}/salesinvoice/SalesInvoices?$filter=${encodeURIComponent(filter)}&$select=InvoiceID,InvoiceNumber,Status,StatusDescription,Description,AmountDC,InvoiceDate,Journal,PaymentCondition`;
      const r = await fetch(u, { headers });
      const t = await r.text();
      let j: any = null; try { j = JSON.parse(t); } catch { /* ignore */ }
      return json({ success: r.ok, http_status: r.status, results: j?.d?.results ?? j?.d ?? j, url: u });
    }

    // Optioneel: bootstrap ItemGroup DIENSTEN + Item BAV-AVB (idempotent).
    if (url.searchParams.get("bootstrap") === "1") {
      const writeHeaders = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        Prefer: "return=representation",
      };
      const report: any = { steps: [] };

      // 1) Ensure ItemGroup
      let groupId = config.exact_item_group_id;
      if (!groupId) {
        // lookup
        const lr = await fetch(`${baseUrl}/api/v1/${division}/logistics/ItemGroups?$select=ID,Code&$filter=Code eq 'DIENSTEN'&$top=1`, { headers });
        if (lr.ok) {
          const lj: any = await lr.json().catch(() => ({}));
          const arr = lj?.d?.results ?? lj?.d ?? [];
          if (arr[0]?.ID) groupId = arr[0].ID;
        }
        if (!groupId) {
          const payload = { Code: "DIENSTEN", Description: "Verzekeringsdiensten" };
          const cr = await fetch(`${baseUrl}/api/v1/${division}/logistics/ItemGroups`, {
            method: "POST", headers: writeHeaders, body: JSON.stringify(payload),
          });
          const ct = await cr.text();
          let cj: any = null; try { cj = JSON.parse(ct); } catch { /* ignore */ }
          report.steps.push({ step: "ItemGroup POST", status: cr.status, request: payload, response: cj ?? ct });
          if (!cr.ok) return json({ success: false, ...report }, 500);
          groupId = cj?.d?.ID || cj?.ID;
        } else {
          report.steps.push({ step: "ItemGroup lookup", found: groupId });
        }
        await supabase.from("exact_config").update({ exact_item_group_id: groupId }).eq("id", config.id);
      } else {
        report.steps.push({ step: "ItemGroup already in config", id: groupId });
      }

      // 2) Ensure Item
      let itemId = config.exact_item_id_bav_avb;
      if (!itemId) {
        const lr = await fetch(`${baseUrl}/api/v1/${division}/logistics/Items?$select=ID,Code&$filter=Code eq 'BAV-AVB'&$top=1`, { headers });
        if (lr.ok) {
          const lj: any = await lr.json().catch(() => ({}));
          const arr = lj?.d?.results ?? lj?.d ?? [];
          if (arr[0]?.ID) itemId = arr[0].ID;
        }
        if (!itemId) {
          const payload = {
            Code: "BAV-AVB",
            Description: "Beroeps- en bedrijfsaansprakelijkheidsverzekering",
            SalesVatCode: "0",
            IsSalesItem: true,
            IsStockItem: false,
            ItemGroup: groupId,
          };
          const cr = await fetch(`${baseUrl}/api/v1/${division}/logistics/Items`, {
            method: "POST", headers: writeHeaders, body: JSON.stringify(payload),
          });
          const ct = await cr.text();
          let cj: any = null; try { cj = JSON.parse(ct); } catch { /* ignore */ }
          report.steps.push({ step: "Item POST", status: cr.status, request: payload, response: cj ?? ct });
          if (!cr.ok) return json({ success: false, ...report }, 500);
          itemId = cj?.d?.ID || cj?.ID;
        } else {
          report.steps.push({ step: "Item lookup", found: itemId });
        }
        await supabase.from("exact_config").update({ exact_item_id_bav_avb: itemId }).eq("id", config.id);
      } else {
        report.steps.push({ step: "Item already in config", id: itemId });
      }

      return json({ success: true, exact_item_group_id: groupId, exact_item_id_bav_avb: itemId, ...report });
    }





    // STAP 1: lijst ItemGroups
    const groupsUrl = `${baseUrl}/api/v1/${division}/logistics/ItemGroups?$select=ID,Code,Description,Notes&$orderby=Code`;
    const gRes = await fetch(groupsUrl, { headers });
    const gText = await gRes.text();
    let gJson: any = null; try { gJson = JSON.parse(gText); } catch { /* ignore */ }
    if (!gRes.ok) return json({ step: "ItemGroups GET", status: gRes.status, body: gText }, 500);
    const groups = gJson?.d?.results ?? gJson?.d ?? [];

    // STAP 3: count items per group
    const enriched = await Promise.all(groups.map(async (g: any) => {
      const cUrl = `${baseUrl}/api/v1/${division}/logistics/Items?$filter=ItemGroup eq guid'${g.ID}'&$top=0&$inlinecount=allpages`;
      const cRes = await fetch(cUrl, { headers });
      const cTxt = await cRes.text();
      let count: any = null;
      try {
        const cj = JSON.parse(cTxt);
        count = cj?.d?.__count ?? cj?.d?.results?.length ?? null;
      } catch { /* ignore */ }
      return { ID: g.ID, Code: g.Code, Description: g.Description, ItemCount: count };
    }));

    return json({
      success: true,
      division,
      groups_total: enriched.length,
      groups: enriched,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
}));

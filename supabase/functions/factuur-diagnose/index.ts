// Fase 2 diagnose: STRIKT ALLEEN-LEZEN. Artikelen, recente verkoopfacturen + regels,
// filterbaarheid Remarks en PDF-test op één verwerkte factuur. Geen Exact-writes, geen mails.
import { createClient } from "npm:@supabase/supabase-js@2";
import { ensureValidToken, refreshAccessToken } from "../_shared/exactToken.ts";
import { requireSupervisor } from "../_shared/teamAuth.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
};
const json = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const intern = Deno.env.get("INTERNAL_FUNCTION_SECRET");
  const gegeven = req.headers.get("x-internal-secret");
  if (!(intern && gegeven && gegeven === intern)) {
    const auth = await requireSupervisor(req, admin);
    if (auth instanceof Response) return json({ error: "geen_toegang" }, auth.status);
  }
  const body = await req.json().catch(() => ({}));
  const stap = String(body?.stap ?? "");
  const { data: cfg } = await admin.from("exact_config").select("*").limit(1).maybeSingle();
  if (!cfg?.is_actief || !cfg.divisie_code) return json({ error: "exact_niet_actief" }, 400);
  const baseUrl = cfg.base_url || "https://start.exactonline.nl";
  const div = String(cfg.divisie_code).trim();
  let token = await ensureValidToken(admin, cfg);
  let calls = 0;

  async function get(url: string, accept = "application/json"): Promise<Response> {
    for (let p = 0; p < 3; p++) {
      calls++;
      const res = await fetch(url, { method: "GET", headers: { Authorization: `Bearer ${token}`, Accept: accept } });
      if (res.status === 401 && p === 0) { token = await refreshAccessToken(admin, cfg); continue; }
      if (res.status === 429) { await sleep(30_000); continue; }
      await sleep(1100);
      return res;
    }
    throw new Error("GET mislukt");
  }
  async function alles(pad: string): Promise<any[]> {
    const rows: any[] = [];
    let url: string | null = `${baseUrl}/api/v1/${div}/${pad}`;
    while (url && calls < 150) {
      const r = await get(url);
      if (!r.ok) throw new Error(`${r.status}: ${(await r.text()).slice(0, 300)}`);
      const d = (await r.json())?.d ?? {};
      rows.push(...(d.results ?? []));
      url = d.__next ?? null;
    }
    return rows;
  }

  try {
    if (stap === "artikelen") {
      const items = await alles("logistics/Items?$select=ID,Code,Description,IsSalesItem,GLRevenue,GLRevenueCode,EndDate");
      return json({ calls, aantal: items.length, items: items.map((i) => ({ id: i.ID, code: i.Code, omschrijving: i.Description, verkoop: i.IsSalesItem, gl: i.GLRevenueCode, einde: i.EndDate })) });
    }
    if (stap === "recent") {
      const dagen = Math.min(31, Number(body?.dagen ?? 7));
      const vanaf = new Date(Date.now() - dagen * 86400000).toISOString().slice(0, 10);
      const f = `Created ge datetime'${vanaf}' or InvoiceDate ge datetime'${vanaf}'`;
      const facturen = await alles(`salesinvoice/SalesInvoices?$select=InvoiceID,InvoiceNumber,InvoiceDate,Created,Status,InvoiceTo,InvoiceToName,AmountDC,YourRef,Description&$filter=${encodeURIComponent(f)}`);
      const regels = await alles(`salesinvoice/SalesInvoiceLines?$select=InvoiceID,Item,ItemCode,ItemDescription,GLAccount,GLAccountCode,Quantity,NetPrice,AmountDC,Description,VATCode&$filter=${encodeURIComponent(facturen.slice(0, 40).map((x) => `InvoiceID eq guid'${x.InvoiceID}'`).join(" or ") || "1 eq 0")}`).catch((e) => [{ fout: String(e) }]);
      return json({ calls, vanaf, facturen, regels });
    }
    if (stap === "remarks") {
      const r1 = await get(`${baseUrl}/api/v1/${div}/salesinvoice/SalesInvoices?$select=InvoiceID,Remarks,YourRef&$filter=${encodeURIComponent("substringof('ZPF-',Remarks) eq true")}&$top=1`);
      const t1 = await r1.text();
      const r2 = await get(`${baseUrl}/api/v1/${div}/salesinvoice/SalesInvoices?$select=InvoiceID,YourRef&$filter=${encodeURIComponent("YourRef eq 'ZPF-00000000'")}&$top=1`);
      const t2 = await r2.text();
      return json({ calls, remarks_filter: { status: r1.status, body: t1.slice(0, 300) }, yourref_filter: { status: r2.status, body: t2.slice(0, 300) } });
    }
    if (stap === "boekingen") {
      const dagen = Math.min(31, Number(body?.dagen ?? 7));
      const vanaf = new Date(Date.now() - dagen * 86400000).toISOString().slice(0, 10);
      const f = `Created ge datetime'${vanaf}' or EntryDate ge datetime'${vanaf}'`;
      const kop = await alles(`salesentry/SalesEntries?$select=EntryID,EntryNumber,InvoiceNumber,EntryDate,Created,Customer,CustomerName,AmountDC,YourRef,Description,Journal,Status&$filter=${encodeURIComponent(f)}`).catch((e) => [{ fout: String(e).slice(0, 300) }]);
      const regels = await alles(`salesentry/SalesEntryLines?$select=EntryID,GLAccountCode,AmountDC,Description,From,To&$filter=${encodeURIComponent(`Date ge datetime'${vanaf}'`)}`).catch((e) => [{ fout: String(e).slice(0, 300) }]);
      return json({ calls, vanaf, kop, regels });
    }
    if (stap === "pdf") {
      const r = await get(`${baseUrl}/api/v1/${div}/salesinvoice/SalesInvoices?$select=InvoiceID,InvoiceNumber,Status&$filter=${encodeURIComponent(body?.invoice_id ? `InvoiceID eq guid'${String(body.invoice_id).replace(/[^0-9a-f-]/gi, "")}'` : "Status eq 50")}&$top=1`);
      const inv = (await r.json())?.d?.results?.[0];
      if (!inv) return json({ calls, fout: "geen verwerkte factuur gevonden" });
      const pdf = await get(`${baseUrl}/docs/XMLDownload.aspx?Topic=SalesInvoice&Format=Pdf&Params_InvoiceID=${inv.InvoiceID}&Division=${div}`, "application/pdf");
      const buf = new Uint8Array(await pdf.arrayBuffer());
      const magic = new TextDecoder().decode(buf.slice(0, 5));
      const res: any = { calls, factuurnummer: inv.InvoiceNumber, status: inv.Status, xmldownload: { http: pdf.status, type: pdf.headers.get("content-type"), bytes: buf.length, is_pdf: magic === "%PDF-" } };
      if (magic !== "%PDF-") {
        const d = await get(`${baseUrl}/api/v1/${div}/documents/Documents?$select=ID,Type,TypeDescription,Subject&$filter=${encodeURIComponent(`SalesInvoiceNumber eq ${inv.InvoiceNumber}`)}&$top=5`);
        res.documents = { http: d.status, body: (await d.text()).slice(0, 500) };
      }
      return json(res);
    }
    return json({ error: "stap: artikelen | recent | boekingen | remarks | pdf" }, 400);
  } catch (e) {
    return json({ calls, fout: String(e).slice(0, 500) }, 500);
  }
});

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
  const cronSecret = req.headers.get("x-cron-secret");
  let cronOk = false;
  if (cronSecret) {
    const { data: ok } = await admin.rpc("verify_cron_secret", { p_secret: cronSecret });
    cronOk = ok === true;
  }
  if (!cronOk && !(intern && gegeven && gegeven === intern)) {
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
      const regels = await alles(`salesinvoice/SalesInvoiceLines?$select=InvoiceID,Item,ItemCode,ItemDescription,GLAccount,Quantity,NetPrice,AmountDC,Description,VATCode&$filter=${encodeURIComponent(facturen.slice(0, 40).map((x) => `InvoiceID eq guid'${x.InvoiceID}'`).join(" or ") || "1 eq 0")}`).catch((e) => [{ fout: String(e) }]);
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
      const regels = await alles(`salesentry/SalesEntryLines?$select=EntryID,GLAccountCode,AmountDC,Description,From,To&$filter=${encodeURIComponent(kop.filter((x: any) => x.EntryID).slice(0, 40).map((x: any) => `EntryID eq guid'${x.EntryID}'`).join(" or ") || "1 eq 0")}`).catch((e) => [{ fout: String(e).slice(0, 300) }]);
      return json({ calls, vanaf, kop, regels });
    }
    if (stap === "pdf") {
      const id = String(body?.invoice_id ?? "").replace(/[^0-9a-f-]/gi, "");
      const r = await get(`${baseUrl}/api/v1/${div}/salesinvoice/SalesInvoices(guid'${id}')?$select=InvoiceID,InvoiceNumber,Status`);
      const j = await r.json().catch(() => null);
      const inv = j?.d?.results?.[0] ?? (j?.d?.InvoiceID ? j.d : null);
      if (!inv) return json({ calls, fout: "geen verwerkte factuur gevonden" });
      const pdf = await get(`${baseUrl}/docs/XMLDownload.aspx?Topic=SalesInvoice&Format=Pdf&Params_InvoiceID=${inv.InvoiceID}&Division=${div}`, "application/pdf");
      const buf = new Uint8Array(await pdf.arrayBuffer());
      const magic = new TextDecoder().decode(buf.slice(0, 5));
      const res: any = { calls, factuurnummer: inv.InvoiceNumber, status: inv.Status, xmldownload: { http: pdf.status, type: pdf.headers.get("content-type"), bytes: buf.length, is_pdf: magic === "%PDF-" } };
      if (magic !== "%PDF-") {
        const d = await get(`${baseUrl}/api/v1/${div}/documents/Documents?$select=ID,Type,TypeDescription,Subject&$filter=${encodeURIComponent(`SalesInvoiceNumber eq ${inv.InvoiceNumber}`)}&$top=5`);
        const dj = (await d.json().catch(() => null))?.d; const doc = dj?.results?.[0] ?? (Array.isArray(dj) ? dj[0] : null);
        res.documents = { http: d.status, gevonden: !!doc, type: doc?.Type };
        if (doc?.ID) {
          const a = await get(`${baseUrl}/api/v1/${div}/documents/DocumentAttachments?$select=ID,FileName,FileSize,Url&$filter=${encodeURIComponent(`Document eq guid'${doc.ID}'`)}`);
          const aj = (await a.json().catch(() => null))?.d; const att = aj?.results?.[0] ?? (Array.isArray(aj) ? aj[0] : null);
          res.attachment = { http: a.status, bestandsnaam: att?.FileName, grootte: att?.FileSize };
          res.alle_bijlagen = (aj?.results ?? aj ?? []).map((x: any) => ({ naam: x.FileName, grootte: x.FileSize }));
          if (att?.Url) {
            const f2 = await get(`${att.Url}&Download=1`, "*/*");
            const b2 = new Uint8Array(await f2.arrayBuffer());
            res.download1 = { http: f2.status, type: f2.headers.get("content-type"), bytes: b2.length, begin: new TextDecoder().decode(b2.slice(0, 5)) };
            const f = await get(att.Url, "application/pdf");
            const b = new Uint8Array(await f.arrayBuffer());
            res.attachment_download = { http: f.status, type: f.headers.get("content-type"), bytes: b.length, is_pdf: new TextDecoder().decode(b.slice(0, 5)) === "%PDF-" };
          }
        }
      }
      return json(res);
    }
    if (stap === "facturen") {
      // Alleen GET: per factuur-ID details, bij 404 zoeken op OrderedBy.
      const guid = (s: unknown) => String(s ?? "").replace(/[^0-9a-f-]/gi, "").slice(0, 36);
      const velden = "InvoiceID,InvoiceNumber,Status,StatusDescription,Journal,JournalDescription,InvoiceDate,Created,Modified,Division,OrderedBy,OrderedByName,InvoiceTo,InvoiceToName,Creator,CreatorFullName,AmountDC,Description,YourRef,Type,TypeDescription";
      const lijst = Array.isArray(body?.facturen) ? body.facturen.slice(0, 10) : [];
      const uit: any[] = [];
      for (const f of lijst) {
        const id = guid(f?.invoice_id); const acc = guid(f?.account_id);
        const r = await get(`${baseUrl}/api/v1/${div}/salesinvoice/SalesInvoices(guid'${id}')?$select=${velden}`);
        const t = await r.text();
        let d: any = null; try { d = JSON.parse(t)?.d; } catch { /* */ }
        const rij: any = { invoice_id: id, http: r.status, factuur: d?.results?.[0] ?? (d?.InvoiceID ? d : null), fout: r.ok ? undefined : t.slice(0, 300) };
        if (acc) {
          const r2 = await get(`${baseUrl}/api/v1/${div}/salesinvoice/SalesInvoices?$select=${velden}&$filter=${encodeURIComponent(`OrderedBy eq guid'${acc}'`)}`);
          const t2 = await r2.text(); let d2: any = null; try { d2 = JSON.parse(t2)?.d; } catch { /* */ }
          rij.per_account = { http: r2.status, facturen: d2?.results ?? [], fout: r2.ok ? undefined : t2.slice(0, 300) };
        }
        uit.push(rij);
          const r3 = await get(`${baseUrl}/api/v1/${div}/crm/Accounts(guid'${acc}')?$select=ID,Code,Name,Status`);
          const j3: any = await r3.json().catch(() => null);
          rij.account = { http: r3.status, code: j3?.d?.Code ?? j3?.d?.results?.[0]?.Code, naam: j3?.d?.Name ?? j3?.d?.results?.[0]?.Name };
          const r4 = await get(`${baseUrl}/api/v1/${div}/salesentry/SalesEntries?$select=EntryID,EntryNumber,InvoiceNumber,EntryDate,Journal,JournalDescription,AmountDC,Description,Status,CreatorFullName&$filter=${encodeURIComponent(`Customer eq guid'${acc}'`)}`);
          const j4: any = await r4.json().catch(() => null);
          rij.boekingen = { http: r4.status, rijen: j4?.d?.results ?? [] };
        }
      return json({ calls, division: div, resultaten: uit });
    }
    return json({ error: "stap: artikelen | recent | boekingen | remarks | pdf | facturen" }, 400);
  } catch (e) {
    return json({ calls, fout: String(e).slice(0, 500) }, 500);
  }
});

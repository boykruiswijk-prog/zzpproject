// H16 — eenmalige bulk: bestaande SEPA-machtigingen uit AFAS naar Exact cashflow/DirectDebitMandates.
// Toegang: supervisor/admin-JWT of header x-cron-secret (verify_cron_secret).
//
// Geverifieerde velden (Exact REST API-referentie):
// - cashflow/DirectDebitMandates: Account (Guid, verplicht), BankAccount (Guid, verplicht), Reference,
//   SignatureDate, Type (0 = Core, 1 = B2B), PaymentType (0 = eenmalig, 1 = doorlopend), Description,
//   CancellationDate (bepaalt geldigheid). Bron:
//   https://start.exactonline.nl/docs/HlpRestAPIResourcesDetails.aspx?name=CashflowDirectDebitMandates
// - crm/BankAccounts: Account (Guid, verplicht), BankAccount (rekeningnummer, verplicht),
//   BankAccountHolderName, Main (boolean). Veld IBAN is "Obsolete" — we vergelijken op BankAccount. Bron:
//   https://start.exactonline.nl/docs/HlpRestAPIResourcesDetails.aspx?name=CRMBankAccounts
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { ensureValidToken } from "../_shared/exactToken.ts";

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const DELAY_MS = 1100; // Exact: max 60 calls/min per administratie

function normNaam(s: string): string {
  return (s ?? "").toLowerCase()
    .replace(/\bb\.\s*v\.?/g, " ").replace(/\bbv\b/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ").trim();
}
const normIban = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, "").toUpperCase();
// Zelfde codefilter als exact-email-bulk (Code is 18 tekens, links opgevuld met spaties; bron CRMAccounts-doc).
const codeFilter = (code: string) => `Code eq '${code.trim().padStart(18, " ").replace(/'/g, "''")}'`;
const guidOk = (g: string) => /^[0-9a-f-]{36}$/i.test(g);
// Exact OData-datum "/Date(1234567890000)/" → yyyy-mm-dd
const exactDatum = (v: unknown) => {
  const m = typeof v === "string" ? v.match(/\/Date\((-?\d+)\)\//) : null;
  return m ? new Date(Number(m[1])).toISOString().slice(0, 10) : (v ?? null);
};
const isActief = (m: { CancellationDate?: unknown }) => {
  const d = exactDatum(m.CancellationDate);
  return !d || String(d) > new Date().toISOString().slice(0, 10);
};

class RateLimited extends Error {}

// Description (Edm.String) — de REST-referentie (CashflowDirectDebitMandates) noemt GEEN maximale lengte
// en is PUT-baar. Conservatieve afkapping op 60 tekens zodat lengte nooit een fout kan veroorzaken.
const DESCRIPTION_MAX = 60;
const OUDE_OMSCHRIJVING = "Overgenomen uit AFAS";
const omschrijving = (exactNaam: string | null | undefined, naam: string) =>
  ((exactNaam ?? "").trim() || (naam ?? "").trim()).slice(0, DESCRIPTION_MAX);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // ── Toegang ──
  let uid: string | null = null;
  const cronSecret = req.headers.get("x-cron-secret") ?? "";
  if (cronSecret) {
    const { data: ok } = await supabase.rpc("verify_cron_secret", { p_secret: cronSecret });
    if (ok !== true) return json({ error: "unauthorized" }, 401);
  } else {
    const auth = req.headers.get("authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
    const { data: u } = await supabase.auth.getUser(auth.slice(7));
    uid = u?.user?.id ?? null;
    if (!uid) return json({ error: "unauthorized" }, 401);
    const { data: sup } = await supabase.rpc("is_supervisor_or_admin", { _user_id: uid });
    if (sup !== true) return json({ error: "forbidden" }, 403);
  }

  const url = new URL(req.url);
  // deno-lint-ignore no-explicit-any
  let body: any = {};
  if (req.method === "POST") body = await req.json().catch(() => ({}));
  const mode = String(body.mode ?? url.searchParams.get("mode") ?? "droogrun");
  if (mode !== "droogrun" && mode !== "uitvoeren" && mode !== "omschrijving_herstellen") return json({ error: "ongeldige mode" }, 400);
  const limitRaw = Number(body.limit ?? url.searchParams.get("limit") ?? 10);
  const limit = Math.max(1, Math.min(15, Number.isFinite(limitRaw) ? Math.floor(limitRaw) : 10));
  const beginStatus = mode === "droogrun" ? "wachtend" : mode === "uitvoeren" ? "droogrun_ok" : "bijgewerkt";

  const openCount = async () => {
    const { count } = await supabase.from("exact_mandaat_import").select("id", { count: "exact", head: true })
      .in("status", ["wachtend", "droogrun_ok"]);
    return count ?? 0;
  };

  const { data: rows, error: rowsErr } = await supabase.from("exact_mandaat_import")
    .select("*").eq("status", beginStatus).match(mode === "omschrijving_herstellen" ? {} : {})
    .not("id", "is", null).order("relatiecode", { ascending: true }).limit(mode === "omschrijving_herstellen" ? 1000 : limit);
  if (rowsErr) return json({ error: "db_fout" }, 500);
  if (!rows || rows.length === 0) {
    return json({ mode, verwerkt: 0, per_status: {}, open: await openCount(),
      melding: mode === "uitvoeren" ? "Geen regels met status droogrun_ok — niets uitgevoerd." : "Geen wachtende regels." });
  }

  const perStatus: Record<string, number> = {};
  // deno-lint-ignore no-explicit-any
  const save = async (id: string, patch: Record<string, any>) => {
    await supabase.from("exact_mandaat_import").update({ ...patch, verwerkt_op: new Date().toISOString() }).eq("id", id);
    perStatus[patch.status] = (perStatus[patch.status] ?? 0) + 1;
  };

  let ctx: { base: string; headers: Record<string, string> } | null = null;
  let lastCall = 0;
  const logSync = (status: string, msg: string) =>
    supabase.from("exact_sync_log").insert({
      trigger_type: "mandaat_bulk", status, error_message: msg.slice(0, 500),
      admin_user_id: uid, payload: { mode, limit },
    });
  const getCtx = async () => {
    if (ctx) return ctx;
    const { data: cfg } = await supabase.from("exact_config").select("*").limit(1).maybeSingle();
    if (!cfg?.is_actief || !cfg?.divisie_code) throw new Error("exact_niet_actief");
    const token = await ensureValidToken(supabase, cfg);
    ctx = {
      base: `${cfg.base_url || "https://start.exactonline.nl"}/api/v1/${cfg.divisie_code}`,
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" },
    };
    return ctx;
  };
  const exactFetch = async (path: string, init: RequestInit = {}) => {
    const c = await getCtx();
    const wait = lastCall + DELAY_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastCall = Date.now();
    const r = await fetch(`${c.base}/${path}`, { ...init, headers: c.headers });
    if (r.status === 429) { await r.text().catch(() => ""); throw new RateLimited("429"); }
    return r;
  };
  const fout = async (r: Response, what: string) => `${what} ${r.status}: ${(await r.text()).slice(0, 300)}`;

  let gestopt: string | null = null;
  for (const row of rows) {
    if (mode === "omschrijving_herstellen") {
      try {
        const id = String(row.exact_mandaat_id ?? "");
        if (!guidOk(id)) { await save(row.id, { status: row.status, melding: "Herstel: ongeldig mandaat-ID" }); continue; }
        const gr = await exactFetch(`cashflow/DirectDebitMandates(guid'${id}')?$select=ID,Description`);
        if (!gr.ok) { await save(row.id, { status: row.status, melding: `Herstel: ${await fout(gr, "GET machtiging")}` }); continue; }
        const huidig = String((await gr.json())?.d?.Description ?? "");
        if (huidig.trim() !== OUDE_OMSCHRIJVING) {
          await save(row.id, { status: row.status, melding: `Herstel: niet nodig, omschrijving is "${huidig}"` }); continue;
        }
        const nieuw = omschrijving(row.exact_naam, row.naam);
        const pr = await exactFetch(`cashflow/DirectDebitMandates(guid'${id}')`, { method: "PUT", body: JSON.stringify({ Description: nieuw }) });
        if (!pr.ok) { await save(row.id, { status: row.status, melding: `Herstel: ${await fout(pr, "PUT machtiging")}` }); continue; }
        await pr.text().catch(() => "");
        await save(row.id, { status: row.status, melding: `Herstel: omschrijving gezet op "${nieuw}"` });
      } catch (e) {
        if (e instanceof RateLimited) { gestopt = "Exact rate limit (429) — later opnieuw aanroepen"; break; }
        const msg = e instanceof Error ? e.message : String(e);
        await logSync("fout", msg);
        return json({ error: msg === "exact_niet_actief" ? "exact_niet_actief" : "exact_token_fout", melding: msg, mode }, 503);
      }
      continue;
    }
    try {
      // 1. Account
      const ar = await exactFetch(`crm/Accounts?$filter=${encodeURIComponent(codeFilter(row.relatiecode))}&$select=ID,Code,Name`);
      if (!ar.ok) { await save(row.id, { status: "fout", melding: await fout(ar, "GET account") }); continue; }
      const accs = (await ar.json())?.d?.results ?? [];
      if (accs.length === 0) { await save(row.id, { status: "niet_gevonden", melding: "Code niet gevonden in Exact" }); continue; }
      if (accs.length > 1) { await save(row.id, { status: "fout", melding: `${accs.length} accounts met deze code` }); continue; }
      const acc = accs[0] as { ID: string; Name: string };
      if (!guidOk(acc.ID)) { await save(row.id, { status: "fout", melding: "Ongeldig account-ID" }); continue; }
      const base = { exact_account_id: acc.ID, exact_naam: acc.Name };
      const a = normNaam(row.naam), b = normNaam(acc.Name);
      // includes dekt ook "de ene begint met de andere" (afgekapte namen op 50 tekens).
      if (!a || !b || (!a.includes(b) && !b.includes(a) && !a.startsWith(b) && !b.startsWith(a))) {
        await save(row.id, { ...base, status: "naam_afwijkend", melding: "Naam in Exact wijkt af" }); continue;
      }

      // 2. Bestaande machtigingen (ook bij uitvoeren opnieuw: nooit dubbel aanmaken)
      const mr = await exactFetch(`cashflow/DirectDebitMandates?$filter=${encodeURIComponent(`Account eq guid'${acc.ID}'`)}&$select=ID,Reference,Type,PaymentType,BankAccount,SignatureDate,CancellationDate`);
      if (!mr.ok) { await save(row.id, { ...base, status: "fout", melding: await fout(mr, "GET mandaten") }); continue; }
      // deno-lint-ignore no-explicit-any
      const mandaten: any[] = (await mr.json())?.d?.results ?? [];
      if (mandaten.some((m) => (m.Reference ?? "").trim() === row.kenmerk)) {
        await save(row.id, { ...base, status: "overgeslagen_bestaat_al", melding: "Machtiging met dit kenmerk bestaat al" }); continue;
      }

      // 3. Bankrekeningen
      const br = await exactFetch(`crm/BankAccounts?$filter=${encodeURIComponent(`Account eq guid'${acc.ID}'`)}&$select=ID,BankAccount,Main`);
      if (!br.ok) { await save(row.id, { ...base, status: "fout", melding: await fout(br, "GET bankrekeningen") }); continue; }
      // deno-lint-ignore no-explicit-any
      const banks: any[] = (await br.json())?.d?.results ?? [];
      const bankIban = new Map(banks.map((x) => [x.ID, normIban(x.BankAccount)]));

      const anderen = mandaten.filter(isActief);
      if (anderen.length > 0) {
        await save(row.id, { ...base, status: "andere_machtiging_aanwezig", melding: "Andere actieve machtiging aanwezig",
          bestaande_mandaten: anderen.map((m) => ({ kenmerk: m.Reference ?? null, type: m.Type ?? null,
            payment_type: m.PaymentType ?? null, iban: bankIban.get(m.BankAccount) ?? null, datum: exactDatum(m.SignatureDate) })) });
        continue;
      }
      const match = banks.find((x) => normIban(x.BankAccount) === normIban(row.iban));

      if (mode === "droogrun") {
        await save(row.id, { ...base, status: "droogrun_ok", melding: null,
          bankrekening_actie: match ? "bestaand" : "aanmaken", exact_bankrekening_id: match?.ID ?? null });
        continue;
      }

      // Uitvoeren
      let bankId: string | null = match?.ID ?? null;
      let bankActie = match ? "bestaand" : "aanmaken";
      if (!bankId) {
        // deno-lint-ignore no-explicit-any
        const payload: Record<string, any> = { Account: acc.ID, BankAccount: normIban(row.iban), BankAccountHolderName: acc.Name };
        if (banks.some((x) => x.Main === true)) payload.Main = false; // nooit de bestaande hoofdrekening vervangen
        const pr = await exactFetch("crm/BankAccounts", { method: "POST", body: JSON.stringify(payload) });
        if (!pr.ok) { await save(row.id, { ...base, status: "fout", melding: await fout(pr, "POST bankrekening") }); continue; }
        bankId = (await pr.json())?.d?.ID ?? null;
        if (!bankId) { await save(row.id, { ...base, status: "fout", melding: "Bankrekening aangemaakt zonder ID in antwoord" }); continue; }
        bankActie = "aangemaakt";
      }
      const mp = await exactFetch("cashflow/DirectDebitMandates", { method: "POST", body: JSON.stringify({
        Account: acc.ID, BankAccount: bankId, Reference: row.kenmerk,
        SignatureDate: `${row.ondertekend_op}T00:00:00`, Type: 0, PaymentType: 1, Description: omschrijving(acc.Name, row.naam),
      }) });
      if (!mp.ok) {
        await save(row.id, { ...base, status: "fout", exact_bankrekening_id: bankId, bankrekening_actie: bankActie,
          melding: await fout(mp, "POST machtiging") });
        continue;
      }
      const mandaatId = (await mp.json())?.d?.ID ?? null;
      await save(row.id, { ...base, status: "bijgewerkt", melding: null, exact_bankrekening_id: bankId,
        bankrekening_actie: bankActie, exact_mandaat_id: mandaatId });
    } catch (e) {
      if (e instanceof RateLimited) { gestopt = "Exact rate limit (429) — later opnieuw aanroepen"; break; }
      const msg = e instanceof Error ? e.message : String(e);
      await logSync("fout", msg);
      return json({ error: msg === "exact_niet_actief" ? "exact_niet_actief" : "exact_token_fout", melding: msg,
        mode, per_status: perStatus, open: await openCount() }, 503);
    }
  }
  return json({ mode, verwerkt: Object.values(perStatus).reduce((s, n) => s + n, 0), per_status: perStatus,
    open: await openCount(), ...(gestopt ? { gestopt } : {}) });
});

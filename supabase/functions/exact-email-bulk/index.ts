// H15 — eenmalige bulk: e-mailadressen van bestaande relaties naar Exact crm/Accounts.
// Toegang: supervisor/admin-JWT of header x-cron-secret (verify_cron_secret).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { ensureValidToken } from "../_shared/exactToken.ts";

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const DELAY_MS = 1100; // Exact: max 60 calls/min per administratie

export function normNaam(s: string): string {
  return (s ?? "").toLowerCase()
    .replace(/\bb\.\s*v\.?/g, " ").replace(/\bbv\b/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ").trim();
}

// Exact API-referentie crm/Accounts, veld Code: "fixed length numeric string with leading spaces,
// length 18. IMPORTANT: When you use OData $filter on this field you have to make sure the filter
// parameter contains the leading spaces". Bron:
// https://start.exactonline.nl/docs/HlpRestAPIResourcesDetails.aspx?name=CRMAccounts
// Daarom filteren we op de officieel gedocumenteerde opgevulde waarde i.p.v. trim(Code).
function codeFilter(code: string): string {
  return `Code eq '${code.trim().padStart(18, " ").replace(/'/g, "''")}'`;
}

class RateLimited extends Error {}

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

  // ── Parameters (query of body) ──
  const url = new URL(req.url);
  // deno-lint-ignore no-explicit-any
  let body: any = {};
  if (req.method === "POST") body = await req.json().catch(() => ({}));
  const mode = String(body.mode ?? url.searchParams.get("mode") ?? "droogrun");
  if (mode !== "droogrun" && mode !== "uitvoeren") return json({ error: "ongeldige mode" }, 400);
  const limitRaw = Number(body.limit ?? url.searchParams.get("limit") ?? 20);
  const limit = Math.max(1, Math.min(25, Number.isFinite(limitRaw) ? Math.floor(limitRaw) : 20));
  const beginStatus = mode === "droogrun" ? "wachtend" : "droogrun_ok";

  const openCount = async () => {
    const { count } = await supabase.from("exact_email_import").select("id", { count: "exact", head: true })
      .in("status", ["wachtend", "droogrun_ok"]);
    return count ?? 0;
  };

  const { data: rows, error: rowsErr } = await supabase.from("exact_email_import")
    .select("*").eq("status", beginStatus).order("excel_rij", { ascending: true }).limit(limit);
  if (rowsErr) return json({ error: "db_fout" }, 500);
  if (!rows || rows.length === 0) {
    return json({ mode, verwerkt: 0, per_status: {}, open: await openCount(),
      melding: mode === "uitvoeren" ? "Geen regels met status droogrun_ok — niets uitgevoerd." : "Geen wachtende regels." });
  }

  const perStatus: Record<string, number> = {};
  const now = () => new Date().toISOString();
  // deno-lint-ignore no-explicit-any
  const save = async (id: string, patch: Record<string, any>) => {
    await supabase.from("exact_email_import").update({ ...patch, verwerkt_op: now() }).eq("id", id);
    perStatus[patch.status] = (perStatus[patch.status] ?? 0) + 1;
  };

  // Lazy Exact-context: pas bij eerste regel die Exact nodig heeft.
  let ctx: { base: string; headers: Record<string, string> } | null = null;
  let lastCall = 0;
  const logSync = (status: string, msg: string) =>
    supabase.from("exact_sync_log").insert({
      trigger_type: "email_bulk", status, error_message: msg.slice(0, 500),
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

  let gestopt: string | null = null;
  for (const row of rows) {
    if (row.niet_gevonden_volgens_excel) {
      await save(row.id, { status: "niet_gevonden", melding: "Volgens Excel niet in Exact" });
      continue;
    }
    try {
      let acc = null as null | { ID: string; Code: string; Name: string; Email: string | null };
      if (mode === "uitvoeren" && row.exact_account_id) {
        // Opnieuw ophalen vlak vóór schrijven: nooit een inmiddels gevuld adres overschrijven.
        const r = await exactFetch(`crm/Accounts(guid'${row.exact_account_id}')?$select=ID,Code,Name,Email`);
        if (!r.ok) { await save(row.id, { status: "fout", melding: `GET ${r.status}: ${(await r.text()).slice(0, 300)}` }); continue; }
        acc = (await r.json())?.d ?? null;
      } else {
        const q = `crm/Accounts?$filter=${encodeURIComponent(codeFilter(row.relatiecode))}&$select=ID,Code,Name,Email`;
        const r = await exactFetch(q);
        if (!r.ok) { await save(row.id, { status: "fout", melding: `GET ${r.status}: ${(await r.text()).slice(0, 300)}` }); continue; }
        const results = (await r.json())?.d?.results ?? [];
        if (results.length === 0) { await save(row.id, { status: "niet_gevonden", melding: "Code niet gevonden in Exact" }); continue; }
        if (results.length > 1) { await save(row.id, { status: "fout", melding: `${results.length} accounts met deze code` }); continue; }
        acc = results[0];
      }
      if (!acc) { await save(row.id, { status: "niet_gevonden", melding: "Account niet gevonden" }); continue; }
      const base = { exact_account_id: acc.ID, exact_naam: acc.Name, exact_email_voor: acc.Email ?? null };
      const a = normNaam(row.naam), b = normNaam(acc.Name);
      if (!a || !b || (!a.includes(b) && !b.includes(a))) {
        await save(row.id, { ...base, status: "naam_afwijkend", melding: "Naam in Exact wijkt af" }); continue;
      }
      if (acc.Email && acc.Email.trim()) {
        await save(row.id, { ...base, status: "overgeslagen_heeft_al_email", melding: "Exact heeft al een e-mailadres" }); continue;
      }
      if (mode === "droogrun") { await save(row.id, { ...base, status: "droogrun_ok", melding: null }); continue; }
      const p = await exactFetch(`crm/Accounts(guid'${acc.ID}')`, { method: "PUT", body: JSON.stringify({ Email: row.email }) });
      if (p.ok) { await p.text().catch(() => ""); await save(row.id, { ...base, status: "bijgewerkt", melding: null }); }
      else await save(row.id, { ...base, status: "fout", melding: `PUT ${p.status}: ${(await p.text()).slice(0, 300)}` });
    } catch (e) {
      if (e instanceof RateLimited) { gestopt = "Exact rate limit (429) — later opnieuw aanroepen"; break; }
      // Token/config-fout: regel blijft op beginstatus, netjes stoppen.
      const msg = e instanceof Error ? e.message : String(e);
      await logSync("fout", msg);
      return json({ error: msg === "exact_niet_actief" ? "exact_niet_actief" : "exact_token_fout", melding: msg,
        mode, per_status: perStatus, open: await openCount() }, 503);
    }
  }
  return json({ mode, verwerkt: Object.values(perStatus).reduce((s, n) => s + n, 0), per_status: perStatus,
    open: await openCount(), ...(gestopt ? { gestopt } : {}) });
});

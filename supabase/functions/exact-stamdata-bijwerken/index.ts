// Eenmalige stamdata-update in Exact (akkoord Boy 13 okt 2026, uitzondering op A5).
// Body: { actie: 'proef' | 'live', onderdeel: 'telefoon' | 'machtigingen' | 'beide', limit?: number }
// Toegang: header x-cron-secret (verify_cron_secret) of supervisor/admin met 2FA (aal2).
// 'proef' doet alleen GET's; 'live' verwerkt alleen regels met status proef_ok. Geen mails aan klanten.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { ensureValidToken, refreshAccessToken } from "../_shared/exactToken.ts";
import { metExactMelding } from "../_shared/exactBoekingMelding.ts";
import { requireSupervisor } from "../_shared/teamAuth.ts";
import { beveiligd, controleerRelatie, type Exact, verwerkMandaat, verwerkTelefoon } from "../_shared/exactStamdata.ts";

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const DELAY_MS = 1100;
const BUDGET_MS = 120_000; // ruim binnen de looptijdgrens van een functie
const BRON = "afas_export_20261013";
class Gestopt extends Error {}

Deno.serve(metExactMelding("exact-stamdata-bijwerken", async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "alleen POST" }, 405);
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  let uid: string | null = null;
  const cron = req.headers.get("x-cron-secret") ?? "";
  if (cron) {
    const { data: ok } = await sb.rpc("verify_cron_secret", { p_secret: cron });
    if (ok !== true) return json({ error: "unauthorized" }, 401);
  } else {
    const a = await requireSupervisor(req, sb);
    if (a instanceof Response) return json({ error: "geen_toegang" }, a.status);
    uid = a.userId;
  }

  // deno-lint-ignore no-explicit-any
  const body: any = await req.json().catch(() => ({}));
  const actie = String(body.actie ?? "");
  const onderdeel = String(body.onderdeel ?? "");
  if (!["proef", "live", "controle"].includes(actie)) return json({ error: "actie moet 'proef', 'live' of 'controle' zijn" }, 400);
  const codes: string[] = actie === "controle" && Array.isArray(body.relatiecodes)
    ? [...new Set(body.relatiecodes.map((c: unknown) => String(c ?? "").trim()).filter((c: string) => /^[A-Za-z0-9-]{1,18}$/.test(c)))] as string[] : [];
  if (actie === "controle" && (codes.length === 0 || codes.length > 20)) return json({ error: "relatiecodes: 1 t/m 20 geldige codes" }, 400);
  if (actie !== "controle" && !["telefoon", "machtigingen", "beide"].includes(onderdeel)) return json({ error: "onderdeel moet 'telefoon', 'machtigingen' of 'beide' zijn" }, 400);
  const limitRaw = Number(body.limit ?? 100);
  const limit = Math.max(1, Math.min(500, Number.isFinite(limitRaw) ? Math.floor(limitRaw) : 100));
  const live = actie === "live";
  const start = Date.now();

  const { data: run } = await sb.from("exact_stamdata_runs")
    .insert({ actie, onderdeel: actie === "controle" ? "controle" : onderdeel, gestart_door: uid, via: cron ? "cron_secret" : "supervisor" }).select("id").single();

  // Exact-context met tempo 1 call per 1,1 s en één refresh bij 401.
  const { data: cfg } = await sb.from("exact_config").select("*").limit(1).maybeSingle();
  if (!cfg?.is_actief || !cfg?.divisie_code) return json({ error: "exact_niet_actief" }, 503);
  const base = `${cfg.base_url || "https://start.exactonline.nl"}/api/v1/${String(cfg.divisie_code).trim()}`;
  let token = await ensureValidToken(sb, cfg);
  let laatste = 0;
  const ruw: Exact = async (methode, pad, b) => {
    if (Date.now() - start > BUDGET_MS) throw new Gestopt("tijdslimiet bereikt; roep opnieuw aan voor de rest");
    if (!live && methode !== "GET") throw new Error("Proef mag alleen GET doen");
    const doe = async () => {
      const wacht = laatste + DELAY_MS - Date.now();
      if (wacht > 0) await sleep(wacht);
      laatste = Date.now();
      return await fetch(`${base}/${pad}`, { method: methode,
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" },
        body: b ? JSON.stringify(b) : undefined });
    };
    let r = await doe();
    if (r.status === 401) { await r.text().catch(() => ""); token = await refreshAccessToken(sb, cfg); r = await doe(); }
    if (r.status === 429) { await r.text().catch(() => ""); throw new Gestopt("Exact rate limit (429); later opnieuw aanroepen"); }
    const tekst = await r.text().catch(() => "");
    let data = null; try { data = tekst ? JSON.parse(tekst) : null; } catch { /* geen json */ }
    return { ok: r.ok, status: r.status, data, tekst };
  };
  const ex = beveiligd(ruw);

  const aantallen: Record<string, Record<string, number>> = {};
  const fouten: { onderdeel: string; relatiecode: string; melding: string }[] = [];
  const tel = (o: string, s: string) => { (aantallen[o] ??= {})[s] = (aantallen[o][s] ?? 0) + 1; };
  let gestopt: string | null = null;

  if (actie === "controle") {
    // deno-lint-ignore no-explicit-any
    const uitkomsten: any[] = [];
    for (const code of codes) {
      try {
        const r = await controleerRelatie(ex, code);
        await sb.from("exact_controle").insert({ relatiecode: code, resultaat: r });
        uitkomsten.push(r);
      } catch (e) { gestopt = e instanceof Error ? e.message : String(e); break; }
    }
    if (run?.id) await sb.from("exact_stamdata_runs").update({ geeindigd: new Date().toISOString(), aantallen: { controle: uitkomsten.length }, gestopt }).eq("id", run.id);
    return json({ run_id: run?.id ?? null, actie, resultaten: uitkomsten, ...(gestopt ? { gestopt } : {}) });
  }

  try {
    if (onderdeel !== "machtigingen") {
      const { data: rows, error } = await sb.from("exact_telefoon_import").select("*")
        .eq("status", live ? "proef_ok" : "nieuw").order("relatiecode").limit(limit);
      if (error) throw new Error(`db: ${error.message}`);
      for (const r of rows ?? []) {
        const p = await verwerkTelefoon(ex, r, live);
        await sb.from("exact_telefoon_import").update({ ...p, verwerkt_op: new Date().toISOString() }).eq("id", r.id);
        tel("telefoon", p.status);
        if (p.status === "fout") fouten.push({ onderdeel: "telefoon", relatiecode: r.relatiecode, melding: String(p.melding ?? "") });
      }
    }
    if (onderdeel !== "telefoon") {
      let q = sb.from("klant_mandaten").select("id,relatiecode,iban,kenmerk,ondertekend_op,exact_status")
        .eq("bron", BRON).eq("in_exact", false).order("relatiecode").limit(limit);
      q = live ? q.eq("exact_status", "proef_ok") : q.is("exact_status", null);
      const { data: rows, error } = await q;
      if (error) throw new Error(`db: ${error.message}`);
      for (const r of rows ?? []) {
        const { _bestaat, status, melding, ...rest } = await verwerkMandaat(ex, r, live);
        const patch: Record<string, unknown> = { ...rest, exact_status: status, exact_melding: melding ?? null, exact_verwerkt_op: new Date().toISOString() };
        // Alleen na een live-run in_exact zetten (ook als het kenmerk er al stond).
        if (live && _bestaat) { patch.in_exact = true; patch.exact_kenmerk = r.kenmerk; }
        await sb.from("klant_mandaten").update(patch).eq("id", r.id);
        tel("machtigingen", status);
        if (status === "fout") fouten.push({ onderdeel: "machtigingen", relatiecode: r.relatiecode, melding: String(melding ?? "") });
      }
    }
  } catch (e) {
    gestopt = e instanceof Error ? e.message : String(e);
  }

  const open = {
    telefoon: (await sb.from("exact_telefoon_import").select("id", { count: "exact", head: true }).in("status", ["nieuw", "proef_ok"])).count ?? 0,
    machtigingen: (await sb.from("klant_mandaten").select("id", { count: "exact", head: true })
      .eq("bron", BRON).eq("in_exact", false).or("exact_status.is.null,exact_status.eq.proef_ok")).count ?? 0,
  };
  if (run?.id) await sb.from("exact_stamdata_runs").update({ geeindigd: new Date().toISOString(), aantallen: { ...aantallen, open }, fouten, gestopt }).eq("id", run.id);
  return json({ run_id: run?.id ?? null, actie, onderdeel, aantallen, fouten, open, ...(gestopt ? { gestopt } : {}) });
}, { verzamel: true }));

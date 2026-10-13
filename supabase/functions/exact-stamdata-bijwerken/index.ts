// Eenmalige stamdata-update in Exact (akkoord Boy 13 okt 2026, uitzondering op A5).
// Body: { actie: 'proef' | 'live', onderdeel: 'telefoon' | 'machtigingen' | 'beide', limit?: number }
// Toegang: header x-cron-secret (verify_cron_secret) of supervisor/admin met 2FA (aal2).
// 'proef' doet alleen GET's; 'live' verwerkt alleen regels met status proef_ok. Geen mails aan klanten.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { ensureValidToken, refreshAccessToken } from "../_shared/exactToken.ts";
import { metExactMelding } from "../_shared/exactBoekingMelding.ts";
import { requireSupervisor } from "../_shared/teamAuth.ts";
import { beveiligd, bevestigIncassoCode, controleerRelatie, type Exact, verwerkBetaalconditie, verwerkMandaat, verwerkMandaatMain, verwerkTelefoon } from "../_shared/exactStamdata.ts";

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
  if (actie !== "controle" && !["telefoon", "machtigingen", "beide", "betaalconditie", "mandaat_main", "alles"].includes(onderdeel)) return json({ error: "onderdeel moet telefoon, machtigingen, beide, betaalconditie, mandaat_main of alles zijn" }, 400);
  // Volgorde: telefoon, machtigingen, daarna betaalconditie. mandaat_main alleen apart (na akkoord Boy).
  const delen = onderdeel === "beide" ? ["telefoon", "machtigingen"] : onderdeel === "alles" ? ["telefoon", "machtigingen", "betaalconditie"] : [onderdeel];
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
    if (delen.includes("telefoon")) {
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
    if (delen.includes("machtigingen")) {
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
    for (const deel of ["betaalconditie", "mandaat_main"].filter((d) => delen.includes(d))) {
      if (deel === "betaalconditie") {
        const ic = await bevestigIncassoCode(ex); // stopt als 'IN' niet zeker incasso is
        tel("betaalconditie", `incassocode_${ic.code}_${ic.methode ?? "omschrijving"}`);
      }
      // Doelgroep: lopend contract, geen test, met exact_account_id.
      const { data: kc, error: e1 } = await sb.from("klant_contracten")
        .select("onderneming_id, ondernemingen!inner(id, exact_relatie_code, exact_account_id, is_test)")
        .in("status", ["actief", "loopt_af", "einddatum_controle"]).eq("is_test", false)
        .not("ondernemingen.exact_account_id", "is", null).eq("ondernemingen.is_test", false).limit(5000);
      if (e1) throw new Error(`db: ${e1.message}`);
      // deno-lint-ignore no-explicit-any
      const doel = new Map<string, any>();
      // deno-lint-ignore no-explicit-any
      for (const k of (kc ?? []) as any[]) { const o = k.ondernemingen; if (o?.exact_relatie_code && o.exact_account_id) doel.set(String(o.exact_relatie_code).trim(), o); }
      const { data: bestaand } = await sb.from("exact_betaalconditie_import").select("relatiecode,status").eq("onderdeel", deel).limit(10000);
      const stand = new Map((bestaand ?? []).map((b) => [b.relatiecode, b.status]));
      const wachtend = new Set<string>();
      if (deel === "betaalconditie") {
        const { data: km } = await sb.from("klant_mandaten").select("relatiecode").eq("in_exact", false).eq("exact_status", "proef_ok");
        for (const r of km ?? []) wachtend.add(String(r.relatiecode).trim());
      }
      const teDoen = [...doel.entries()].filter(([code]) => {
        const st = stand.get(code);
        if (live) return st === "proef_ok" || (deel === "betaalconditie" && st === "wacht_op_mandaat");
        return st === undefined || st === "nieuw" || st === "fout";
      }).slice(0, limit);
      for (const [code, o] of teDoen) {
        const rij = { relatiecode: code, exact_account_id: o.exact_account_id, wacht_op_mandaat: wachtend.has(code) };
        const p = deel === "betaalconditie" ? await verwerkBetaalconditie(ex, rij, live) : await verwerkMandaatMain(ex, rij, live);
        await sb.from("exact_betaalconditie_import").upsert({ onderdeel: deel, relatiecode: code, onderneming_id: o.id,
          exact_account_id: o.exact_account_id, ...p, verwerkt_op: new Date().toISOString() }, { onConflict: "onderdeel,relatiecode" });
        tel(deel, p.status);
        if (p.status === "fout") fouten.push({ onderdeel: deel, relatiecode: code, melding: String(p.melding ?? "") });
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

// Adreswijzigingen doorzetten naar de bestaande Exact-relatie (akkoord Boy 12-11-2026 13:50).
// Body: { actie: 'droog' | 'live', onderneming_ids?: uuid[] }. droog = alleen GET (lijst); live = wachtrij exact_adres_sync verwerken.
// Toegang: x-cron-secret (verify_cron_secret) of supervisor/admin met 2FA. Schrijft alleen adresvelden (allowlist _shared/exactAdres.ts).
// Fout bij Exact: rij blijft open (volgende run opnieuw) en precies één wijzigingsmelding per open rij. Geen klantmail.
// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { ensureValidToken, refreshAccessToken } from "../_shared/exactToken.ts";
import { metExactMelding } from "../_shared/exactBoekingMelding.ts";
import { requireSupervisor } from "../_shared/teamAuth.ts";
import { beveiligdAdres, verwerkAdres, type Exact } from "../_shared/exactAdres.ts";

const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fmt = (a: any) => a ? [a.AddressLine1, a.Postcode, a.City, a.Country].filter(Boolean).join(", ") : "-";

Deno.serve(metExactMelding("exact-adres-sync", async (req) => {
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
  const body: any = await req.json().catch(() => ({}));
  const actie = String(body.actie ?? "live");
  if (!["droog", "live"].includes(actie)) return json({ error: "actie moet droog of live zijn" }, 400);
  const ids: string[] = Array.isArray(body.onderneming_ids) ? [...new Set(body.onderneming_ids.map(String).filter((s: string) => UUID.test(s)))] as string[] : [];
  if (ids.length > 50) return json({ error: "maximaal 50 ondernemingen" }, 400);
  const live = actie === "live";

  let rijen: any[];
  if (live) {
    let q = sb.from("exact_adres_sync").select("*").in("status", ["wacht", "fout"]).order("created_at").limit(25);
    if (ids.length) q = q.in("onderneming_id", ids);
    rijen = (await q).data ?? [];
  } else {
    if (!ids.length) return json({ error: "droog vereist onderneming_ids" }, 400);
    const { data } = await sb.from("ondernemingen").select("id, exact_account_id").in("id", ids);
    rijen = (data ?? []).map((o: any) => ({ id: null, onderneming_id: o.id, exact_account_id: o.exact_account_id }));
  }
  if (!rijen.length) return json({ ok: true, verwerkt: 0, resultaten: [] });

  const { data: cfg } = await sb.from("exact_config").select("*").limit(1).maybeSingle();
  if (!cfg?.is_actief || !cfg?.divisie_code) return json({ error: "exact_niet_actief" }, 503);
  const base = `${cfg.base_url || "https://start.exactonline.nl"}/api/v1/${String(cfg.divisie_code).trim()}`;
  let token = await ensureValidToken(sb, cfg);
  let laatste = 0;
  const ruw: Exact = async (methode, pad, b) => {
    if (!live && methode !== "GET") throw new Error("Droog mag alleen GET doen");
    const doe = async () => {
      const w = laatste + 1100 - Date.now(); if (w > 0) await sleep(w); laatste = Date.now();
      return await fetch(`${base}/${pad}`, { method: methode, headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" }, body: b ? JSON.stringify(b) : undefined });
    };
    let r = await doe();
    if (r.status === 401) { await r.text().catch(() => ""); token = await refreshAccessToken(sb, cfg); r = await doe(); }
    const tekst = await r.text().catch(() => "");
    let data = null; try { data = tekst ? JSON.parse(tekst) : null; } catch { /* geen json */ }
    return { ok: r.ok, status: r.status, data, tekst };
  };
  const ex = beveiligdAdres(ruw);

  const resultaten: any[] = [];
  for (const rij of rijen) {
    const { data: o } = await sb.from("ondernemingen").select("id, naam, straat, huisnummer, postcode, plaats, exact_account_id, is_test").eq("id", rij.onderneming_id).maybeSingle();
    const accountId = String(o?.exact_account_id ?? rij.exact_account_id ?? "");
    let u;
    if (!o) u = { status: "fout", oud: null, nieuw: null, melding: "onderneming niet gevonden" } as any;
    else if (o.is_test) u = { status: "twijfel", oud: null, nieuw: null, melding: "testonderneming, nooit naar Exact" } as any;
    else { try { u = await verwerkAdres(ex, accountId, o, live); } catch (e) { u = { status: "fout", oud: null, nieuw: null, melding: String((e as Error)?.message ?? e).slice(0, 300) } as any; } }
    resultaten.push({ onderneming_id: rij.onderneming_id, naam: o?.naam, bij_ons: o ? [o.straat, o.huisnummer, o.postcode, o.plaats].join(" ") : null, ...u });
    if (!live || !rij.id) continue;

    const patch: any = { status: u.status, laatste_melding: u.melding, exact_oud: u.oud, exact_nieuw: u.nieuw, bijgewerkt_op: new Date().toISOString(), pogingen: (rij.pogingen ?? 0) + 1 };
    if (u.status !== "fout") patch.verwerkt_op = patch.bijgewerkt_op;
    if (u.status === "bijgewerkt") {
      await sb.from("sensitive_audit_log").insert({ target_table: "ondernemingen", target_id: rij.onderneming_id, actie: "exact_adres_bijgewerkt", veld: "AddressLine1,Postcode,City,Country",
        oude_waarde: fmt(u.oud), nieuwe_waarde: fmt(u.nieuw), uitgevoerd_door: uid, uitgevoerd_door_rol: uid ? "supervisor" : "systeem",
        details: { exact_account_id: accountId, sync_id: rij.id, bron: rij.bron, teruggelezen: u.terug } });
    }
    if ((u.status === "fout" || u.status === "twijfel") && !rij.melding_id) {
      const { data: m } = await sb.from("wijzigingsmeldingen").insert({
        titel: u.status === "fout" ? `Adres niet naar Exact: ${o?.naam ?? "onbekende klant"}` : `Adres controleren voor Exact: ${o?.naam ?? "onbekende klant"}`,
        omschrijving: `Het adres van ${o?.naam ?? "deze klant"} is bij ons gewijzigd naar ${resultaten.at(-1).bij_ons}, maar is niet automatisch in Exact gezet. Reden: ${u.melding}. Adres nu in Exact: ${fmt(u.oud)}.`
          + (u.status === "fout" ? " Het systeem probeert het bij de volgende run opnieuw." : ""),
        onderdeel: "admin",
        wat_moet_ellen_doen: u.status === "fout" ? "Niets zolang het opnieuw proberen lukt; blijft de melding terugkomen, laat dan het adres in Exact aanpassen." : "Controleer het adres en laat het zo nodig handmatig in Exact aanpassen.",
      }).select("id").single();
      if (m?.id) patch.melding_id = m.id;
    }
    await sb.from("exact_adres_sync").update(patch).eq("id", rij.id);
  }
  return json({ ok: true, actie, verwerkt: resultaten.length, resultaten });
}));

// Factuurplanner (vervangt monthly-invoices-cron). Dagelijks 06:00 NL via pg_cron.
// - Hoofdschakelaar facturatie_config.facturatie_actief UIT → alleen proefrun, NUL Exact-writes.
// - AAN → per kandidaat: claim (unieke rij) → Exact GET op sleutel → pas dan POST concept.
// Geen mails naar klanten; maximaal één alarmmail per dag naar het team.
// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";
import { ensureValidToken, refreshAccessToken } from "../_shared/exactToken.ts";
import { requireSupervisor } from "../_shared/teamAuth.ts";
import { sendExactAlarm } from "../_shared/exactAlarm.ts";
import { periodeTekst, regelOmschrijving } from "../_shared/factuurTekst.ts";
import { planningsSleutel, planningStatusUitExact } from "../_shared/factuurPeriode.ts";
import { getGlAccountIdVoorCode, GlNietGevondenError } from "../_shared/exactGl.ts";
import { bouwFactuurPayload, glUitCache } from "../_shared/factuurRegel.ts";
import { exactRegelBedrag } from "../_shared/factuurTekst.ts";
import { berekenOpzegCredit, berekenOudSysteemCredit, oudSysteemCreditPayload } from "../_shared/creditOpzegging.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret, x-internal-secret",
};
const json = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const ALARM = "Factuurplanner: dagelijkse run is mislukt";
const vandaagNL = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Amsterdam" }).format(new Date());

function samenvatting(rijen: any[]) {
  const per = (k: (r: any) => string) => {
    const m: Record<string, { aantal: number; bedrag: number }> = {};
    for (const r of rijen) { const key = k(r); m[key] ??= { aantal: 0, bedrag: 0 }; m[key].aantal++; m[key].bedrag = Math.round((m[key].bedrag + Number(r.bedrag)) * 100) / 100; }
    return m;
  };
  const vrij = rijen.filter((r) => !r.blokkade);
  const geblokkeerd = rijen.filter((r) => r.blokkade);
  const som = (a: any[]) => Math.round(a.reduce((s, r) => s + Number(r.bedrag), 0) * 100) / 100;
  return {
    totaal: { aantal: rijen.length, bedrag: som(rijen) },
    klaar: { aantal: vrij.length, bedrag: som(vrij) },
    geblokkeerd: { aantal: geblokkeerd.length, bedrag: som(geblokkeerd) },
    achterstallig: { aantal: rijen.filter((r) => r.achterstallig).length, bedrag: som(rijen.filter((r) => r.achterstallig)) },
    per_reden: per((r) => r.blokkade ?? "klaar"),
    per_soort: per((r) => r.blokkade_soort ?? "klaar"),
    per_dag: per((r) => r.periode_start),
    per_maand: per((r) => String(r.periode_start).slice(0, 7)),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const body = await req.json().catch(() => ({}));

  // Auth: cron via Vault-secret; anders intern secret of supervisor/admin.
  let trigger = "handmatig";
  const cronSecret = req.headers.get("x-cron-secret");
  if (cronSecret) {
    const { data: ok } = await admin.rpc("verify_cron_secret", { p_secret: cronSecret });
    if (!ok) return json({ error: "geen_toegang" }, 401);
    trigger = "cron";
    // Cron draait om 04:00 en 05:00 UTC; alleen de run die om 06:00 Nederlandse tijd valt telt (zomer/winter).
    const uurNL = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Amsterdam", hour: "2-digit", hour12: false }).format(new Date()));
    if (uurNL !== 6) return json({ overgeslagen: true, uur_nl: uurNL });
  } else {
    const intern = Deno.env.get("INTERNAL_FUNCTION_SECRET");
    const gegeven = req.headers.get("x-internal-secret");
    if (!(intern && gegeven && gegeven === intern)) {
      const auth = await requireSupervisor(req, admin);
      if (auth instanceof Response) return json({ error: "geen_toegang" }, auth.status);
    }
  }
  const actie = trigger === "cron" ? "dagrun" : String(body?.actie ?? "proefrun");

  if (actie === "doorrol_preview") {
    const { data, error } = await admin.rpc("doorrol_startstand", { _preview: true });
    if (error) return json({ error: error.message }, 500);
    return json(data);
  }

  const vandaag = vandaagNL();

  // Pre-flight: uitsluitend GET naar Exact (BTW-codes, dagboeken, betalingscondities, facturen). Schrijft niets.
  if (actie === "preflight_get") {
    const { data: cfg } = await admin.from("exact_config").select("*").limit(1).maybeSingle();
    if (!cfg?.is_actief) return json({ error: "Exact niet actief" }, 400);
    const baseUrl = cfg.base_url || "https://start.exactonline.nl";
    const div = String(cfg.divisie_code ?? "").trim();
    let token = await ensureValidToken(admin, cfg);
    const get = async (pad: string, max = 2000): Promise<any> => {
      const rows: any[] = []; let url: string | null = `${baseUrl}/api/v1/${div}/${pad}`;
      while (url && rows.length < max) {
        let r = await fetch(url, { method: "GET", headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
        if (r.status === 401) { token = await refreshAccessToken(admin, cfg); r = await fetch(url, { method: "GET", headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } }); }
        if (!r.ok) return { fout: `HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`, rows };
        const d = (await r.json())?.d ?? {}; rows.push(...(d.results ?? (Array.isArray(d) ? d : [d])));
        url = d.__next ?? null; await new Promise((s) => setTimeout(s, 1100));
      }
      return rows;
    };
    const deel = String(body?.deel ?? "");
    if (deel === "basis") return json({
      vat: await get("vat/VATCodes?$select=Code,Description,Percentage,Type,VATTransactionType,Charged"),
      journals: await get("financial/Journals?$select=Code,Description,Type"),
      betaal: await get("cashflow/PaymentConditions?$select=Code,Description,PaymentDays"),
    });
    if (deel === "facturen") {
      const van = String(body?.vanaf ?? "2026-10-01");
      return json({ facturen: await get(`salesinvoice/SalesInvoices?$select=InvoiceID,InvoiceNumber,InvoiceDate,InvoiceTo,InvoiceToName,Journal,PaymentCondition,Type,Status,Description,AmountFC,VATAmountFC&$filter=${encodeURIComponent(`InvoiceDate ge datetime'${van}'`)}`) });
    }
    if (deel === "regels") {
      const ids = (Array.isArray(body?.invoice_ids) ? body.invoice_ids : []).filter((x: string) => /^[0-9a-f-]{36}$/.test(x)).slice(0, 40);
      const out: Record<string, unknown> = {};
      for (const id of ids) out[id] = await get(`salesinvoice/SalesInvoiceLines?$select=Description,Item,ItemCode,VATCode,VATPercentage,VATAmountFC,AmountFC,Quantity,UnitPrice,GLAccount,StartTime,EndTime&$filter=${encodeURIComponent(`InvoiceID eq guid'${id}'`)}`);
      return json({ regels: out });
    }
    if (deel === "itemregels") {
      const item = String(body?.item ?? "7061187b-4aaf-4e74-b347-4b5a1464c97b");
      return json({ regels: await get(`salesinvoice/SalesInvoiceLines?$select=InvoiceID,Description,ItemCode,VATCode,VATPercentage,VATAmountFC,AmountFC,GLAccount,StartTime,EndTime&$filter=${encodeURIComponent(`Item eq guid'${item}'`)}`, Number(body?.max ?? 3000)) });
    }
    return json({ error: "deel: basis|facturen|regels|itemregels" }, 400);
  }

  // Grootboek opzoeken (alleen GET naar Exact) en eventueel een voorbeeldfactuur tonen. Schrijft niets naar Exact.
  if (actie === "gl_opzoeken" || actie === "factuur_dryrun") {
    const { data: cfg } = await admin.from("exact_config").select("*").limit(1).maybeSingle();
    if (!cfg?.is_actief) return json({ error: "Exact niet actief" }, 400);
    const codes = Array.isArray(body?.codes) ? body.codes.map(String).filter((c: string) => /^\d{3,6}$/.test(c)).slice(0, 10) : ["8003", "8004"];
    const token = await ensureValidToken(admin, cfg);
    const gevonden: Record<string, string | null> = {}; const meldingen: Record<string, string> = {};
    for (const c of codes) {
      try { gevonden[c] = await getGlAccountIdVoorCode(admin, cfg, token, c); }
      catch (e) { gevonden[c] = null; meldingen[c] = String((e as Error)?.message ?? e); }
    }
    if (actie === "gl_opzoeken") return json({ modus: "alleen GET", schrijft_naar_exact: false, grootboeken: gevonden, meldingen });
    const id = String(body?.klant_contract_id ?? "");
    const { data: kand } = await admin.rpc("facturatie_kandidaten", { _van: String(body?.van ?? vandaag), _tot: String(body?.tot ?? vandaag) });
    const k = (kand ?? []).find((r: any) => r.klant_contract_id === id);
    if (!k) return json({ error: "geen kandidaat voor dit contract in deze periode", grootboeken: gevonden }, 404);
    const gl = k.gl_code ? glUitCache(cfg, String(k.gl_code)) : null;
    return json({ modus: "dry-run", schrijft_naar_exact: false, schrijft_naar_database: false, grootboeken: gevonden, meldingen, kandidaat: k,
      payload: bouwFactuurPayload(k, gl, "ZPF-DRYRUN0", "Remarks") });
  }


  // Dry-run creditnota oud systeem: berekent bedrag en Exact-payload, schrijft niets (DB noch Exact).
  if (actie === "credit_dryrun") {
    const id = String(body?.klant_contract_id ?? ""); const eind = String(body?.einddatum ?? "");
    if (!/^[0-9a-f-]{36}$/.test(id) || !/^\d{4}-\d{2}-\d{2}$/.test(eind)) return json({ error: "klant_contract_id en einddatum vereist" }, 400);
    const { data: k } = await admin.from("klant_contracten").select("*").eq("id", id).maybeSingle();
    if (!k) return json({ error: "contract niet gevonden" }, 404);
    const { data: o } = await admin.from("ondernemingen").select("naam,exact_account_id").eq("id", k.onderneming_id).maybeSingle();
    const { data: m } = await admin.rpc("factuur_mapping_voor", { _itemcode: k.itemcode });
    const { data: ecfg } = await admin.from("exact_config").select("*").limit(1).maybeSingle();
    const ber = berekenOudSysteemCredit(k as any, eind);
    const blokkade = !m?.id || !m.bevestigd || !m.exact_item_id || m.blokkade_reden ? `geen bevestigde artikelmapping voor ${k.itemcode}` : !o?.exact_account_id ? "relatie niet gekoppeld aan Exact" : null;
    const sleutel = "ZPC-DRYRUN0";
    const payload = blokkade ? null : oudSysteemCreditPayload({ creditsleutel: sleutel, exact_account_id: o!.exact_account_id, exact_item_id: m.exact_item_id,
      gl_account_id: glUitCache(ecfg, String(m.gl_code ?? "")) ?? `(GUID grootboek ${m.gl_code})`, einddatum: eind, credit_vanaf: ber.vanaf, credit_tm: k.gefactureerd_tm, vandaag, regels: ber.regels });
    return json({ modus: "dry-run", schrijft_naar_exact: false, schrijft_naar_database: false, klant: o?.naam, contract: { bron_rij: k.bron_rij, itemcode: k.itemcode, cyclus: k.cyclus, bedrag_per_periode: k.bedrag_per_periode, aantal: k.aantal, begin_datum: k.begin_datum, gefactureerd_tm: k.gefactureerd_tm },
      einddatum: eind, credit_vanaf: ber.vanaf, credit_tm: k.gefactureerd_tm, perioden: ber.regels, bedrag: ber.bedrag, blokkade, artikel: m?.exact_item_code, gl_code: m?.gl_code,
      payload, opmerking: "Echte creditsleutel ZPC-xxxxxxxx ontstaat pas bij een opzegging (hash contract+aanvraag)." });
  }
  const van = actie === "proefrun" ? String(body?.van ?? vandaag) : vandaag;
  const tot = actie === "proefrun" ? String(body?.tot ?? van) : vandaag;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(van) || !/^\d{4}-\d{2}-\d{2}$/.test(tot)) return json({ error: "ongeldige datum" }, 400);

  const { data: kand, error: kErr } = await admin.rpc("facturatie_kandidaten", { _van: van, _tot: tot });
  if (kErr) return json({ error: kErr.message }, 500);
  const rijen = (kand ?? []) as any[];
  const sam = samenvatting(rijen);

  // Creditnota's bij opzegging: herbeoordelen en bedrag berekenen (alleen database, nooit Exact).
  await admin.rpc("herbeoordeel_opzeg_credits");
  const { data: creditRijen } = await admin.from("factuur_credit_planning").select("*").order("aangemaakt_op");
  const credits: any[] = [];
  for (const c of creditRijen ?? []) {
    if (c.bron === "oud_systeem" && c.status === "te_maken") {
      const { data: k } = await admin.from("klant_contracten").select("cyclus,aantal,bedrag_per_periode,begin_datum,factureren_vanaf,gefactureerd_tm").eq("id", c.klant_contract_id).single();
      const ber = berekenOudSysteemCredit(k as any, c.einddatum);
      if (Number(c.bedrag) !== ber.bedrag) await admin.from("factuur_credit_planning").update({ bedrag: ber.bedrag, berekening: ber }).eq("id", c.id);
      c.bedrag = ber.bedrag; c.berekening = ber; c._item = c.exact_item_id; c._gl = c.gl_code;
    } else if (c.status === "te_maken" && c.planning_ids?.length) {
      const { data: pl } = await admin.from("factuur_planning").select("periode_start,periode_eind,bedrag,exact_item_id,gl_code").in("id", c.planning_ids);
      const ber = berekenOpzegCredit(c.einddatum, (pl ?? []) as any[]);
      if (Number(c.bedrag) !== ber.bedrag) await admin.from("factuur_credit_planning").update({ bedrag: ber.bedrag, berekening: ber }).eq("id", c.id);
      c.bedrag = ber.bedrag; c.berekening = ber; c._item = pl?.[0]?.exact_item_id ?? null; c._gl = pl?.[0]?.gl_code ?? null;
    }
    credits.push(c);
  }
  const creditOverzicht = credits.map((c) => ({ id: c.id, sleutel: c.creditsleutel, status: c.status, melding: c.melding, bedrag: c.bedrag,
    origineel_factuurnummer: c.origineel_factuurnummer, credit_vanaf: c.credit_vanaf, credit_tm: c.credit_tm, is_test: c.is_test, klant_contract_id: c.klant_contract_id }));

  // Hoofdschakelaar: vers uit de database, in deze run.
  const { data: fcfg } = await admin.from("facturatie_config").select("*").eq("id", 1).maybeSingle();
  const live = actie === "dagrun" && fcfg?.facturatie_actief === true;
  // Creditnota's bij opzegging hebben een eigen schakelaar (Boy: los van facturatie_actief).
  const liveCredits = actie === "dagrun" && fcfg?.opzeg_credits_actief === true;

  if (!live && !liveCredits) {
    await admin.from("factuur_planner_runs").insert({
      modus: "proef", trigger_type: `${trigger}:${actie}`, aantal_kandidaten: rijen.length,
      aantal_geblokkeerd: sam.geblokkeerd.aantal, bedrag: sam.totaal.bedrag, detail: { van, tot, samenvatting: sam },
    });
    return json({ modus: "proef", schrijft_naar_exact: false, van, tot, samenvatting: sam, regels: actie === "proefrun" ? rijen : undefined, creditnotas: creditOverzicht });
  }

  // ── LIVE (alleen dagrun met schakelaar AAN) ─────────────────────────
  const { data: cfg } = await admin.from("exact_config").select("*").limit(1).maybeSingle();
  const baseUrl = cfg?.base_url || "https://start.exactonline.nl";
  const div = String(cfg?.divisie_code ?? "").trim();
  let aangemaakt = 0;
  const fouten: string[] = [];
  try {
    if (!cfg?.is_actief || !div) throw new Error("Exact niet actief");
    let token = await ensureValidToken(admin, cfg);
    const exact = async (pad: string, init: RequestInit = {}) => {
      const method = (init.method ?? "GET").toUpperCase();
      if (method !== "GET" && method !== "POST") throw new Error("methode niet toegestaan");
      if (method === "POST") {
        const { data: v } = await admin.from("facturatie_config").select("facturatie_actief,opzeg_credits_actief").eq("id", 1).single();
        const isCredit = String(init.body ?? "").includes('"Type":8021');
        if (isCredit ? v?.opzeg_credits_actief !== true : v?.facturatie_actief !== true) throw new Error("schakelaar uit: POST geweigerd");
      }
      let r = await fetch(`${baseUrl}/api/v1/${div}/${pad}`, { ...init, headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" } });
      if (r.status === 401) { token = await refreshAccessToken(admin, cfg); r = await fetch(`${baseUrl}/api/v1/${div}/${pad}`, { ...init, headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" } }); }
      return r;
    };
    const zoekOpSleutel = async (sleutel: string, veld: string) => {
      const r = await exact(`salesinvoice/SalesInvoices?$select=InvoiceID,InvoiceNumber,Status&$filter=${encodeURIComponent(veld === "YourRef" ? `YourRef eq '${sleutel}'` : `substringof('${sleutel}',Remarks) eq true`)}&$top=2`);
      if (!r.ok) throw new Error(`sleutelcontrole HTTP ${r.status}`);
      const d = (await r.json())?.d; return (d?.results ?? d ?? []) as any[];
    };
    const sleutelVeld = fcfg?.sleutel_veld === "YourRef" ? "YourRef" : "Remarks";

    // 1) Status open concepten bijwerken (alleen lezen).
    const { data: openPl } = await admin.from("factuur_planning").select("*").in("status", ["concept_aangemaakt", "te_laat", "geclaimd"]).eq("is_test", false);
    for (const p of (live ? openPl : []) ?? []) {
      const gevonden = p.exact_invoice_id
        ? await (async () => { const r = await exact(`salesinvoice/SalesInvoices?$select=InvoiceID,InvoiceNumber,Status,InvoiceDate&$filter=${encodeURIComponent(`InvoiceID eq guid'${p.exact_invoice_id}'`)}`); const d = (await r.json())?.d; return (d?.results ?? d ?? [])[0] ?? null; })()
        : (await zoekOpSleutel(p.planningssleutel, sleutelVeld))[0] ?? null;
      if (p.status === "geclaimd" && !gevonden) continue; // onzeker: nooit opnieuw POST'en zonder sleutelbewijs; blijft staan voor handmatige beoordeling
      const nieuw = planningStatusUitExact(gevonden?.Status, !!gevonden, String(p.concept_op ?? p.aangemaakt_op), vandaag, fcfg?.verwerk_termijn_werkdagen ?? 5);
      const upd: any = { laatst_gecontroleerd_op: new Date().toISOString(), exact_status: gevonden?.Status ?? null };
      if (gevonden) { upd.exact_invoice_id = gevonden.InvoiceID; upd.exact_invoice_number = gevonden.InvoiceNumber != null ? String(gevonden.InvoiceNumber) : null; }
      if (nieuw !== p.status) {
        upd.status = nieuw;
        if (nieuw === "verwerkt") upd.verwerkt_op = new Date().toISOString();
        await admin.from("factuur_planning_log").insert({ planning_id: p.id, klant_contract_id: p.klant_contract_id, actie: "status", oud: { status: p.status }, nieuw: { status: nieuw } });
        if (nieuw === "verwerkt") {
          const { data: k } = await admin.from("klant_contracten").select("gefactureerd_tm,volgende_factuurdatum").eq("id", p.klant_contract_id).single();
          const volgende = new Date(new Date(`${p.periode_eind}T00:00:00Z`).getTime() + 86400000).toISOString().slice(0, 10);
          if (!k?.gefactureerd_tm || k.gefactureerd_tm < p.periode_eind) {
            await admin.from("klant_contracten").update({ gefactureerd_tm: p.periode_eind, volgende_factuurdatum: volgende, gefactureerd_tm_bron: "planner" }).eq("id", p.klant_contract_id);
            await admin.from("sensitive_audit_log").insert({ target_table: "klant_contracten", target_id: p.klant_contract_id, actie: "planner_verwerkt", veld: "gefactureerd_tm", oude_waarde: k?.gefactureerd_tm ?? null, nieuwe_waarde: p.periode_eind, details: { planning_id: p.id } });
          }
        }
      }
      await admin.from("factuur_planning").update(upd).eq("id", p.id);
    }

    // 2) Nieuwe concepten voor niet-geblokkeerde kandidaten (incl. achterstallig).
    // Eerder geblokkeerde regels (bv. grootboek ontbrak) krijgen elke run een nieuwe kans; de oude rij blijft als 'vervangen' staan.
    if (live) await admin.from("factuur_planning").update({ status: "vervangen" }).eq("status", "geblokkeerd");
    const glVoor = async (code: string) => await getGlAccountIdVoorCode(admin, cfg, token, code);
    let gestopt = false;
    for (const k of live ? rijen.filter((r) => !r.blokkade && r.periode_start <= vandaag) : []) {
      const sleutel = planningsSleutel(crypto.randomUUID().replace(/-/g, ""));
      const { data: claim, error: cErr } = await admin.from("factuur_planning").insert({
        klant_contract_id: k.klant_contract_id, periode_start: k.periode_start, periode_eind: k.periode_eind,
        aantal: k.aantal, bedrag_per_periode: k.bedrag_per_periode, bedrag: k.bedrag,
        exact_account_id: k.exact_account_id, exact_item_id: k.exact_item_id, gl_code: k.gl_code,
        planningssleutel: sleutel, status: "geclaimd", invoice_date: k.periode_start,
      }).select("id").single();
      if (cErr) continue; // unieke sleutel: al geclaimd → overslaan
      // Vóór de POST: elke fout blokkeert alleen deze regel; de run gaat door.
      let payload: any;
      try {
        if ((await zoekOpSleutel(sleutel, sleutelVeld)).length) throw new Error("sleutel bestaat al in Exact");
        const gl = k.gl_code ? await glVoor(String(k.gl_code)) : null;
        payload = bouwFactuurPayload(k, gl, sleutel, sleutelVeld);
      } catch (e) {
        const status = e instanceof GlNietGevondenError ? "geblokkeerd" : "fout";
        await admin.from("factuur_planning").update({ status, foutmelding: String((e as Error)?.message ?? e).slice(0, 300) }).eq("id", claim.id);
        fouten.push(`${status}: ${String((e as Error)?.message ?? e).slice(0, 160)}`); continue;
      }
      let r: Response;
      try { r = await exact("salesinvoice/SalesInvoices", { method: "POST", body: JSON.stringify(payload) }); }
      catch (e) { fouten.push(`POST onzeker: ${String(e).slice(0, 160)}`); gestopt = true; break; } // rij blijft "geclaimd"
      if (!r.ok) {
        // Onzeker na 5xx: rij blijft "geclaimd"; volgende run beslist via sleutelcontrole. Run stopt.
        if (r.status >= 500) { fouten.push(`POST onzeker HTTP ${r.status}`); gestopt = true; break; }
        await admin.from("factuur_planning").update({ status: "fout", foutmelding: (await r.text()).slice(0, 300) }).eq("id", claim.id);
        fouten.push(`HTTP ${r.status}`); continue;
      }
      const d = (await r.json().catch(() => ({})))?.d ?? {};
      await admin.from("factuur_planning").update({ status: "concept_aangemaakt", concept_op: new Date().toISOString(), exact_invoice_id: d.InvoiceID ?? null, exact_status: 20 }).eq("id", claim.id);
      await admin.from("factuur_planning_log").insert({ planning_id: claim.id, klant_contract_id: k.klant_contract_id, actie: "concept_aangemaakt", nieuw: { invoice_id: d.InvoiceID, sleutel } });
      aangemaakt++;
    }

    if (gestopt) throw new Error("run gestopt na onzekere POST; geen creditnota's");
    // 3) Creditnota's: status bijwerken (lezen) en nieuwe concepten (Type 8021). Testrecords nooit naar Exact.
    for (const c of credits.filter((x) => ["concept_aangemaakt", "te_laat", "geclaimd"].includes(x.status) && !x.is_test)) {
      const gevonden = (await zoekOpSleutel(c.creditsleutel, "Remarks"))[0] ?? null;
      if (c.status === "geclaimd" && !gevonden) continue;
      const nieuw = planningStatusUitExact(gevonden?.Status, !!gevonden, String(c.concept_op ?? c.aangemaakt_op), vandaag, fcfg?.verwerk_termijn_werkdagen ?? 5);
      const upd: any = { laatst_gecontroleerd_op: new Date().toISOString(), exact_status: gevonden?.Status ?? null };
      if (gevonden) { upd.exact_invoice_id = gevonden.InvoiceID; upd.exact_invoice_number = gevonden.InvoiceNumber != null ? String(gevonden.InvoiceNumber) : null; }
      if (nieuw !== c.status) {
        upd.status = nieuw; if (nieuw === "verwerkt") upd.verwerkt_op = new Date().toISOString();
        await admin.from("sensitive_audit_log").insert({ target_table: "klant_contracten", target_id: c.klant_contract_id, actie: "creditnota_status", veld: "factuur_credit_planning.status", oude_waarde: c.status, nieuwe_waarde: nieuw, details: { credit_id: c.id } });
      }
      await admin.from("factuur_credit_planning").update(upd).eq("id", c.id);
    }
    for (const c of credits.filter((x) => x.status === "te_maken" && !x.is_test && Number(x.bedrag) > 0)) {
      const { data: claim } = await admin.from("factuur_credit_planning").update({ status: "geclaimd" }).eq("id", c.id).eq("status", "te_maken").select("id").maybeSingle();
      if (!claim) continue;
      const oud = c.bron === "oud_systeem";
      let gl: string | null = null;
      try {
        if ((await zoekOpSleutel(c.creditsleutel, "Remarks")).length) throw new Error("creditsleutel bestaat al in Exact");
        if (!c.exact_account_id || !c._item || (!oud && !c.origineel_factuurnummer)) throw new Error("creditnota mist account, artikel of factuurnummer");
        gl = c._gl ? await glVoor(String(c._gl)) : null;
      } catch (e) {
        // Alleen deze creditnota blokkeren; de rest gaat door.
        const status = e instanceof GlNietGevondenError ? "geblokkeerd" : "fout";
        const msg = String((e as Error)?.message ?? e).slice(0, 300);
        await admin.from("factuur_credit_planning").update(status === "geblokkeerd" ? { status, melding: msg } : { status, foutmelding: msg }).eq("id", c.id);
        fouten.push(`credit ${status}: ${msg.slice(0, 160)}`); continue;
      }
      try {
        if (oud) {
          const p = oudSysteemCreditPayload({ creditsleutel: c.creditsleutel, exact_account_id: c.exact_account_id, exact_item_id: c._item, gl_account_id: gl,
            einddatum: c.einddatum, credit_vanaf: c.credit_vanaf, credit_tm: c.credit_tm, vandaag, regels: c.berekening?.regels ?? [] });
          const r = await exact("salesinvoice/SalesInvoices", { method: "POST", body: JSON.stringify(p) });
          if (!r.ok) {
            if (r.status >= 500) throw new Error(`credit POST onzeker HTTP ${r.status}`);
            await admin.from("factuur_credit_planning").update({ status: "fout", foutmelding: (await r.text()).slice(0, 300) }).eq("id", c.id);
            fouten.push(`credit HTTP ${r.status}`); continue;
          }
          const d = (await r.json())?.d ?? {};
          await admin.from("factuur_credit_planning").update({ status: "concept_aangemaakt", concept_op: new Date().toISOString(), exact_invoice_id: d.InvoiceID ?? null, exact_status: 20 }).eq("id", c.id);
          await admin.from("sensitive_audit_log").insert({ target_table: "klant_contracten", target_id: c.klant_contract_id, actie: "creditnota_concept_aangemaakt", veld: "factuur_credit_planning", nieuwe_waarde: c.creditsleutel, details: { credit_id: c.id, bedrag: c.bedrag, bron: "oud_systeem", invoice_id: d.InvoiceID } });
          continue;
        }
        const regel: any = { Item: c._item, ...exactRegelBedrag(8021, Number(c.bedrag)), VATCode: "0",
          Description: regelOmschrijving("restitutie_opzegging", c.credit_vanaf, c.credit_tm),
          StartTime: `${c.credit_vanaf}T00:00:00`, EndTime: `${c.credit_tm}T00:00:00` };
        if (gl) regel.GLAccount = gl;
        const nu = `${vandaag}T00:00:00`;
        const payload: any = { InvoiceTo: c.exact_account_id, OrderedBy: c.exact_account_id, Journal: "70", PaymentCondition: "IN",
          Type: 8021, Status: 20, InvoiceDate: nu, OrderDate: nu, YourRef: c.origineel_factuurnummer, Remarks: c.creditsleutel,
          Description: `Creditnota bij factuur ${c.origineel_factuurnummer}`.slice(0, 60), SalesInvoiceLines: [regel] };
        const r = await exact("salesinvoice/SalesInvoices", { method: "POST", body: JSON.stringify(payload) });
        if (!r.ok) {
          if (r.status >= 500) throw new Error(`credit POST onzeker HTTP ${r.status}`);
          await admin.from("factuur_credit_planning").update({ status: "fout", foutmelding: (await r.text()).slice(0, 300) }).eq("id", c.id);
          fouten.push(`credit HTTP ${r.status}`); continue;
        }
        const d = (await r.json())?.d ?? {};
        await admin.from("factuur_credit_planning").update({ status: "concept_aangemaakt", concept_op: new Date().toISOString(), exact_invoice_id: d.InvoiceID ?? null, exact_status: 20 }).eq("id", c.id);
        await admin.from("sensitive_audit_log").insert({ target_table: "klant_contracten", target_id: c.klant_contract_id, actie: "creditnota_concept_aangemaakt", veld: "factuur_credit_planning", nieuwe_waarde: c.creditsleutel, details: { credit_id: c.id, bedrag: c.bedrag, origineel: c.origineel_factuurnummer, invoice_id: d.InvoiceID } });
      } catch (e) { fouten.push(String(e).slice(0, 200)); break; } // onzekere POST: stoppen, rij blijft "geclaimd"
    }
  } catch (e) { fouten.push(String(e).slice(0, 200)); }

  await admin.from("factuur_planner_runs").insert({ modus: "live", trigger_type: `${trigger}:${actie}`, aantal_kandidaten: rijen.length,
    aantal_geblokkeerd: sam.geblokkeerd.aantal, aantal_aangemaakt: aangemaakt, bedrag: sam.klaar.bedrag, status: fouten.length ? "fout" : "ok", detail: { fouten } });
  if (fouten.length) await sendExactAlarm(admin, ALARM, "factuur-planner", null);
  return json({ modus: "live", aangemaakt, fouten, creditnotas: creditOverzicht });
});

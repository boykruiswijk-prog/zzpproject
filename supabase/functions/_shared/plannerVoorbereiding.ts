// Shared calculation for real runs and effect-free previews. No Exact or mail access.
// deno-lint-ignore-file no-explicit-any
import { berekenCreditVoorPlanner, berekenOudSysteemCredit, berekenOpzegCredit, heeftVastCreditBedrag } from "./creditOpzegging.ts";
import { controleerExactFactuurPayload } from "./exactFactuurVelden.ts";
import { bouwFactuurPayload, btwCode, glUitCache, controleerBtw } from "./factuurRegel.ts";
import { oudSysteemCreditPayload, plannerCreditPayload, kiesCreditRoute, losseCreditPayload } from "./creditOpzegging.ts";

export async function bereidPlannerCredits(admin: any, opslaan: boolean): Promise<any[]> {
  const { data, error } = await admin.from("factuur_credit_planning").select("*").order("aangemaakt_op");
  if (error) throw new Error(error.message);
  const credits: any[] = [];
  for (const rij of data ?? []) {
    const c = { ...rij };
    let ber: { bedrag: number; berekening: any } | undefined;
    if (c.bron === "oud_systeem" && c.status === "te_maken") {
      const { data: k, error } = await admin.from("klant_contracten").select("cyclus,aantal,bedrag_per_periode,begin_datum,factureren_vanaf,gefactureerd_tm,itemcode").eq("id", c.klant_contract_id).single();
      if (error) throw new Error(error.message);
      ber = berekenCreditVoorPlanner(c, () => berekenOudSysteemCredit(k, c.einddatum));
      const { data: m, error: mappingError } = await admin.rpc("factuur_mapping_voor", { _itemcode: k?.itemcode });
      if (mappingError) throw new Error(mappingError.message);
      c._item = c.exact_item_id; c._gl = c.gl_code; c._btw = btwCode(m?.btw_code);
    } else if (c.status === "te_maken" && c.planning_ids?.length) {
      const { data: pl, error } = await admin.from("factuur_planning").select("periode_start,periode_eind,bedrag,exact_item_id,gl_code,btw_code").in("id", c.planning_ids);
      if (error) throw new Error(error.message);
      ber = berekenCreditVoorPlanner(c, () => berekenOpzegCredit(c.einddatum, pl ?? []));
      c._item = c.exact_item_id ?? pl?.[0]?.exact_item_id ?? null; c._gl = c.gl_code ?? pl?.[0]?.gl_code ?? null;
      const codes = [...new Set((pl ?? []).map((x: any) => btwCode(x.btw_code)))];
      c._btw = codes.length === 1 ? codes[0] : null;
    } else if (c.status === "te_maken") {
      // Correctie zonder plannerfactuur (oorspronkelijk in AFAS): artikel en btw van het contract.
      const { data: k, error } = await admin.from("klant_contracten").select("itemcode").eq("id", c.klant_contract_id).maybeSingle();
      if (error) throw new Error(error.message);
      const { data: m, error: mappingError } = await admin.rpc("factuur_mapping_voor", { _itemcode: k?.itemcode ?? null });
      if (mappingError) throw new Error(mappingError.message);
      c._item = c.exact_item_id ?? m?.exact_item_id ?? null; c._gl = c.gl_code ?? m?.gl_code ?? null; c._btw = m ? btwCode(m.btw_code) : null;
    }
    if (ber) {
      if (opslaan && !heeftVastCreditBedrag(c) && Number(c.bedrag) !== ber.bedrag) {
        const { error } = await admin.from("factuur_credit_planning").update({ bedrag: ber.bedrag, berekening: ber.berekening }).eq("id", c.id);
        if (error) throw new Error(error.message);
      }
      c.bedrag = ber.bedrag; c.berekening = ber.berekening;
    }
    credits.push(c);
  }
  return credits;
}

export function heeftPlannerWerk(rijen: any[], credits: any[], live: boolean, liveCredits: boolean, vandaag: string): boolean {
  return (live && rijen.some((r) => !r.blokkade && r.periode_start <= vandaag)) ||
    (liveCredits && credits.some((c) => c.status === "te_maken" && !c.is_test && Number(c.bedrag) > 0));
}

export function plannerDroogRapport(rijen: any[], credits: any[], cfg: any, fcfg: any, vandaag: string) {
  const veld = fcfg?.sleutel_veld === "YourRef" ? "YourRef" : "Remarks";
  const facturen = rijen.map((r) => {
    // A real invoice key is generated only on claim; the preview identifies the contract-period instead.
    const sleutel = `${r.klant_contract_id}:${r.periode_start}`;
    let blokkade = r.blokkade ?? null; let payload = null;
    try { payload = bouwFactuurPayload(r, glUitCache(cfg, String(r.gl_code)), "ZPF-DRYRUN0", veld); }
    catch (e) { blokkade ??= String((e as Error).message); }
    return { sleutel, klant_contract_id: r.klant_contract_id, periode_start: r.periode_start, periode_eind: r.periode_eind, bedrag: Number(r.bedrag), blokkade, payload,
      zou_aanmaken: !blokkade && r.periode_start <= vandaag && fcfg?.facturatie_actief === true };
  });
  const creditnotas = credits.filter((c) => !c.is_test).map((c) => {
    let blokkade = c.status !== "te_maken" ? c.status : Number(c.bedrag) <= 0 ? "bedrag nul of negatief" : null;
    let payload = null;
    if (!blokkade) {
      try {
        const keuze = kiesCreditRoute(c);
        if (keuze.route === "ontbreekt") throw new Error(`creditnota mist ${keuze.ontbreekt.join(", ")}`);
        if (!c._btw) throw new Error("BTW-code ontbreekt");
        controleerBtw(c._gl, c._btw);
        const gl = glUitCache(cfg, String(c._gl));
        payload = keuze.route === "oud" ? oudSysteemCreditPayload({ ...c, exact_item_id: c._item, gl_account_id: gl, btw_code: c._btw, vandaag, regels: c.berekening?.regels ?? [] }) :
          keuze.route === "los" ? losseCreditPayload({ ...c, item: c._item, btw: c._btw, gl, bedrag: Number(c.bedrag), vandaag }) :
          plannerCreditPayload({ ...c, item: c._item, btw: c._btw, gl, bedrag: Number(c.bedrag), vandaag });
        controleerExactFactuurPayload(payload);
      } catch (e) { blokkade = String((e as Error).message); }
    }
    return { sleutel: c.creditsleutel, bedrag: Number(c.bedrag), berekening: c.berekening, bron: c.bron, status: c.status, blokkade, payload,
      zou_aanmaken: !blokkade && fcfg?.opzeg_credits_actief === true };
  });
  const som = (items: { bedrag: number }[]) => Math.round(items.reduce((s, r) => s + r.bedrag, 0) * 100) / 100;
  const klaarF = facturen.filter((r) => r.zou_aanmaken); const klaarC = creditnotas.filter((r) => r.zou_aanmaken);
  return { modus: "dryrun", schrijft_naar_exact: false, schrijft_naar_database: false, verstuurt_mails: false,
    samenvatting: { facturen: klaarF.length, factuurbedrag: som(klaarF), credits: klaarC.length, creditbedrag: som(klaarC), factuurregels: facturen.length, creditregels: creditnotas.length },
    facturen, creditnotas,
    beperkingen: "Momentopname van opgeslagen kandidaten en creditstatussen. Geen herbeoordeling, Exact-sleutel/statuscontrole of tokenrefresh; ontbrekend grootboek wordt live via de bestaande planner opgezocht. Werk wordt live in begrensde batches uitgevoerd." };
}
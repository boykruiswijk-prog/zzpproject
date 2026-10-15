// @vitest-environment node
// D7: eerste factuur op de ingangsdatum via de factuur-planner.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { eersteFactuurViaPlanner, plannerDatumsOpIngang, eersteFactuurLogTekst } from "../../supabase/functions/_shared/eersteFactuur";
import { eersteMaandPeriode, zetInPlanner } from "../../supabase/functions/_shared/klantContractActivatie";

function nepSupabase() {
  const contracten: any[] = [];
  const api: any = {
    select: () => api, eq: () => api, limit: () => api,
    maybeSingle: async () => ({ data: { id: "ond-1" } }),
    upsert: async (row: any) => { contracten.push(row); return { error: null }; },
  };
  return { from: () => api, contracten };
}
const lead = { id: "22222222-2222-2222-2222-222222222222", is_test: true, gekozen_pakket: "maandelijks", ingangsdatum: "2026-12-01" };
const VANDAAG = "2026-10-14";

describe("eerste factuur op ingangsdatum (D7)", () => {
  it("toekomst -> planner, vandaag of eerder -> oude flow", () => {
    expect(eersteFactuurViaPlanner("2026-12-01", VANDAAG)).toBe(true);
    expect(eersteFactuurViaPlanner("2026-10-14", VANDAAG)).toBe(false);
    expect(eersteFactuurViaPlanner("2026-10-01", VANDAAG)).toBe(false);
    expect(plannerDatumsOpIngang("2026-12-01")).toEqual({ factureren_vanaf: "2026-12-01", gefactureerd_tm: "2026-11-30", volgende_factuurdatum: "2026-12-01" });
    expect(eersteFactuurLogTekst("2026-12-01")).toBe("Eerste factuur gepland op ingangsdatum 01-12-2026 (D7)");
  });
  it("maand: planner krijgt ingang-1 als gefactureerd_tm", async () => {
    const sb = nepSupabase(); const p = eersteMaandPeriode(lead.ingangsdatum);
    await zetInPlanner(sb, lead, "acc", { cyclus: "maand", itemcode: "100M", bedrag_per_periode: 55, periodeStart: p.start, periodeEind: p.eind }, true);
    expect(sb.contracten[0]).toMatchObject({ factureren_vanaf: "2026-12-01", gefactureerd_tm: "2026-11-30", volgende_factuurdatum: "2026-12-01", bedrag_per_periode: 55 });
  });
  it("jaar: zelfde datums, oude flow (opIngang=false) ongewijzigd", async () => {
    const sb = nepSupabase(); const l = { ...lead, gekozen_pakket: "jaarlijks" };
    await zetInPlanner(sb, l, "acc", { cyclus: "jaar", itemcode: "100J", bedrag_per_periode: 600, periodeStart: "2026-12-01", periodeEind: "2027-11-30" }, true);
    expect(sb.contracten[0]).toMatchObject({ gefactureerd_tm: "2026-11-30", volgende_factuurdatum: "2026-12-01" });
    const sb2 = nepSupabase();
    await zetInPlanner(sb2, l, "acc", { cyclus: "jaar", itemcode: "100J", bedrag_per_periode: 600, periodeStart: "2026-12-01", periodeEind: "2027-11-30" });
    expect(sb2.contracten[0]).toMatchObject({ gefactureerd_tm: "2027-11-30", volgende_factuurdatum: "2027-12-01" });
  });
  it("cyber-contractregel ook op ingangsdatum", async () => {
    const sb = nepSupabase();
    const l = { ...lead, gekozen_pakket: "maandelijks-cyber", cyber_voorwaarden_versie: "2026-10-08", cyber_ingangsdatum: "2026-12-01", cyber_einddatum: "2027-11-30" };
    const p = eersteMaandPeriode(l.ingangsdatum);
    await zetInPlanner(sb, l, "acc", { cyclus: "maand", itemcode: "100M", bedrag_per_periode: 55, periodeStart: p.start, periodeEind: p.eind }, true);
    expect(sb.contracten[1]).toMatchObject({ product: "cyber_clear", gefactureerd_tm: "2026-11-30", volgende_factuurdatum: "2026-12-01" });
  });
  it("activatie maakt bij toekomstige ingang geen factuur; planner factureert alleen periode_start <= vandaag", () => {
    const a = readFileSync("supabase/functions/lead-to-exact-activate/index.ts", "utf8");
    expect(a).toContain("} else if (eersteFactuurViaPlanner(lead.ingangsdatum, vandaagAmsterdam())) {");
    expect(a).toContain("zetInPlanner(supabase, lead, exactAccountId, ps, true)");
    const p = readFileSync("supabase/functions/factuur-planner/index.ts", "utf8");
    expect(p).toContain("r.periode_start <= vandaag");
    expect(p).toContain("invoice_date: k.periode_start");
  });
});

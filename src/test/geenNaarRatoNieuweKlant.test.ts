// @vitest-environment node
// D1 aangevuld (Boy 13 okt 2026): nieuwe klanten betalen vanaf de ingangsdatum per hele maand of jaar.
import { describe, it, expect } from "vitest";
import { eersteMaandPeriode, zetInPlanner } from "../../supabase/functions/_shared/klantContractActivatie";
import { calcPolisEinddatum } from "../../supabase/functions/_shared/polisProRata";
import { maandprijsVoorLead } from "../../supabase/functions/_shared/starterActivatie";
import { periodeStart, periodeEind } from "../../supabase/functions/_shared/factuurPeriode";

function nepSupabase() {
  const contracten: any[] = [];
  const api: any = {
    select: () => api, eq: () => api, limit: () => api,
    maybeSingle: async () => ({ data: { id: "ond-1" } }),
    upsert: async (row: any) => { contracten.push(row); return { error: null }; },
  };
  return { from: () => api, contracten };
}
const lead = { id: "11111111-1111-1111-1111-111111111111", is_test: true, gekozen_pakket: "maandelijks", ingangsdatum: "2026-10-13" };

describe("eerste periode vanaf ingangsdatum, geen naar rato", () => {
  it("ingang 13-10 maand: 13-10 t/m 12-11 voor 55, daarna 13-11", async () => {
    expect(eersteMaandPeriode("2026-10-13")).toEqual({ start: "2026-10-13", eind: "2026-11-12" });
    expect(maandprijsVoorLead(lead, 55)).toBe(55);
    const sb = nepSupabase();
    const p = eersteMaandPeriode(lead.ingangsdatum);
    await zetInPlanner(sb, lead, "acc", { cyclus: "maand", itemcode: "100M", bedrag_per_periode: 55, periodeStart: p.start, periodeEind: p.eind });
    expect(sb.contracten[0]).toMatchObject({ begin_datum: "2026-10-13", gefactureerd_tm: "2026-11-12", volgende_factuurdatum: "2026-11-13" });
    expect(periodeEind("2026-11-13", "maand")).toBe("2026-12-12");
  });

  it("ingang 31-01 maand: eind 27-02 (28-02 in schrikkeljaar), zelfde regel als factuur_periode_eind", () => {
    expect(eersteMaandPeriode("2027-01-31")).toEqual({ start: "2027-01-31", eind: "2027-02-27" });
    expect(eersteMaandPeriode("2028-01-31").eind).toBe("2028-02-28");
    // Vastgelegd gedrag: de volgende periode begint dan op 28-02 en loopt t/m 27-03.
    expect(periodeStart("2027-01-31", "maand", 1)).toBe("2027-02-28");
    expect(periodeEind("2027-02-28", "maand")).toBe("2027-03-27");
  });

  it("jaar: 13-10-2026 t/m 12-10-2027", () => {
    expect(calcPolisEinddatum("2026-10-13")).toBe("2027-10-12");
    expect(periodeEind("2026-10-13", "jaar")).toBe("2027-10-12");
  });

  it("starter maand: volle maand tegen de starterprijs", () => {
    const s = { ...lead, tarief_type: "starter", starter_controle_status: "goedgekeurd" };
    expect(maandprijsVoorLead(s, 55)).toBe(45);
    expect(eersteMaandPeriode(s.ingangsdatum).eind).toBe("2026-11-12");
  });

  it("cyber maand: zelfde anker, 13-10 t/m 12-11, volgende 13-11", async () => {
    const sb = nepSupabase();
    const l = { ...lead, gekozen_pakket: "maandelijks-cyber", cyber_voorwaarden_versie: "2026-10-08", cyber_ingangsdatum: "2026-10-13", cyber_einddatum: "2027-10-12" };
    const p = eersteMaandPeriode(l.ingangsdatum);
    await zetInPlanner(sb, l, "acc", { cyclus: "maand", itemcode: "100M", bedrag_per_periode: 55, periodeStart: p.start, periodeEind: p.eind });
    expect(sb.contracten[1]).toMatchObject({ product: "cyber_clear", bedrag_per_periode: 27.5, gefactureerd_tm: "2026-11-12", volgende_factuurdatum: "2026-11-13" });
  });
});

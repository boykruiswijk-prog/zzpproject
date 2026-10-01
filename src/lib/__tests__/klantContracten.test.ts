import { describe, it, expect } from "vitest";
import { facturatieAgenda, maandwaarde, productVoorItemcode, type ContractRegel } from "../klantContracten";

const c = (o: Partial<ContractRegel>): ContractRegel => ({
  id: "x", onderneming_id: "o", cyclus: "maand", aantal: 1, bedrag_per_periode: 55,
  volgende_factuurdatum: "2026-10-17", eind_datum: null, status: "actief", product: "bav_avb", ...o,
});

describe("productmapping", () => {
  it("koppelt alle bekende codes", () => {
    for (const code of ["100M", "100J", "100J495", "100HDI", "100-OUD", "100-OUDJ540", "100-OUDM55"]) expect(productVoorItemcode(code)).toBe("bav_avb");
    expect(productVoorItemcode("102J")).toBe("cyber_clear");
    expect(productVoorItemcode("102-OUD")).toBe("cyber_clear");
    expect(productVoorItemcode("450")).toBe("lidmaatschap_allin");
    expect(productVoorItemcode("400")).toBe("lidmaatschap_startup");
    expect(productVoorItemcode("425")).toBe("lidmaatschap_light");
    expect(productVoorItemcode("Nimble")).toBe("nimble_bav");
  });
  it("raadt niet bij onbekende code", () => {
    expect(productVoorItemcode("999X")).toBe("onbekend");
    expect(productVoorItemcode("TESTAB01")).toBe("onbekend");
  });
});

describe("maandwaarde", () => {
  it("deelt jaar door 12 en vermenigvuldigt met aantal", () => {
    expect(maandwaarde(c({ cyclus: "jaar", bedrag_per_periode: 600, aantal: 2 }))).toBe(100);
    expect(maandwaarde(c({ aantal: 2 }))).toBe(110);
  });
});

describe("facturatieAgenda", () => {
  const vanaf = new Date(Date.UTC(2026, 9, 1));
  it("maandcontract elke maand, jaarcontract één keer", () => {
    const a = facturatieAgenda([c({}), c({ id: "j", cyclus: "jaar", bedrag_per_periode: 600, volgende_factuurdatum: "2027-02-01" })], vanaf);
    expect(a).toHaveLength(12);
    expect(a.every((m) => m.maandAantal === 1 && m.maandBedrag === 55)).toBe(true);
    expect(a.reduce((s, m) => s + m.jaarAantal, 0)).toBe(1);
    expect(a.find((m) => m.maand === "2027-02")?.jaarBedrag).toBe(600);
  });
  it("telt achterlopende periodes niet vóór de start, en stopt na einddatum", () => {
    const a = facturatieAgenda([c({ volgende_factuurdatum: "2026-07-17", eind_datum: "2026-12-31" })], vanaf);
    expect(a.filter((m) => m.maandAantal).map((m) => m.maand)).toEqual(["2026-10", "2026-11", "2026-12"]);
  });
  it("negeert vervangen regels", () => {
    expect(facturatieAgenda([c({ status: "vervangen" })], vanaf).every((m) => m.maandAantal === 0)).toBe(true);
  });
});

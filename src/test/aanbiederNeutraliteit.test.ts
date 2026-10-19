// @vitest-environment node
import { describe, expect, it } from "vitest";
import { bavVergelijking } from "../data/bavVergelijking";
import { getPakket } from "../data/bavPakketten";

describe("F1 vaste vergelijking en ongewijzigde marktgegevens", () => {
  it("houdt acht externe aanbieders in de vaste volgorde A tot H", () => {
    expect(bavVergelijking.filter(a => !a.eigen).map(a => a.aanbieder)).toEqual([
      "Aanbieder A", "Aanbieder B", "Aanbieder C", "Aanbieder D",
      "Aanbieder E", "Aanbieder F", "Aanbieder G", "Aanbieder H",
    ]);
    expect(bavVergelijking.filter(a => a.eigen)).toHaveLength(1);
    expect(bavVergelijking[0].aanbieder).toBe("ZP Zaken");
  });

  it("behoudt standdatum en bestaande marktprijzen", () => {
    expect(bavVergelijking.every(a => a.gecontroleerd_op === "2026-10-05")).toBe(true);
    expect(bavVergelijking[1].vanafPrijs).toContain("€ 35,30");
    expect(bavVergelijking[2].vanafPrijs).toContain("€ 27,22");
    expect(bavVergelijking[3].vanafPrijs).toContain("€ 38,56");
    expect(bavVergelijking[4].vanafPrijs).toContain("€ 29,17");
    expect(bavVergelijking[6].vanafPrijs).toContain("€ 375");
    expect(getPakket("maandelijks").prijs).toBe(55);
    expect(getPakket("jaarlijks").prijs).toBe(600);
  });
});
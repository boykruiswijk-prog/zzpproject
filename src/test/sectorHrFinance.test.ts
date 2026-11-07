import { describe, expect, it } from "vitest";
import { WIZARD_SECTOREN, verzekeringskaartVoorSector, isHandmatigeAcceptatieSector } from "@/data/sectorVerzekeringskaart";
import { branches } from "@/data/documentenLijst";
import { brancheVoorSector } from "@/data/sectorBranche";
import { aanvraagPremie, beoordeelCyber } from "../../supabase/functions/_shared/cyber";
import { vereistHandmatigeAcceptatie, controleerHandmatigeAcceptatie } from "../../supabase/functions/_shared/sectorRegels";
import { bouwZekerKennis } from "@/lib/zeker/bouwKennis";

describe("register D: HR en Finance als Management consultancy", () => {
  it("plaatst de twee aparte sectorlabels direct onder Management consultancy", () => {
    const index = WIZARD_SECTOREN.findIndex(s => s.id === "management-consultancy");
    expect(index).toBeGreaterThanOrEqual(0);
    expect(WIZARD_SECTOREN.slice(index + 1, index + 3).map(s => [s.id, s.label]))
      .toEqual([["hr", "HR"], ["finance", "Finance"]]);
  });

  it.each([["hr", "HR"], ["finance", "Finance"]])("%s bewaart eigen label met dezelfde hoedanigheid en voorwaarden", (id, label) => {
    const keuze = verzekeringskaartVoorSector(id);
    const management = verzekeringskaartVoorSector("management-consultancy");
    expect(keuze?.sector.label).toBe(label);
    expect(keuze?.sector.branche).toBe("management-consultancy");
    expect(keuze?.brancheNaam).toBe("Management consultancy");
    expect(keuze?.productCode).toBe("MCPH-2013B");
    expect(keuze?.path).toBe(management?.path);
    const documenten = branches.find(b => b.id === keuze?.sector.branche)?.documenten;
    expect(documenten?.find(d => d.type === "polisvoorwaarden")?.path)
      .toBe("/documenten/Polisvoorwaarden-beroepsaansprakelijkheid-MCPH-2013B.pdf");
    expect(documenten).toEqual(branches.find(b => b.id === management?.sector.branche)?.documenten);
    expect(brancheVoorSector(label)).toBe("Management consultancy");
    expect(brancheVoorSector(label)).toBe(brancheVoorSector("Management consultancy"));
  });

  it.each(["HR", "Finance"])("%s houdt dezelfde acceptatie, ook bij cyber", sector => {
    expect(isHandmatigeAcceptatieSector(sector)).toBe(false);
    expect(vereistHandmatigeAcceptatie({ sector, extra_data: { sector } })).toBe(false);
    expect(controleerHandmatigeAcceptatie({ sector }, {})).toEqual({ ok: true, gemarkeerd: false });
    const antwoorden = { a: false, b: true, c: true, d: true, e: false, f: false, sector };
    expect(beoordeelCyber(antwoorden).toegestaan).toBe(true);
    expect(beoordeelCyber({ ...antwoorden, a: true }).toegestaan).toBe(false);
  });

  it.each([
    ["maandelijks", false, 55], ["jaarlijks", false, 600],
    ["maandelijks-cyber", false, 82.5], ["jaarlijks-cyber", false, 850],
    ["maandelijks", true, 45], ["jaarlijks", true, 495],
    ["maandelijks-cyber", true, 72.5], ["jaarlijks-cyber", true, 745],
  ] as const)("%s starter=%s blijft voor alle drie sectoren %s", (pakket, starter, totaal) => {
    // De bestaande premiecalculator gebruikt alleen pakket en starterstatus.
    // De echte intake bewaart sector apart en normaliseert branche vóór verdere verwerking.
    for (const id of ["management-consultancy", "hr", "finance"]) {
      const sector = verzekeringskaartVoorSector(id)?.sector.label;
      expect(brancheVoorSector(sector)).toBe("Management consultancy");
      const premie = aanvraagPremie(pakket, starter);
      expect(premie.totaal).toBe(totaal);
      expect(premie).toEqual(aanvraagPremie(pakket, starter));
    }
  });

  it("geeft Zeker beide labels met dezelfde verzekeringskaart", () => {
    const sectoren = bouwZekerKennis().sectoren;
    const management = sectoren.find(s => s.id === "management-consultancy");
    for (const [id, label] of [["hr", "HR"], ["finance", "Finance"]]) {
      expect(sectoren.find(s => s.id === id)).toEqual({ id, label, verzekeringskaart: management?.verzekeringskaart });
    }
  });
});
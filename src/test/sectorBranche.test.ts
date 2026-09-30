import { describe, expect, it } from "vitest";
import { ADMIN_BRANCHES, brancheVoorSector } from "@/data/sectorBranche";

describe("sector → adminbranche", () => {
  it.each([
    ["ICT", "IT & ICT"],
    ["Management consultancy", "Management consultancy"],
    ["Reclame- & marketingbureaus", "PR & Marketing"],
    ["Coaches", "Coaches"],
    ["Zakelijke dienstverlening", "Zakelijke dienstverlening"],
    ["Zorg", "Zakelijke dienstverlening"],
    ["Bouw & techniek", "Zakelijke dienstverlening"],
    ["Overig", "Zakelijke dienstverlening"],
  ])("koppelt %s aan %s", (sector, branche) => {
    expect(brancheVoorSector(sector)).toBe(branche);
    expect(ADMIN_BRANCHES).toContain(branche);
  });

  it("weigert een ontbrekende of onbekende sector", () => {
    expect(brancheVoorSector("")).toBeNull();
    expect(brancheVoorSector("Onbekend")).toBeNull();
  });
});
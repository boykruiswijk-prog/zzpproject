import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { WIZARD_SECTOREN } from "@/data/sectorVerzekeringskaart";
import { ADMIN_BRANCHES, brancheVoorSector } from "@/data/sectorBranche";

const bron = readFileSync(resolve(__dirname, "../pages/OffertePage.tsx"), "utf8");

describe("offerteformulier sectoren", () => {
  it("gebruikt WIZARD_SECTOREN als enige bron", () => {
    expect(bron).toMatch(/import \{ WIZARD_SECTOREN \} from "@\/data\/sectorVerzekeringskaart"/);
    expect(bron).toMatch(
      /const BRANCHES = WIZARD_SECTOREN\.map\(\(s\) => \(\{ value: s\.id, label: s\.label \}\)\);/,
    );
    // Geen eigen lijst met labels tussen haakjes meer.
    expect(bron).not.toMatch(/Niet-uitvoerende beroepen|\(IT & ICT\)|value: "anders"/);
  });

  it("heeft dezelfde ids en labels in dezelfde volgorde als de wizard", () => {
    const lijst = WIZARD_SECTOREN.map((s) => ({ value: s.id, label: s.label }));
    expect(lijst).toEqual([
      { value: "ict", label: "ICT" },
      { value: "management-consultancy", label: "Management consultancy" },
      { value: "pr-marketing", label: "Reclame- & marketingbureaus" },
      { value: "coaches", label: "Coaches" },
      { value: "zakelijke-dienstverlening", label: "Zakelijke dienstverlening" },
      { value: "zorg", label: "Zorg" },
      { value: "bouw", label: "Bouw & techniek" },
      { value: "overig", label: "Overig" },
    ]);
  });

  it("levert voor elk label een bestaande adminbranche", () => {
    for (const s of WIZARD_SECTOREN) {
      const branche = brancheVoorSector(s.label);
      expect(branche, s.label).not.toBeNull();
      expect(ADMIN_BRANCHES).toContain(branche!);
    }
  });

  it("markeert alleen 'overig' als handmatige beoordeling", () => {
    expect(bron).toMatch(/form\.branche === "overig" \|\| form\.aantal_medewerkers === "Meer dan 3"/);
  });
});

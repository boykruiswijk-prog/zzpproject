import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { WIZARD_SECTOREN, isAlleenOfferteSector } from "@/data/sectorVerzekeringskaart";
import { ALLEEN_OFFERTE_SECTOREN, bodyIsAlleenOfferte, isAlleenOfferteSector as backendIsAlleenOfferte } from "../../supabase/functions/_shared/sectorRegels";
import { ADMIN_BRANCHES, brancheVoorSector } from "@/data/sectorBranche";

const bron = readFileSync(resolve(__dirname, "../pages/OffertePage.tsx"), "utf8");

describe("offerteformulier sectoren", () => {
  it("gebruikt WIZARD_SECTOREN als enige bron", () => {
    expect(bron).toMatch(/import \{ WIZARD_SECTOREN, isAlleenOfferteSector \} from "@\/data\/sectorVerzekeringskaart"/);
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

  it("beoordeelt overig, zorg en bouw handmatig", () => {
    expect(bron).toMatch(/vereistHandmatig\(form\.branche\) \|\| form\.aantal_medewerkers === "Meer dan 3"/);
    expect(bron).toMatch(/id === "overig" \|\| isAlleenOfferteSector\(id\)/);
  });
});

describe("alleen-offerte sectoren", () => {
  it("herkent zorg en bouw op id en label, niet de andere 6", () => {
    for (const v of ["zorg", "bouw", "Zorg", "Bouw & techniek"]) {
      expect(isAlleenOfferteSector(v), v).toBe(true);
      expect(backendIsAlleenOfferte(v), v).toBe(true);
    }
    for (const s of WIZARD_SECTOREN.filter((s) => s.id !== "zorg" && s.id !== "bouw")) {
      expect(isAlleenOfferteSector(s.id)).toBe(false);
      expect(isAlleenOfferteSector(s.label)).toBe(false);
      expect(backendIsAlleenOfferte(s.label)).toBe(false);
    }
    expect(WIZARD_SECTOREN.filter((s) => !s.alleenOfferte)).toHaveLength(6);
  });

  it("frontend- en backendlijst zijn gelijk", () => {
    const fe = WIZARD_SECTOREN.filter((s) => s.alleenOfferte).map((s) => ({ id: s.id, label: s.label }));
    expect(fe).toEqual([...ALLEEN_OFFERTE_SECTOREN]);
  });
});

describe("process-bav-wizard vangnet", () => {
  const wizardBody = (sectorId: string) => ({
    gekozen_pakket: "combi", betaalwijze: "jaarlijks", ingangsdatum: "2026-10-01",
    voornaam: "Test", achternaam: "Klant", email: "test@zpzaken.nl", bedrijfsnaam: "Test BV",
    beroep: "Verpleegkundige",
    // Exact zoals BAVApplicationModule het opbouwt: het label.
    sector: WIZARD_SECTOREN.find((s) => s.id === sectorId)?.label ?? null,
  });
  it("weigert Zorg en Bouw & techniek zoals de wizard ze verstuurt", () => {
    expect(bodyIsAlleenOfferte(wizardBody("zorg"))).toBe(true);
    expect(bodyIsAlleenOfferte(wizardBody("bouw"))).toBe(true);
    expect(bodyIsAlleenOfferte({ extra_data: { sector: "zorg" } })).toBe(true);
  });
  it("laat de andere sectoren door", () => {
    for (const s of WIZARD_SECTOREN.filter((s) => !s.alleenOfferte)) expect(bodyIsAlleenOfferte(wizardBody(s.id))).toBe(false);
  });
});

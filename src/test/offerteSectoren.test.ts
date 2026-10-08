import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { WIZARD_SECTOREN, isHandmatigeAcceptatieSector as isAlleenOfferteSector } from "@/data/sectorVerzekeringskaart";
import { HANDMATIGE_ACCEPTATIE_SECTOREN as ALLEEN_OFFERTE_SECTOREN, vereistHandmatigeAcceptatie as bodyIsAlleenOfferte, isHandmatigeAcceptatieSector as backendIsAlleenOfferte, controleerHandmatigeAcceptatie } from "../../supabase/functions/_shared/sectorRegels";
import { ADMIN_BRANCHES, brancheVoorSector } from "@/data/sectorBranche";
import { zichtbareBavUsps } from "@/components/home/BAVApplicationModule";
import nl from "@/i18n/locales/nl.json";
import en from "@/i18n/locales/en.json";
import de from "@/i18n/locales/de.json";
import fr from "@/i18n/locales/fr.json";

const bron = readFileSync(resolve(__dirname, "../pages/OffertePage.tsx"), "utf8");

describe("offerteformulier sectoren", () => {
  it("gebruikt WIZARD_SECTOREN als enige bron", () => {
    expect(bron).toMatch(/import \{ WIZARD_SECTOREN, isHandmatigeAcceptatieSector \} from "@\/data\/sectorVerzekeringskaart"/);
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
    expect(bron).toMatch(/id === "overig" \|\| isHandmatigeAcceptatieSector\(id\)/);
  });
});

describe("handmatige-acceptatie sectoren", () => {
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
    expect(WIZARD_SECTOREN.filter((s) => !s.handmatigeAcceptatie)).toHaveLength(6);
  });

  it("frontend- en backendlijst zijn gelijk", () => {
    const fe = WIZARD_SECTOREN.filter((s) => s.handmatigeAcceptatie).map((s) => ({ id: s.id, label: s.label }));
    expect(fe).toEqual([...ALLEEN_OFFERTE_SECTOREN]);
  });
});

describe("process-bav-wizard markering", () => {
  const wizardBody = (sectorId: string) => ({
    gekozen_pakket: "combi", betaalwijze: "jaarlijks", ingangsdatum: "2026-10-01",
    voornaam: "Test", achternaam: "Klant", email: "test@zpzaken.nl", bedrijfsnaam: "Test BV",
    beroep: "Verpleegkundige",
    // Exact zoals BAVApplicationModule het opbouwt: het label.
    sector: WIZARD_SECTOREN.find((s) => s.id === sectorId)?.label ?? null,
  });
  it("markeert Zorg en Bouw & techniek zoals de wizard ze verstuurt", () => {
    expect(bodyIsAlleenOfferte(wizardBody("zorg"))).toBe(true);
    expect(bodyIsAlleenOfferte(wizardBody("bouw"))).toBe(true);
    expect(bodyIsAlleenOfferte({ extra_data: { sector: "zorg" } })).toBe(true);
  });
  it("markeert de andere sectoren niet", () => {
    for (const s of WIZARD_SECTOREN.filter((s) => !s.handmatigeAcceptatie)) expect(bodyIsAlleenOfferte(wizardBody(s.id))).toBe(false);
  });
});

describe("afsluitwizard zonder blokkade", () => {
  const wizard = readFileSync(resolve(__dirname, "../components/home/BAVApplicationModule.tsx"), "utf8");
  it("heeft geen offerteknop, melding of blokkade meer", () => {
    expect(wizard).not.toMatch(/offerteLink|Offerte aanvragen|direct online afsluiten/i);
    expect(wizard).not.toMatch(/disabled=\{[^}]*isHandmatigeAcceptatieSector/);
    expect(wizard).not.toMatch(/newErrors\.\w+ = [^;]*sector[^;]*niet mogelijk/);
  });
  it("process-bav-wizard weigert zorg/bouw niet meer", () => {
    const fn = readFileSync(resolve(__dirname, "../../supabase/functions/process-bav-wizard/index.ts"), "utf8");
    expect(fn).not.toMatch(/sector_alleen_offerte|KLANTMELDING_ALLEEN_OFFERTE/);
    expect(fn).toMatch(/handmatige_acceptatie: \{ reden: HANDMATIGE_ACCEPTATIE_REDEN/);
  });
  it("klantteksten bevatten geen verboden woorden voor deze sectoren", () => {
    const m = wizard.match(/submissionResult\.handmatig\s*\?\s*"([^"]+)"/);
    expect(m).not.toBeNull();
    expect(m![1]).not.toMatch(/offerte|handmatig|afgewezen|propositie/i);
  });

  it("toont de 24-uursbelofte zonder directe dekking of intern traject", () => {
    const vertalingen = [nl.home.bavUsps, en.home.bavUsps, de.home.bavUsps, fr.home.bavUsps];
    for (const usps of vertalingen) {
      for (const sector of ["ict", "", "zorg", "bouw", "Zorg", "Bouw & techniek"]) {
        const zichtbaar = zichtbareBavUsps(usps, sector);
        expect(zichtbaar.join(" ")).not.toMatch(/direct gedekt|immediately covered|sofort versichert|couvert immédiatement|handmatige acceptatie/i);
        expect(zichtbaar).toHaveLength(usps.length);
        expect(zichtbaar[2]).toMatch(/24/);
      }
    }
  });
});

describe("activatiecheck handmatige acceptatie", () => {
  it("geen markering → ok", () => {
    expect(controleerHandmatigeAcceptatie({ sector: "ICT" }, {})).toEqual({ ok: true, gemarkeerd: false });
    expect(controleerHandmatigeAcceptatie(null, {})).toEqual({ ok: true, gemarkeerd: false });
  });
  it("markering zonder bevestiging → 409", () => {
    const r = controleerHandmatigeAcceptatie({ handmatige_acceptatie: { reden: "x", sector: "Zorg" } }, { lead_id: "a" });
    expect(r.ok).toBe(false);
    expect((r as { status?: number }).status).toBe(409);
    expect(controleerHandmatigeAcceptatie({ handmatige_acceptatie: {} }, { handmatige_acceptatie_bevestigd: "true" }).ok).toBe(false);
  });
  it("markering met bevestiging → ok", () => {
    expect(controleerHandmatigeAcceptatie({ handmatige_acceptatie: { sector: "Zorg" } }, { handmatige_acceptatie_bevestigd: true }))
      .toEqual({ ok: true, gemarkeerd: true });
  });
});

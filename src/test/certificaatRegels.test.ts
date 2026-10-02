import { describe, it, expect } from "vitest";
import {
  bepaalHoedanigheid, beslisNieuwCertificaat, schoonAanpassing, FOOTER_REGISTER_TEKST, POLISBLAD_NOTITIE,
} from "../../supabase/functions/_shared/certificaatRegels";
import { readFileSync } from "node:fs";

describe("certificaatregels", () => {
  it("hoedanigheid komt uit branche, fallback op beroep", () => {
    expect(bepaalHoedanigheid({ branche: "IT & ICT", beroep: "Recruitment & Talent Specialists" })).toBe("IT & ICT");
    expect(bepaalHoedanigheid({ branche: "  ", beroep: "Developer" })).toBe("Developer");
    expect(bepaalHoedanigheid({ branche: null, beroep: null })).toBe("Onbekend");
  });

  it("nieuw certificaat bij bestaand geldig certificaat vereist bevestiging", () => {
    const b = [{ certificate_number: "ZPBAV5170", status: "geldig" }];
    expect(beslisNieuwCertificaat(b, false)).toEqual({ toegestaan: false, code: "bestaand_certificaat", bestaand: "ZPBAV5170" });
    expect(beslisNieuwCertificaat(b, true).toegestaan).toBe(true);
    expect(beslisNieuwCertificaat([{ certificate_number: "ZPBAV5171", status: "ingetrokken" }], false).toegestaan).toBe(true);
    expect(beslisNieuwCertificaat([], false).toegestaan).toBe(true);
  });

  it("aanpassen accepteert nooit een certificaatnummer of status", () => {
    const w = schoonAanpassing({ profession: "IT & ICT", certificate_number: "ZPBAV9999", status: "ingetrokken", start_date: "2026-10-02" });
    expect(w).toEqual({ profession: "IT & ICT", start_date: "2026-10-02" });
  });

  it("edge function: aanpassen behoudt nummer en bewaart versie; intrekken verwijdert niets", () => {
    const src = readFileSync("supabase/functions/generate-certificate/index.ts", "utf8");
    expect(src).not.toMatch(/\.delete\(/);
    expect(src).not.toMatch(/\.remove\(/);
    expect(src).toMatch(/policy_versies/);
    expect(src).toMatch(/storage\.from\("certificates"\)\.copy\(/);
    expect(src).toMatch(/fileName = `\$\{policy\.certificate_number\}\.pdf`/);
    expect(src).not.toMatch(/polis blad|in ingeschreven/);
    expect(FOOTER_REGISTER_TEKST).toContain("ZP Zaken is ingeschreven");
    expect(POLISBLAD_NOTITIE).toContain("polisblad");
  });
});

import { magCertificaatBeheren } from "../../supabase/functions/_shared/certificaatRegels";
describe("certificaatrechten", () => {
  it("verzekering, supervisor en admin mogen", () => {
    for (const r of ["verzekering", "supervisor", "admin"]) expect(magCertificaatBeheren([r])).toBe(true);
  });
  it("marketing en geen rol mogen niet", () => {
    expect(magCertificaatBeheren(["marketing"])).toBe(false);
    expect(magCertificaatBeheren([null])).toBe(false);
    expect(magCertificaatBeheren([])).toBe(false);
  });
});

// @vitest-environment node
// D7: certificaat pas beschikbaar vanaf 1 kalendermaand voor de ingangsdatum.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { certificaatBeschikbaar, certificaatBeschikbaarVanaf, certificaatTeVroegMelding } from "@/lib/certificaatBeschikbaar";

describe("certificaatBeschikbaarVanaf", () => {
  it("01-12-2026 -> 01-11-2026", () => expect(certificaatBeschikbaarVanaf("2026-12-01")).toBe("2026-11-01"));
  it("31-03 -> 28-02 of 29-02", () => {
    expect(certificaatBeschikbaarVanaf("2027-03-31")).toBe("2027-02-28");
    expect(certificaatBeschikbaarVanaf("2028-03-31")).toBe("2028-02-29");
  });
  it("januari -> december vorig jaar", () => expect(certificaatBeschikbaarVanaf("2027-01-15")).toBe("2026-12-15"));
  it("beschikbaar op grens, niet ervoor; verleden en leeg = nu beschikbaar", () => {
    expect(certificaatBeschikbaar("2026-12-01", "2026-10-31")).toBe(false);
    expect(certificaatBeschikbaar("2026-12-01", "2026-11-01")).toBe(true);
    expect(certificaatBeschikbaar("2026-01-01", "2026-10-15")).toBe(true);
    expect(certificaatBeschikbaar(null, "2026-10-15")).toBe(true);
  });
  it("melding en byte-gelijke kopie", () => {
    expect(certificaatTeVroegMelding("2026-12-01")).toBe("Certificaat beschikbaar vanaf 01-11-2026 (1 maand voor de ingangsdatum)");
    expect(readFileSync("src/lib/certificaatBeschikbaar.ts", "utf8")).toBe(readFileSync("supabase/functions/_shared/certificaatBeschikbaar.ts", "utf8"));
    const g = readFileSync("supabase/functions/generate-certificate/index.ts", "utf8");
    expect(g.match(/code: "certificaat_te_vroeg"/g)?.length).toBe(2);
  });
});

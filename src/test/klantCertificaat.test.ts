import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { kiesKlantCertificaatnummer, actiefKlantContract } from "../../supabase/functions/_shared/certificaatRegels";

describe("certificaat voor bestaande klant", () => {
  it("behoudt het bestaande (nieuwste bevestigde) nummer", () => {
    expect(kiesKlantCertificaatnummer([
      { certificaatnummer: "ZPBAV1200", aanvraagdatum: "2022-01-01", koppeling_status: "bevestigd" },
      { certificaatnummer: "ZPBAV3300", aanvraagdatum: "2025-05-01", koppeling_status: "bevestigd" },
      { certificaatnummer: "ZPBAV9999", aanvraagdatum: "2026-01-01", koppeling_status: "voorstel" },
    ])).toEqual({ soort: "bestaand", nummer: "ZPBAV3300" });
    expect(kiesKlantCertificaatnummer([])).toEqual({ soort: "nieuw_nodig" });
  });
  it("blokkeert opgezegde/afgelopen contracten", () => {
    expect(actiefKlantContract([{ type: "verzekering", status: "vervangen" }], "2026-10-02")).toBeNull();
    expect(actiefKlantContract([{ type: "verzekering", status: "loopt_af", eind_datum: "2026-01-01" }], "2026-10-02")).toBeNull();
    expect(actiefKlantContract([{ type: "verzekering", status: "actief" }], "2026-10-02")).not.toBeNull();
  });
  it("klanttak mailt niets en nodigt niemand uit", () => {
    const src = readFileSync("supabase/functions/generate-certificate/index.ts", "utf8");
    const tak = src.slice(src.indexOf("else if (body.onderneming_id)"), src.indexOf("lead_id or policy_data required"));
    expect(tak).not.toMatch(/mailCertificaat|resend|autoInvite/i);
    expect(src).toMatch(/if \(lead_id && actie === "nieuw"\)/);
  });
});

describe("branche bij bestaande klant", () => {
  it("hoedanigheid volgt uit gekozen sector, zelfde mapping als leads; functie niet gebruikt", async () => {
    const { brancheVoorSector } = await import("../../supabase/functions/_shared/sectorBranche");
    expect(brancheVoorSector("ICT")).toBe("IT & ICT");
    expect(brancheVoorSector("Zorg")).toBe("Zakelijke dienstverlening");
    expect(brancheVoorSector("vrije tekst")).toBeNull();
    const src = readFileSync("supabase/functions/generate-certificate/index.ts", "utf8");
    const tak = src.slice(src.indexOf("else if (body.onderneming_id)"), src.indexOf("lead_id or policy_data required"));
    expect(tak).toMatch(/brancheVoorSector\(sector\)/);
    expect(tak).toMatch(/ondernemingen"\)\.update\(\{ branche: profession, sector \}\)/);
    expect(tak).not.toMatch(/functie/);
  });
});

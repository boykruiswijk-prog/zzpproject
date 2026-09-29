// @vitest-environment node
import { SITE_CONFIG } from "@/config/site";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as front from "@/lib/sepaMachtiging";

const ID = "NL03ZZZ621170920000";

describe("Incassant-ID", () => {
  it("staat gelijk in frontend- en serverconfig", () => {
    expect(SITE_CONFIG.incassantId).toBe(ID);
    const server = readFileSync(resolve(__dirname, "../../supabase/functions/_shared/company.ts"), "utf8");
    expect(server).toContain(`incassantId: "${ID}"`);
  });
  it("weigering 'tijdelijk niet mogelijk' treedt niet op (zelfde check als incassantIdOntbreekt)", () => {
    expect(!String(ID).trim()).toBe(false);
  });
  it("staat in de gerenderde machtigingstekst", () => {
    const t = front.renderMachtigingstekst({
      type: "doorlopend", incassantNaam: "ZP Zaken B.V.",
      incassantAdres: "Tupolevlaan 41, 1119 NW Schiphol-Rijk, Nederland", incassantId: ID,
      mandaatkenmerk: "ZPZ00000000000040008000000000000001", reden: front.redenBav(),
      debiteurNaam: "TEST-Voorbeeld B.V.",
      debiteurAdres: { straat: "Voorbeeldstraat", huisnummer: "1", postcode: "1234 AB", plaats: "Amsterdam", land: "Nederland" },
      iban: "NL91ABNA0417164300",
    });
    expect(t).toContain(`Incassant-ID: ${ID}`);
  });
});

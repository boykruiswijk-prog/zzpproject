import { describe, expect, it } from "vitest";
import { hoofdletterStraatOfPlaats, normaliseerAdres, normaliseerPostcode } from "@/lib/adresNormalisatie";

describe("hoofdletterStraatOfPlaats", () => {
  it.each([
    ["tupolevlaan", "Tupolevlaan"],
    ["schiphol-rijk", "Schiphol-Rijk"],
    ["'s-Gravenhage", "'s-Gravenhage"],
    ["'s-gravenhage", "'s-gravenhage"],
    ["van Goghstraat", "van Goghstraat"],
    ["van goghstraat", "van goghstraat"],
    ["de Ruyterkade", "de Ruyterkade"],
    ["ten Katestraat", "ten Katestraat"],
    ["'t Zand", "'t Zand"],
    ["Amsterdam", "Amsterdam"],
    ["ëindhoven", "ëindhoven"],
    ["  tupolevlaan   noord ", "Tupolevlaan noord"],
    ["", ""],
  ])("%s → %s", (input, verwacht) => {
    expect(hoofdletterStraatOfPlaats(input)).toBe(verwacht);
  });
  it("tussenvoegsel alleen als los eerste woord", () => {
    expect(hoofdletterStraatOfPlaats("dennenlaan")).toBe("Dennenlaan");
    expect(hoofdletterStraatOfPlaats("terborchstraat")).toBe("Terborchstraat");
  });
});

describe("normaliseerPostcode", () => {
  it("NL altijd 1234 AB", () => {
    expect(normaliseerPostcode("1119nw", "Nederland")).toBe("1119 NW");
    expect(normaliseerPostcode(" 1119  Nw ", "NL")).toBe("1119 NW");
  });
  it("buitenland ongewijzigd behalve opschonen", () => {
    expect(normaliseerPostcode("  b-2000 ", "België")).toBe("b-2000");
  });
});

describe("normaliseerAdres", () => {
  it("T1-voorbeeld", () => {
    expect(normaliseerAdres({ straat: "tupolevlaan", huisnummer: " 41 ", postcode: "1119nw", plaats: "schiphol-rijk", land: "Nederland" }))
      .toEqual({ straat: "Tupolevlaan", huisnummer: "41", postcode: "1119 NW", plaats: "Schiphol-Rijk", land: "Nederland" });
  });
});

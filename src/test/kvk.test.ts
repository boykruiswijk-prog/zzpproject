import { describe, expect, it } from "vitest";
import { kvkAfwijkingen, kvkStartdatum, parseKvk } from "../../supabase/functions/_shared/kvk";

describe("KVK-profiel", () => {
  it("respecteert afgeschermd adres en kiest vroegste datum", () => {
    const p = parseKvk({
      kvkNummer: "12345678", naam: "Jansen Advies", formeleRegistratiedatum: "20260301", materieleRegistratie: { datumAanvang: "20260215" },
      handelsnamen: [{ naam: "Jansen Advies", volgorde: 0 }], _embedded: { eigenaar: { rechtsvorm: "Eenmanszaak" },
        hoofdvestiging: { adressen: [{ type: "bezoekadres", indAfgeschermd: "Ja", straatnaam: "Geheim", huisnummer: 1, postcode: "1234 AB", plaats: "X" }] } },
    }, null);
    expect(p.bezoekadres).toBeNull();
    expect(p.adres_afgeschermd).toBe(true);
    expect(kvkStartdatum(p)).toBe("2026-02-15");
    expect(p.rechtsvorm).toBe("Eenmanszaak");
  });
  it("leest bezoekadres uit vestigingsprofiel", () => {
    const p = parseKvk({ kvkNummer: "1", statutaireNaam: "Kology B.V." }, { adressen: [{ type: "bezoekadres", indAfgeschermd: "Nee", straatnaam: "Dorpsstraat", huisnummer: 12, huisletter: "a", postcode: "1234ab", plaats: "Utrecht" }] });
    expect(p.bezoekadres).toEqual({ straat: "Dorpsstraat", huisnummer: "12a", postcode: "1234AB", plaats: "Utrecht", postbus: null });
    expect(p.naam).toBe("Kology B.V.");
  });
  it("afwijkingen negeren hoofdletters en leestekens", () => {
    expect(kvkAfwijkingen({ bedrijfsnaam: "kology bv", postcode: "1234 ab" }, { bedrijfsnaam: "Kology B.V.", postcode: "1234AB" }, true)).toEqual([]);
    expect(kvkAfwijkingen({ bedrijfsnaam: "Koster" }, { bedrijfsnaam: "Kology B.V." }, false)).toHaveLength(1);
  });
});

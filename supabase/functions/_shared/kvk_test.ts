import { assertEquals } from "jsr:@std/assert@1";
import { kvkAfwijkingen, kvkStartdatum, parseKvk } from "./kvk.ts";

Deno.test("parseKvk respecteert afgeschermd adres en kiest vroegste datum", () => {
  const p = parseKvk({
    kvkNummer: "12345678", naam: "Jansen Advies", formeleRegistratiedatum: "20260301", materieleRegistratie: { datumAanvang: "20260215" },
    handelsnamen: [{ naam: "Jansen Advies", volgorde: 0 }], _embedded: { eigenaar: { rechtsvorm: "Eenmanszaak" },
      hoofdvestiging: { vestigingsnummer: "000012345678", adressen: [{ type: "bezoekadres", indAfgeschermd: "Ja", straatnaam: "Geheim", huisnummer: 1, postcode: "1234 AB", plaats: "X" }] } },
  }, null);
  assertEquals(p.bezoekadres, null);
  assertEquals(p.adres_afgeschermd, true);
  assertEquals(kvkStartdatum(p), "2026-02-15");
  assertEquals(p.rechtsvorm, "Eenmanszaak");
});

Deno.test("parseKvk leest bezoekadres met toevoeging", () => {
  const p = parseKvk({ kvkNummer: "1", statutaireNaam: "Kology B.V." }, { vestigingsnummer: "1", adressen: [{ type: "bezoekadres", indAfgeschermd: "Nee", straatnaam: "Dorpsstraat", huisnummer: 12, huisletter: "a", postcode: "1234ab", plaats: "Utrecht" }] });
  assertEquals(p.bezoekadres, { straat: "Dorpsstraat", huisnummer: "12a", postcode: "1234AB", plaats: "Utrecht", postbus: null });
  assertEquals(p.naam, "Kology B.V.");
});

Deno.test("kvkAfwijkingen negeert hoofdletters en spaties", () => {
  assertEquals(kvkAfwijkingen({ bedrijfsnaam: "kology bv", postcode: "1234 ab" }, { bedrijfsnaam: "Kology B.V.", postcode: "1234AB" }, true), []);
  assertEquals(kvkAfwijkingen({ bedrijfsnaam: "Koster" }, { bedrijfsnaam: "Kology B.V." }, false).length, 1);
});

// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { vulPlaceholders, VOORBEELD_DATA, PlaceholderFout } from "@/lib/klantmailTekst";

describe("vulPlaceholders", () => {
  it("vult bekende placeholders", () => {
    expect(vulPlaceholders("Beste {voornaam}, factuur {factuurnummer}", { voornaam: "Sanne", factuurnummer: "26001" })).toBe("Beste Sanne, factuur 26001");
  });
  it("onbekende of lege placeholder geeft fout en blijft nooit als {..} staan", () => {
    expect(() => vulPlaceholders("Hoi {naam}", { voornaam: "x" })).toThrow(PlaceholderFout);
    expect(() => vulPlaceholders("Hoi {voornaam}", {})).toThrow(PlaceholderFout);
  });
  it("alle concepten in de seed zijn met voorbeelddata volledig te vullen", () => {
    const sql = readFileSync("drizzle/migrations/0144_0144_klantmails_incasso_prolongatie.sql", "utf8");
    const teksten = [...sql.matchAll(/E'([^']*(?:''[^']*)*)'/g)].map((m) => m[1]);
    expect(teksten.length).toBe(4);
    for (const t of teksten) { const uit = vulPlaceholders(t, VOORBEELD_DATA); expect(uit).not.toMatch(/\{[a-z_]+\}/); expect(uit).toContain("020 - 457 3077"); }
  });
});

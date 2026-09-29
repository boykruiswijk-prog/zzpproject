import { describe, expect, it } from "vitest";
import {
  factuurReferentie,
  kopOmschrijving,
  maandIsAlGefactureerd,
  regelNotities,
  regelOmschrijving,
} from "../../supabase/functions/_shared/factuurTekst";

describe("factuurTekst", () => {
  it.each([
    ["premie", "01-10-26 t/m 31-10-26 BAV-AVB premie"],
    ["restitutie_pauze", "25-06-26 t/m 22-06-27 restitutie pauze"],
    ["restitutie_opzegging", "25-06-26 t/m 22-06-27 restitutie opzegging"],
    ["hervat", "25-06-26 t/m 22-06-27 BAV-AVB hervat"],
  ] as const)("bouwt %s periode-eerst en maximaal 60 tekens", (soort, verwacht) => {
    const tekst = regelOmschrijving(soort, soort === "premie" ? "2026-10-01" : "2026-06-25", soort === "premie" ? "2026-10-31" : "2027-06-22");
    expect(tekst).toBe(verwacht);
    expect(tekst.length).toBeLessThanOrEqual(60);
    expect(tekst).toMatch(/^\d{2}-\d{2}-\d{2} t\/m \d{2}-\d{2}-\d{2}/);
  });

  it("verplaatst berekening en maand naar Notes", () => {
    expect(regelNotities(31, 55 / 31, "oktober 2026")).toContain("31 dagen × €");
  });

  it("kiest certificaat, anders relatiecode, nooit een UUID-fallback", () => {
    expect(factuurReferentie(" ZPBAV5146 ", "1000394")).toBe("ZPBAV5146");
    expect(factuurReferentie(null, " 1000394 ")).toBe("1000394");
    expect(factuurReferentie(null, null)).toBe("");
  });

  it("begrensd ook kopteksten en bewaakt maand-idempotentie", () => {
    expect(kopOmschrijving("x".repeat(100))).toHaveLength(60);
    expect(maandIsAlGefactureerd("success")).toBe(true);
    expect(maandIsAlGefactureerd("pending")).toBe(true);
    expect(maandIsAlGefactureerd("error")).toBe(false);
  });
});
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { valideerOpzegdatum, valideerToelichting, vandaagNL, plusDagen } from "@/lib/opzegValidatie";
import { valideerRedenStap, valideerDatumStap, OPZEG_REDENEN } from "@/pages/mijn-zp/Opzeggen";

const VANDAAG = "2026-10-01";
describe("opzegvalidatie", () => {
  it("lege datum geeft NL-melding", () => {
    expect(valideerOpzegdatum("", VANDAAG)).toBe("Kies een opzegdatum.");
    expect(valideerDatumStap({}, VANDAAG).opzegdatum).toMatch(/Kies een opzegdatum/);
  });
  it("datum in het verleden wordt geweigerd, vandaag en later niet", () => {
    expect(valideerOpzegdatum("2026-09-30", VANDAAG)).toMatch(/verleden/);
    expect(valideerOpzegdatum(VANDAAG, VANDAAG)).toBeNull();
    expect(valideerOpzegdatum("2026-12-01", VANDAAG)).toBeNull();
    expect(valideerOpzegdatum(plusDagen(VANDAAG, 181), VANDAAG)).toMatch(/180/);
    expect(valideerOpzegdatum("geen-datum", VANDAAG)).toMatch(/geldige/);
  });
  it("Anders zonder of met te korte/lange toelichting wordt geweigerd", () => {
    expect(valideerRedenStap({ reden: "Anders" }).toelichting).toMatch(/minimaal 3/);
    expect(valideerRedenStap({ reden: "Anders", toelichting: "  ab " }).toelichting).toMatch(/minimaal 3/);
    expect(valideerRedenStap({ reden: "Anders", toelichting: "x".repeat(501) }).toelichting).toMatch(/maximaal 500/);
    expect(valideerRedenStap({ reden: "Anders", toelichting: "BV" + "!" })).toEqual({});
    expect(valideerToelichting("andere_reden", "")).toMatch(/minimaal/);
  });
  it("alle andere redenen gaan door zonder toelichting; geen reden geeft fout", () => {
    for (const r of OPZEG_REDENEN.filter((x) => x !== "Anders")) expect(valideerRedenStap({ reden: r })).toEqual({});
    expect(valideerRedenStap({}).reden).toBe("Kies een reden.");
  });
  it("vandaagNL volgt Nederlandse tijd", () => {
    expect(vandaagNL(new Date("2026-10-01T22:30:00Z"))).toBe("2026-10-02");
  });
  it("frontend- en serverregels zijn byte-gelijk", () => {
    expect(readFileSync("supabase/functions/_shared/opzegValidatie.ts", "utf8")).toBe(readFileSync("src/lib/opzegValidatie.ts", "utf8"));
  });
});

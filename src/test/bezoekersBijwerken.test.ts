import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

// A8-aanvulling Bezoekerskaart, bron (5-11): bezoekers_bijwerken vervangt de dagrijen; laatste versie wint.
const fn = readFileSync("drizzle/migrations/0253_bezoekers_bijwerken_alias_fix.sql", "utf8");
const naam = readFileSync("drizzle/migrations/0252_bezoekers_naam_hague_fix.sql", "utf8");

describe("bezoekers_bijwerken", () => {
  it("is security definer en alleen voor beheerverbinding en service_role", () => {
    expect(fn).toMatch(/SECURITY DEFINER/);
    expect(fn).toMatch(/robot_toegang\(ARRAY\[\]::app_role\[\]\)/);
    expect(fn).toMatch(/REVOKE ALL ON FUNCTION public\.bezoekers_bijwerken\(date, jsonb\) FROM PUBLIC, anon, authenticated/);
    expect(fn).toMatch(/GRANT EXECUTE ON FUNCTION public\.bezoekers_bijwerken\(date, jsonb\) TO service_role/);
  });
  it("valideert maximaal 500 rijen, alleen toegestane velden en een geheel aantal >= 0", () => {
    expect(fn).toMatch(/jsonb_array_length\(p_rijen\) > 500/);
    expect(fn).toMatch(/NOT IN \('plaats','provincie','aantal'\)/);
    expect(fn).toMatch(/< 0/);
    expect(fn).toMatch(/<> trunc\(/);
  });
  it("vervangt alleen de rijen van de opgegeven dag", () => {
    expect(fn).toMatch(/DELETE FROM public\.scherm_bezoekers WHERE dag = p_dag AND soort IN \('dag','totaal'\)/);
    expect(fn).toMatch(/RETURN n/);
  });
  it("vertaalt GA4-namen naar Nederlands en lege plaats naar onbekend", () => {
    expect(naam).toContain("'the hague','Den Haag'");
    expect(naam).toContain("'south holland','Zuid-Holland'");
    expect(naam).toContain("'north holland','Noord-Holland'");
    expect(naam).toContain("'north brabant','Noord-Brabant'");
    expect(naam).toMatch(/THEN 'onbekend'/);
  });
});

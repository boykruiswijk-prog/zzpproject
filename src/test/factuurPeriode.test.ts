// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  periodeStart, periodeEind, periodeBedrag, planningsSleutel, SLEUTEL_PATROON,
  werkdagenTussen, planningStatusUitExact, dagErna,
} from "@/lib/factuurPeriode";

describe("factuurPeriode", () => {
  it("is byte-gelijk aan de serverkopie", () => {
    expect(readFileSync("supabase/functions/_shared/factuurPeriode.ts", "utf8")).toBe(readFileSync("src/lib/factuurPeriode.ts", "utf8"));
  });
  it("maandperiode: start + 1 maand − 1 dag", () => {
    expect(periodeEind("2026-10-17", "maand")).toBe("2026-11-16");
    expect(periodeEind("2026-01-31", "maand")).toBe("2026-02-27");
    expect(periodeEind("2028-01-31", "maand")).toBe("2028-02-28");
    expect(periodeEind("2026-12-01", "maand")).toBe("2026-12-31");
  });
  it("jaarperiode, ook schrikkeldag", () => {
    expect(periodeEind("2026-10-17", "jaar")).toBe("2027-10-16");
    expect(periodeEind("2028-02-29", "jaar")).toBe("2029-02-27");
  });
  it("doorrollen gaat vanaf het anker zonder verschuiving", () => {
    expect(periodeStart("2026-01-31", "maand", 2)).toBe("2026-03-31");
    expect(periodeStart("2026-07-17", "maand", 3)).toBe("2026-10-17"); // rij 610
    expect(dagErna("2026-10-16")).toBe("2026-10-17");
  });
  it("bedrag = per periode × aantal, afgerond op centen", () => {
    expect(periodeBedrag(55, 1)).toBe(55);
    expect(periodeBedrag(4.1667, 3)).toBe(12.5);
  });
  it("sleutel is alleen ZPF- en 8 hex-tekens", () => {
    const s = planningsSleutel("a1b2c3d4e5");
    expect(s).toBe("ZPF-A1B2C3D4");
    expect(SLEUTEL_PATROON.test(s)).toBe(true);
    expect(() => planningsSleutel("xyz")).toThrow();
  });
  it("werkdagen en statusovergangen", () => {
    expect(werkdagenTussen("2026-10-16", "2026-10-23")).toBe(5); // vr → vr
    expect(planningStatusUitExact(50, true, "2026-10-17", "2026-10-30")).toBe("verwerkt");
    expect(planningStatusUitExact(20, true, "2026-10-19", "2026-10-26")).toBe("concept_aangemaakt");
    expect(planningStatusUitExact(20, true, "2026-10-19", "2026-10-27")).toBe("te_laat");
    expect(planningStatusUitExact(null, false, "2026-10-19", "2026-10-20")).toBe("verwijderd_in_exact");
  });
});

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { nieuweContractStand, dagNa } from "../../supabase/functions/_shared/contractStand";

describe("contractstand na verwerkte factuur", () => {
  it("loopt mee met de verwerkte periode", () => {
    expect(nieuweContractStand("2026-10-12", "2026-11-12")).toEqual({ gefactureerd_tm: "2026-11-12", volgende_factuurdatum: "2026-11-13" });
  });
  it("zet een lege stand", () => {
    expect(nieuweContractStand(null, "2027-10-18")).toEqual({ gefactureerd_tm: "2027-10-18", volgende_factuurdatum: "2027-10-19" });
  });
  it("gaat nooit terug in de tijd en verandert niets bij dezelfde periode", () => {
    expect(nieuweContractStand("2026-12-12", "2026-11-12")).toBeNull();
    expect(nieuweContractStand("2026-11-12", "2026-11-12")).toBeNull();
  });
  it("dagNa over maand- en jaargrens", () => {
    expect(dagNa("2026-11-30")).toBe("2026-12-01");
    expect(dagNa("2026-12-31")).toBe("2027-01-01");
  });
  it("zowel planner als Exact-controle gebruiken dezelfde regel", () => {
    for (const f of ["factuur-planner", "exact-concept-controle"]) {
      const src = readFileSync(`supabase/functions/${f}/index.ts`, "utf8");
      expect(src).toContain("werkContractStandBij(admin, p,");
    }
  });
});

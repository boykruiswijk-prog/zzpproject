// @vitest-environment node
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { WIZARD_SECTOREN, verzekeringskaartVoorSector } from "@/data/sectorVerzekeringskaart";

describe("sector → verzekeringskaart", () => {
  it.each(WIZARD_SECTOREN.map((s) => s.id))("%s heeft een bestaande PDF", (id) => {
    const k = verzekeringskaartVoorSector(id);
    expect(k).not.toBeNull();
    expect(k!.path).toMatch(/^\/documenten\/.+\.pdf$/);
    expect(existsSync(join("public", k!.path))).toBe(true);
  });
  it("fallback-sectoren krijgen MPH-2013B", () => {
    for (const s of WIZARD_SECTOREN.filter((s) => s.fallback)) {
      expect(verzekeringskaartVoorSector(s.id)!.productCode).toBe("MPH-2013B");
    }
  });
  it("onbekende sector → geen kaart", () => {
    expect(verzekeringskaartVoorSector("")).toBeNull();
  });
});

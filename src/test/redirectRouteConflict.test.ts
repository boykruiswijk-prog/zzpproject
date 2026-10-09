// @vitest-environment node
import { describe, it, expect } from "vitest";
import path from "path";
import { bestaandeRoutes, redirectRouteConflicten } from "../../scripts/routeConflicts";

const root = path.resolve(__dirname, "../..");

describe("legacyRedirects", () => {
  it("leest routes uit router en seoRoutes", () => {
    const r = bestaandeRoutes(root);
    expect(r.has("voorwaarden")).toBe(true);
    expect(r.has("documenten")).toBe(true);
  });
  it("heeft geen bestaande route als bron", () => {
    expect(redirectRouteConflicten(root)).toEqual([]);
  });
});

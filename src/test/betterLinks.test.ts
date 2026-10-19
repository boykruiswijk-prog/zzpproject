// @vitest-environment node
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { legacyRedirects, zoekLegacyDoel } from "../config/legacyRedirects";
import { bestaandeRoutes } from "../../scripts/routeConflicts";
import { betterLinks } from "./fixtures/betterLinks";

const root = path.resolve(__dirname, "../..");
const routes = bestaandeRoutes(root);
const output = readFileSync(path.join(root, "public/_redirects"), "utf8");
const csv = readFileSync(path.join(root, "docs/cloudflare-bulk-redirects.csv"), "utf8");

describe("BetterLinks lijst Dave 19 oktober", () => {
  it.each(betterLinks)("/%s verwijst zonder botsing rechtstreeks naar %s", (from, to) => {
    expect(legacyRedirects.filter(r => r.from === from)).toEqual([{ from, to }]);
    expect(routes.has(from)).toBe(false);
    expect(zoekLegacyDoel(`/${from}`)).toBe(to);
    expect(zoekLegacyDoel(`/${from}/`)).toBe(to);
    const target = to.split("#")[0].slice(1);
    expect(target.endsWith(".pdf") ? existsSync(path.join(root, "public", target)) : routes.has(target)).toBe(true);
    const rule = `/${from}    ${to}    301`;
    expect(output).toContain(rule);
    expect(output.indexOf(rule)).toBeLessThan(output.indexOf("/:path/    /:path"));
    expect(output.indexOf(rule)).toBeLessThan(output.indexOf("/*    /index.html"));
    for (const slash of ["", "/"]) {
      expect(csv).toContain(`zpzaken.nl/${from}${slash},https://zpzaken.nl${to},301,`);
    }
  });

  it("laat kantoor-tv en alle onderliggende paden ongemoeid", () => {
    expect(legacyRedirects.filter(r => /^tv(?:\/|$)/.test(r.from))).toEqual([]);
    expect(zoekLegacyDoel("/tv")).toBeNull();
    expect(zoekLegacyDoel("/tv/voorbeeld")).toBeNull();
  });
});
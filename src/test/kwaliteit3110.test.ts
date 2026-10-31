// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { legacyRedirects, zoekLegacyDoel } from "@/config/legacyRedirects";
import { isStatischLegacyDoel } from "@/components/shared/LegacyRedirect";

const redirects = readFileSync("public/_redirects", "utf8");
const csv = readFileSync("docs/cloudflare-bulk-redirects.csv", "utf8");
const doelen = [
  ["post/cookie-instellingen-1", "/cookies"],
  ["sitemap.aspx", "/sitemap.xml"],
  ["src/assets/ellen-baars-avatar.webp", "/over-ons"],
  ["zzp-verzekering-interim", "/zzp-verzekering-interim-manager"],
] as const;

describe("Kwaliteitscontrole 31 oktober", () => {
  it.each(doelen)("%s verwijst direct met 301 naar %s", (from, to) => {
    expect(legacyRedirects.filter(r => r.from === from)).toEqual([{ from, to }]);
    for (const prefix of ["", "en/", "de/", "fr/"]) {
      for (const slash of ["", "/"]) {
        const path = `/${prefix}${from}${slash}`;
        expect(zoekLegacyDoel(path)).toBe(to);
        expect(redirects.split("\n").map(line => line.replace(/\s+#.*$/, ""))).toContain(`${path}    ${to}    301`);
        expect(csv.split("\n")).toContain(`zpzaken.nl${path},https://zpzaken.nl${to},301,TRUE,TRUE,FALSE,FALSE`);
      }
    }
  });

  it("sitemap.xml is een bestandsdoel en opent buiten de router", () => {
    expect(isStatischLegacyDoel(zoekLegacyDoel("/sitemap.aspx") ?? "")).toBe(true);
  });

  it("neemt de verwijderde groepsfoto niet opnieuw op in redirects of uitvoer", () => {
    const oudeFoto = `src/assets/${["team", "walking"].join("-")}.webp`;
    const server = readFileSync("supabase/functions/_shared/legacyRedirects.ts", "utf8");
    expect(legacyRedirects.some(r => r.from.includes(oudeFoto))).toBe(false);
    for (const uitvoer of [redirects, csv, server]) expect(uitvoer).not.toContain(oudeFoto);
    for (const prefix of ["", "en/", "de/", "fr/"]) {
      for (const slash of ["", "/"]) expect(zoekLegacyDoel(`/${prefix}${oudeFoto}${slash}`)).toBeNull();
    }
  });

  it("bestaande routes en tv blijven buiten de nieuwe doorverwijzingen", () => {
    for (const prefix of ["", "en/", "de/", "fr/"]) {
      for (const path of ["tv", "tv/", "tv/voorbeeld", "cookies", "over-ons", "sitemap.xml", "zzp-verzekering-interim-manager"]) {
        expect(zoekLegacyDoel(`/${prefix}${path}`)).toBeNull();
      }
    }
    expect(csv).not.toMatch(/^zpzaken\.nl\/(?:en\/|de\/|fr\/)?tv(?:\/|,)/m);
  });
});
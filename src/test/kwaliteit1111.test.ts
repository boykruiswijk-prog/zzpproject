// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { zoekLegacyDoel } from "@/config/legacyRedirects";
import { legacyRedirects as serverRedirects } from "../../supabase/functions/_shared/legacyRedirects";

describe("Loep 11 november: sitemap.txt", () => {
  it("geeft alle acht varianten een directe 301 naar sitemap.xml", () => {
    const redirects = readFileSync("public/_redirects", "utf8").split("\n").map(line => line.replace(/\s+#.*$/, ""));
    const csv = readFileSync("docs/cloudflare-bulk-redirects.csv", "utf8").split("\n");
    expect(serverRedirects.filter(r => r.from === "sitemap.txt")).toEqual([{ from: "sitemap.txt", to: "/sitemap.xml" }]);
    for (const prefix of ["", "en/", "de/", "fr/"]) {
      for (const slash of ["", "/"]) {
        const pad = `/${prefix}sitemap.txt${slash}`;
        expect(zoekLegacyDoel(pad)).toBe("/sitemap.xml");
        expect(redirects).toContain(`${pad}    /sitemap.xml    301`);
        expect(csv).toContain(`zpzaken.nl${pad},https://zpzaken.nl/sitemap.xml,301,TRUE,TRUE,FALSE,FALSE`);
      }
    }
  });
  it("laat tv en de afgekeurde foto ongemoeid", () => {
    expect(zoekLegacyDoel("/tv")).toBeNull();
    expect(zoekLegacyDoel("/src/assets/team-walking.webp")).toBeNull();
  });
});
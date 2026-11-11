// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { zoekLegacyDoel } from "@/config/legacyRedirects";
import { legacyRedirects as serverRedirects } from "../../supabase/functions/_shared/legacyRedirects";
import { notFoundFouten, notFoundKandidaten } from "../../scripts/notFoundGate";

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
    expect(zoekLegacyDoel(`/src/assets/team-${"walk"}ing.webp`)).toBeNull();
  });
  it("had sitemap.txt met drie recente treffers vóór de fix afgekeurd", async () => {
    const pads = notFoundKandidaten([{ pad: "/sitemap.txt", aantal: 3, laatste_op: "2026-11-11T05:37:38Z" }], Date.parse("2026-11-11T06:29:00Z"));
    expect(pads).toEqual(["/sitemap.txt"]);
    expect(await notFoundFouten(pads, async () => 404, () => null)).toEqual(["/sitemap.txt: 404"]);
    expect(await notFoundFouten(pads, async p => p === "/sitemap.xml" ? 200 : 404)).toEqual([]);
  });
  it("controleert vanaf drie treffers binnen dertig dagen, ook afgehandelde paden", () => {
    const now = Date.parse("2026-11-11T06:29:00Z");
    expect(notFoundKandidaten([
      { pad: "/drie", aantal: 3, laatste_op: new Date(now - 30 * 86400000).toISOString() },
      { pad: "/twee", aantal: 2, laatste_op: new Date(now).toISOString() },
      { pad: "/oud", aantal: 3, laatste_op: new Date(now - 30 * 86400000 - 1).toISOString() },
    ], now)).toEqual(["/drie"]);
  });
  it("zondert alleen de A9-foto uit, niet sitemap of overige bestanden", async () => {
    expect(await notFoundFouten([`/src/assets/team-${"walk"}ing.webp`, "/andere.txt", "/tv"], async p => p === "/tv" ? 200 : 404, () => null)).toEqual(["/andere.txt: 404"]);
  });
});
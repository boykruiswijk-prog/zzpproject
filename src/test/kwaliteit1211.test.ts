// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { legacyRedirects, zoekLegacyDoel } from "@/config/legacyRedirects";
import { legacyRedirects as serverRedirects } from "../../supabase/functions/_shared/legacyRedirects";
import { bestaandeRoutes, redirectRouteConflicten } from "../../scripts/routeConflicts";

const webshopPaden = ["afrekenen", "winkelmand", "winkelwagen", "checkout", "cart"];
const routes = bestaandeRoutes(resolve("."));
const redirects = readFileSync("public/_redirects", "utf8").split("\n").map(line => line.replace(/\s+#.*$/, ""));
const csv = readFileSync("docs/cloudflare-bulk-redirects.csv", "utf8").split("\n");

describe("Loep 12 november: oude webshopadressen", () => {
  for (const bron of webshopPaden) {
    it(`${bron}: acht varianten geven één directe 301 naar /verzekeringen`, () => {
      expect(legacyRedirects.filter(r => r.from === bron)).toEqual([{ from: bron, to: "/verzekeringen" }]);
      for (const prefix of ["", "en/", "de/", "fr/"]) {
        expect(routes.has(`${prefix}${bron}`)).toBe(false);
        for (const slash of ["", "/"]) {
          const pad = `/${prefix}${bron}${slash}`;
          expect(zoekLegacyDoel(pad)).toBe("/verzekeringen");
          expect(redirects.filter(line => line === `${pad}    /verzekeringen    301`)).toHaveLength(1);
          expect(csv.filter(line => line === `zpzaken.nl${pad},https://zpzaken.nl/verzekeringen,301,TRUE,TRUE,FALSE,FALSE`)).toHaveLength(1);
        }
      }
    });
  }
  it("houdt site en serverkopie gelijk", () => {
    expect(serverRedirects).toEqual(legacyRedirects);
  });
  it("beschermt bestaande routes en /tv", () => {
    expect(redirectRouteConflicten(resolve("."))).toEqual([]);
    for (const prefix of ["", "en/", "de/", "fr/"]) {
      for (const slash of ["", "/"]) expect(zoekLegacyDoel(`/${prefix}tv${slash}`)).toBeNull();
    }
    expect(zoekLegacyDoel("/verzekeringen")).toBeNull();
  });
});
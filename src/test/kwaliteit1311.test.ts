// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { geordendeRedirects, legacyRedirects, taalprefixRedirects, zoekLegacyDoel } from "@/config/legacyRedirects";

const redirects = () => readFileSync("public/_redirects", "utf8");
const csv = () => readFileSync("docs/cloudflare-bulk-redirects.csv", "utf8");
const edge = () => readFileSync("supabase/functions/_shared/legacyRedirects.ts", "utf8");

// Paden uit not_found_log sinds 27-10-2026.
const LOG = ["academy/scrum-professional", "academy/online-academy", "academy/classes/agile-coach", "academy/in-house/", "academy/compleet-aanbod/certificering/", "academy/online", "academy/partners/options"];

describe("Kwaliteitscontrole 13 november: oude /academy/-paden", () => {
  it("elk /academy/-pad komt uit op een regel, expliciete regels gaan voor, ook met taalprefix", () => {
    const geordend = geordendeRedirects([...legacyRedirects, ...taalprefixRedirects()]);
    const tekst = redirects();
    const spa = tekst.indexOf("/*    /index.html    200");
    for (const prefix of ["", "en/", "de/", "fr/"]) {
      for (const pad of LOG) {
        expect(zoekLegacyDoel(`/${prefix}${pad}`), `${prefix}${pad}`).toBe("/over-ons");
        expect(zoekLegacyDoel(`/${prefix}${pad.replace(/\/$/, "")}/`)).toBe("/over-ons");
      }
      expect(zoekLegacyDoel(`/${prefix}academy/weblog/`)).toBe("/kennisbank");
      expect(zoekLegacyDoel(`/${prefix}academy/partners`)).toBe("/partners");
      expect(zoekLegacyDoel(`/${prefix}academy/contact/`)).toBe("/contact");
      expect(zoekLegacyDoel(`/${prefix}academy`)).toBe("/over-ons");
      const vang = `${prefix}academy/*`;
      const vangIdx = geordend.findIndex(r => r.from === vang);
      expect(geordend[vangIdx]?.to).toBe("/over-ons");
      const positie = tekst.indexOf(`/${vang}    /over-ons    301`);
      expect(positie).toBeGreaterThan(-1);
      expect(positie).toBeLessThan(spa);
      for (const regel of geordend.filter(r => !r.from.endsWith("/*") && r.from.startsWith(`${prefix}academy/`))) {
        expect(geordend.indexOf(regel)).toBeLessThan(vangIdx);
        const r = tekst.indexOf(`/${regel.from}/    `);
        expect(r).toBeGreaterThan(-1);
        expect(r).toBeLessThan(positie);
      }
      expect(csv()).toContain(`zpzaken.nl/${prefix}academy/,https://zpzaken.nl/over-ons,301,TRUE,TRUE,TRUE,FALSE`);
    }
    expect(edge()).toContain('{ from: "academy/*", to: "/over-ons" }');
    expect(zoekLegacyDoel("/over-ons")).toBeNull();
    expect(zoekLegacyDoel("/tv")).toBeNull();
    expect(zoekLegacyDoel("/en/tv")).toBeNull();
  });
});

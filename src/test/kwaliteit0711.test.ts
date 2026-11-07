// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { geordendeRedirects, legacyRedirects, taalprefixRedirects, zoekLegacyDoel } from "@/config/legacyRedirects";
import { bestaandeRoutes } from "../../scripts/routeConflicts";
import { cloudflareBulkCsv } from "../../vite.config";

function bronnen(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = join(dir, entry.name);
    if (entry.isDirectory()) return ["test", "admin", "crm", "scherm", "integrations"].includes(entry.name) ? [] : bronnen(file);
    return /\.(tsx?|json|txt)$/.test(entry.name) ? [file] : [];
  });
}

describe("Kwaliteitscontrole 7 november", () => {
  it.each(["weet wat jij als zzp'er nodig hebt", "overzicht op maat"])("publieke bronnen bevatten niet: %s", zin => {
    const files = [...bronnen("src"), ...bronnen("public"), "supabase/functions/_shared/zekerKennis.generated.ts"];
    const matches = files.filter(file => readFileSync(file, "utf8").toLowerCase().includes(zin));
    expect(matches).toEqual([]);
  });

  it.each(["/bedankt-maandelijks", "/bedankt-jaarlijks/", "/en/bedankt-maandelijks"])("%s heeft een afgeleide 301 naar /verzekeringen", pad => {
    expect(zoekLegacyDoel(pad)).toBe("/verzekeringen");
    const lines = readFileSync("public/_redirects", "utf8").split("\n");
    expect(lines.some(line => line.trim().split(/\s+/).slice(0, 3).join(" ") === `${pad} /verzekeringen 301`)).toBe(true);
    expect(readFileSync("docs/cloudflare-bulk-redirects.csv", "utf8")).toContain(`zpzaken.nl${pad},https://zpzaken.nl/verzekeringen,301`);
  });

  it("bedanktvangnet met taalprefix en slash, bestaande routes en /tv blijven vrij", () => {
    const routes = bestaandeRoutes(process.cwd());
    expect([...routes].filter(p => /^(?:(?:en|de|fr)\/)?bedankt(?:$|[-/])/.test(p))).toEqual([]);
    const ordered = geordendeRedirects([...legacyRedirects, ...taalprefixRedirects()]);
    for (const prefix of ["", "en/", "de/", "fr/"]) {
      for (const pad of ["bedankt", "bedankt/", "bedankt-nieuwe-variant", "bedankt-nieuwe-variant/"]) {
        expect(zoekLegacyDoel(`/${prefix}${pad}`)).toBe("/verzekeringen");
      }
      const wildcard = ordered.findIndex(r => r.from === `${prefix}bedankt-*`);
      expect(wildcard).toBeGreaterThan(ordered.findIndex(r => r.from === `${prefix}bedankt-maandelijks`));
    }
    expect(zoekLegacyDoel("/tv")).toBeNull();
    expect(zoekLegacyDoel("/en/tv")).toBeNull();
    expect(zoekLegacyDoel("/offerte/bedankt")).toBeNull();
    expect(zoekLegacyDoel("/bedankte-klant")).toBeNull();
  });

  it("bedanktvangregels staan na expliciete regels en vóór de SPA, geen onwerkende Bulk-wildcard", () => {
    const text = readFileSync("public/_redirects", "utf8");
    for (const prefix of ["", "en/", "de/", "fr/"]) {
      const line = `/${prefix}bedankt-*    /verzekeringen    301`;
      const index = text.indexOf(line);
      expect(index).toBeGreaterThan(text.indexOf(`/${prefix}bedankt-maandelijks/    /verzekeringen    301`));
      expect(index).toBeLessThan(text.indexOf("/*    /index.html    200"));
      expect(cloudflareBulkCsv([line])).toEqual([]);
    }
  });
});
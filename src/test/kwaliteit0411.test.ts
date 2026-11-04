// @vitest-environment node
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { geordendeRedirects, legacyRedirects, taalprefixRedirects, zoekLegacyDoel } from "@/config/legacyRedirects";

/** Beide richtingen, hoofdletterongevoelig, ook over regeleinden heen. */
const afkorting = /\bincl\.[\s\S]{0,40}\b(?:kosten|assurantiebelasting)\b|\b(?:kosten|assurantiebelasting)\b[\s\S]{0,40}\bincl\./i;

function bronbestanden(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const pad = join(dir, entry.name);
    if (entry.isDirectory()) return ["test", "__tests__", "admin", "crm"].includes(entry.name) ? [] : bronbestanden(pad);
    return /\.(?:[cm]?[jt]sx?|json|md|txt)$/.test(pad) && !/\.(?:test|spec)\./.test(pad) ? [pad] : [];
  });
}

describe("Kwaliteitscontrole 4 november", () => {
  it("herkent de verboden afkorting in beide richtingen tot en met 40 tekens", () => {
    for (const woord of ["kosten", "assurantiebelasting"]) {
      expect(afkorting.test(`INCL.${" ".repeat(40)}${woord}`)).toBe(true);
      expect(afkorting.test(`${woord}${" ".repeat(40)}Incl.`)).toBe(true);
      expect(afkorting.test(`incl.${" ".repeat(41)}${woord}`)).toBe(false);
      expect(afkorting.test(`${woord}${" ".repeat(41)}incl.`)).toBe(false);
      expect(afkorting.test(`inclusief ${woord}`)).toBe(false);
    }
  });

  it("publieke bronnen en gegenereerde llms gebruiken inclusief voluit", () => {
    const bestanden = [...bronbestanden("src"), ...bronbestanden("i18n"), ...bronbestanden("scripts"),
      "supabase/functions/_shared/zekerKennis.generated.ts", "public/llms.txt", "public/llms-full.txt"];
    const fouten = bestanden.flatMap(pad => {
      const tekst = readFileSync(pad, "utf8");
      const match = afkorting.exec(tekst);
      return match ? [`${pad}:${tekst.slice(0, match.index).split("\n").length}: ${match[0]}`] : [];
    });
    expect(fouten).toEqual([]);
  });

  it.each(["", "en/", "de/", "fr/"])("%soude introductie heeft acht expliciete 301-varianten", prefix => {
    const bron = `${prefix}nieuws/even-voorstellen-michel-verheij`;
    for (const slash of ["", "/"]) {
      expect(zoekLegacyDoel(`/${bron}${slash}`)).toBe("/over-ons");
      expect(readFileSync("public/_redirects", "utf8")).toContain(`/${bron}${slash}    /over-ons    301`);
      expect(readFileSync("docs/cloudflare-bulk-redirects.csv", "utf8")).toContain(`zpzaken.nl/${bron}${slash},https://zpzaken.nl/over-ons,301,TRUE,TRUE,FALSE,FALSE`);
    }
  });

  it("nieuwsvangnet komt na alle expliciete regels en laat bestaande doelen intact", () => {
    const geordend = geordendeRedirects([...legacyRedirects, ...taalprefixRedirects()]);
    const redirects = readFileSync("public/_redirects", "utf8");
    const csv = readFileSync("docs/cloudflare-bulk-redirects.csv", "utf8");
    for (const prefix of ["", "en/", "de/", "fr/"]) {
      const vang = `${prefix}nieuws/*`;
      expect(geordend.find(r => r.from === vang)?.to).toBe("/kennisbank");
      expect(zoekLegacyDoel(`/${prefix}nieuws/onbekend-oud-artikel/`)).toBe("/kennisbank");
      expect(zoekLegacyDoel(`/${prefix}nieuws/categories/bav/`)).toBe("/verzekeringen");
      const positie = redirects.indexOf(`/${vang}    /kennisbank    301`);
      expect(positie).toBeGreaterThan(-1);
      for (const regel of geordend.filter(r => !r.from.endsWith("/*") && r.from.startsWith(`${prefix}nieuws/`))) {
        expect(geordend.indexOf(regel)).toBeLessThan(geordend.findIndex(r => r.from === vang));
        expect(redirects.indexOf(`/${regel.from}/    `)).toBeLessThan(positie);
      }
      expect(csv).toContain(`zpzaken.nl/${prefix}nieuws/,https://zpzaken.nl/kennisbank,301,TRUE,TRUE,TRUE,FALSE`);
    }
    expect(zoekLegacyDoel("/tv")).toBeNull();
  });
});
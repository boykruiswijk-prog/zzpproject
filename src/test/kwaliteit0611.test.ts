// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { geordendeRedirects, legacyRedirects, taalprefixRedirects, zoekLegacyDoel } from "@/config/legacyRedirects";

const app = readFileSync("src/App.tsx", "utf8");
const redirects = () => readFileSync("public/_redirects", "utf8");
const csv = () => readFileSync("docs/cloudflare-bulk-redirects.csv", "utf8");

describe("Kwaliteitscontrole 6 november: oude /control/-paden", () => {
  it("doelen /creditcontrol en /pensioen zijn bestaande routes", () => {
    expect(app).toContain('<Route path="creditcontrol"');
    expect(app).toContain('<Route path="pensioen"');
  });

  it.each(["", "en/", "de/", "fr/"])("%scontrol/financieel/pensioen-webinar gaat naar /pensioen", prefix => {
    for (const slash of ["", "/"]) {
      const bron = `/${prefix}control/financieel/pensioen-webinar${slash}`;
      expect(zoekLegacyDoel(bron)).toBe("/pensioen");
      expect(redirects()).toMatch(new RegExp(`^${bron.replace(/[/.]/g, "\\$&")}    /pensioen    301`, "m"));
    }
    expect(csv()).toContain(`zpzaken.nl/${prefix}control/financieel/pensioen-webinar,https://zpzaken.nl/pensioen,301`);
  });

  it("elk /control/-pad komt uit op een expliciete regel of de vangregel, ook met taalprefix", () => {
    const geordend = geordendeRedirects([...legacyRedirects, ...taalprefixRedirects()]);
    const tekst = redirects();
    const spa = tekst.indexOf("/*    /index.html    200");
    for (const prefix of ["", "en/", "de/", "fr/"]) {
      for (const pad of ["control/financieel/mobiliteitskaart/", "control/iets/nieuws", "control/x"]) {
        expect(zoekLegacyDoel(`/${prefix}${pad}`)).toBe("/creditcontrol");
      }
      expect(zoekLegacyDoel(`/${prefix}control/verzekeringen/zorg-en-zekerheid/`)).toBe("/zorgverzekering");
      const vang = `${prefix}control/*`;
      const vangIdx = geordend.findIndex(r => r.from === vang);
      expect(geordend[vangIdx]?.to).toBe("/creditcontrol");
      const positie = tekst.indexOf(`/${vang}    /creditcontrol    301`);
      expect(positie).toBeGreaterThan(-1);
      expect(positie).toBeLessThan(spa);
      for (const regel of geordend.filter(r => !r.from.endsWith("/*") && r.from.startsWith(`${prefix}control/`))) {
        expect(geordend.indexOf(regel)).toBeLessThan(vangIdx);
        const r = tekst.indexOf(`/${regel.from}/    `);
        expect(r).toBeGreaterThan(-1);
        expect(r).toBeLessThan(positie);
      }
      expect(csv()).toContain(`zpzaken.nl/${prefix}control/,https://zpzaken.nl/creditcontrol,301,TRUE,TRUE,TRUE,FALSE`);
    }
    expect(zoekLegacyDoel("/creditcontrol")).toBeNull();
    expect(zoekLegacyDoel("/tv")).toBeNull();
  });
});

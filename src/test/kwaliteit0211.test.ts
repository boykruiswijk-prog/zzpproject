// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { legacyRedirects, zoekLegacyDoel } from "@/config/legacyRedirects";
import { cloudflareBulkCsv } from "../../vite.config";

const redirects = readFileSync("public/_redirects", "utf8");
const csv = readFileSync("docs/cloudflare-bulk-redirects.csv", "utf8");

describe("Kwaliteitscontrole 2 november", () => {
  it.each(["nl", "en", "de", "fr"])("%s AOV-kaart heeft geen bedrag of absolute zekerheid", taal => {
    const { insuranceData: kaart } = JSON.parse(readFileSync(`src/i18n/locales/${taal}.json`, "utf8"));
    const tekst = JSON.stringify(Object.fromEntries(Object.entries(kaart).filter(([key]) => key.startsWith("aov"))));
    expect(tekst).not.toMatch(/€|\b150\b|zorgt voor financiële zekerheid|provides financial security|bietet finanzielle Sicherheit|offre une sécurité financière/);
    expect(kaart.aovCta).toBeTruthy();
  });

  it("Nederlands gebruikt de voorgeschreven voorwaardelijke uitleg en externe premieberekening", () => {
    const { insuranceData: kaart } = JSON.parse(readFileSync("src/i18n/locales/nl.json", "utf8"));
    expect(kaart.aovDesc).toBe("Een AOV kan een deel van je inkomen aanvullen als je door ziekte of een ongeval niet kunt werken, volgens de voorwaarden van de verzekeraar.");
    expect(kaart.aovPrice).toBe("Premie bereken je via onze externe adviseur");
    expect(kaart.aovCta).toBe("Meer over de AOV");
  });

  it.each(["en", "de", "fr"])("%s interne paden behouden hun suffix en bestaande paden blijven vrij", taal => {
    for (const pad of ["portal/login", "portal/invite/test-token", "portal/heractiveer/test-id", "mijn-zp/polis", "mijn-zp/opzeggen", "mijn-zp/nieuw/subpad"]) {
      for (const slash of ["", "/"]) expect(zoekLegacyDoel(`/${taal}/${pad}${slash}`)).toBe(`/${pad}`);
    }
    for (const pad of ["portal/login", "portal/facturen", "mijn-zp/polis", "tv", `${taal}/tv`]) expect(zoekLegacyDoel(`/${pad}`)).toBeNull();
    const from = `${taal}/portal/login`;
    expect(legacyRedirects).toContainEqual({ from, to: "/portal/login" });
    for (const slash of ["", "/"]) {
      expect(redirects).toContain(`/${from}${slash}    /portal/login    301`);
      expect(csv).toContain(`zpzaken.nl/${from}${slash},https://zpzaken.nl/portal/login,301,TRUE,TRUE,FALSE,FALSE`);
    }
    for (const namespace of ["portal", "mijn-zp"]) {
      const line = `/${taal}/${namespace}/*    /${namespace}/:splat    301`;
      expect(redirects).toContain(line);
      const row = `zpzaken.nl/${taal}/${namespace}/,https://zpzaken.nl/${namespace}/,301,TRUE,TRUE,TRUE,TRUE`;
      expect(cloudflareBulkCsv([line])).toEqual([row]);
      expect(csv).toContain(row);
    }
  });
});
// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { legacyRedirects, zoekLegacyDoel } from "@/config/legacyRedirects";
import { bestaandeRoutes, redirectRouteConflicten } from "../../scripts/routeConflicts";
import { cloudflareBulkCsv } from "../../vite.config";

const root = path.resolve(__dirname, "../..");
const exact = [
  ["factoring/algemene-voorwaarden", "/algemene-voorwaarden"],
  ["pensioen-overzicht", "/pensioen"],
  ["sitemap-index.xml", "/sitemap.xml"],
  ["news_sitemap.xml", "/sitemap.xml"],
  ["news-sitemap.xml", "/sitemap.xml"],
  ["beroeps-en-bedrijfs-aansprakelijkheidsverzekering-zzp-avb-bav/%23pakket", "/verzekeringen"],
] as const;
const output = () => readFileSync(path.join(root, "public/_redirects"), "utf8");
const csv = () => readFileSync(path.join(root, "docs/cloudflare-bulk-redirects.csv"), "utf8");

describe("21 oktober oude WordPress-paden", () => {
  it.each(exact)("%s verwijst direct naar %s, met beide slashvarianten", (from, to) => {
    expect(legacyRedirects.filter(r => r.from === from)).toEqual([{ from, to }]);
    expect(bestaandeRoutes(root).has(from)).toBe(false);
    expect(zoekLegacyDoel(to)).toBeNull();
    for (const slash of ["", "/"]) {
      expect(zoekLegacyDoel(`/${from}${slash}`)).toBe(to);
      const rule = `/${from}${slash}    ${to}    301`;
      expect(output()).toContain(rule);
      expect(output().indexOf(rule)).toBeLessThan(output().indexOf("/:path/"));
      expect(csv()).toContain(`zpzaken.nl/${from}${slash},https://zpzaken.nl${to},301,TRUE,TRUE,FALSE,FALSE`);
    }
  }, 30000); // Routescan en _redirects-lezen per geval duren onder volle testbelasting soms langer dan 5 s.

  it.each(["profile", "followers", "blog-posts", "blog-comments"])("oud profielonderdeel %s gaat naar de homepage", (part) => {
    expect(zoekLegacyDoel(`/profile/voorbeeld/${part}`)).toBe("/");
    expect(zoekLegacyDoel(`/profile/voorbeeld/${part}/`)).toBe("/");
  });

  it("oude persberichten gaan naar de kennisbank, niet andere facts-paden", () => {
    expect(zoekLegacyDoel("/facts/press/oud-persbericht/")).toBe("/kennisbank");
    expect(zoekLegacyDoel("/facts/contact")).toBe("/contact");
    expect(zoekLegacyDoel("/facts/press-onbekend")).toBeNull();
    expect(zoekLegacyDoel("/profile-onbekend/voorbeeld")).toBeNull();
  });

  it.each([["profile/*", "/"], ["facts/press/*", "/kennisbank"]])("%s heeft 301 en Cloudflare-subpadmatching zonder padsuffix", (from, to) => {
    const line = `/${from}    ${to}    301`;
    const row = `zpzaken.nl/${from.slice(0, -1)},https://zpzaken.nl${to},301,TRUE,TRUE,TRUE,FALSE`;
    expect(output()).toContain(line);
    expect(output().indexOf(line)).toBeLessThan(output().indexOf("/*    /index.html"));
    expect(cloudflareBulkCsv([line])).toEqual([row]);
    expect(csv()).toContain(row);
  });

  it("de gecodeerde pakketlink heeft hetzelfde einddoel als het bestaande hoofdpad", () => {
    expect(zoekLegacyDoel(`/${exact[5][0]}`)).toBe(zoekLegacyDoel("/beroeps-en-bedrijfs-aansprakelijkheidsverzekering-zzp-avb-bav/"));
  });

  it("bestaande specifieke regels blijven vóór wildcards", () => {
    expect(zoekLegacyDoel("/profile/voorbeeld/profile", [{ from: "profile/*", to: "/" }, { from: "profile/voorbeeld/profile", to: "/contact" }])).toBe("/contact");
    expect(redirectRouteConflicten(root)).toEqual([]);
    for (const url of ["/tv", "/tv/", "/tv/voorbeeld", "/scherm", "/pensioen-opbouwen-zzp", "/zzp-pensioen-via-evi"]) expect(zoekLegacyDoel(url)).toBeNull();
  });
});
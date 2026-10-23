// @vitest-environment node
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { rootArtikelRedirects, voegArtikelRedirectsToe } from "../../scripts/articleRedirects";
import { bestaandeRoutes } from "../../scripts/routeConflicts";
import { legacyRedirects } from "@/config/legacyRedirects";

const root = path.resolve(__dirname, "../..");
const voorbeelden = ["sbi-codes", "jaarruimte-en-reserveringsruimte", "financiering-vinden-als-zzp-er-voor-je-bedrijf",
  "algemene-verordening-gegevensbeschermin-avg", "werken-als-zzp-er-na-je-aow-leeftijd",
  "wat-betekent-een-concurrentiebeding-of-relatiebeding-voor-een-zpp-er", "waarom-als-zzp-er-wel-of-niet-kiezen-voor-payrolling"];

describe("root-artikelredirects uit sitemapbron", () => {
  it.each(voorbeelden)("%s heeft twee directe 301-varianten of een bestaande redirect met voorrang", (slug) => {
    const redirects = rootArtikelRedirects([{ slug }], root);
    const existing = legacyRedirects.find((r) => r.from === slug);
    if (existing) { expect(redirects).toEqual([]); return; }
    expect(redirects).toEqual([{ from: slug, to: `/kennisbank/${slug}` }]);
    const text = voegArtikelRedirectsToe("/radio/* /kennisbank 301\n/:path/ /:path 301!\n/* /index.html 200\n", redirects);
    for (const slash of ["", "/"]) expect(text).toContain(`/${slug}${slash}    /kennisbank/${slug}    301`);
  });

  it("alle router- en seoRoutes-paden en bestaande redirects gaan voor", () => {
    const slugs = [...bestaandeRoutes(root), ...legacyRedirects.map((r) => r.from), "tv", "tv/", "TV", "radio", "services"];
    expect(rootArtikelRedirects(slugs.map((slug) => ({ slug })), root)).toEqual([]);
  });

  it("gegenereerde regels botsen niet met router of seoRoutes", () => {
    const sitemap = fs.readFileSync(path.join(root, "public/sitemap.xml"), "utf8");
    const articles = [...sitemap.matchAll(/<loc>https:\/\/zpzaken\.nl\/kennisbank\/([^<]+)<\/loc>/g)].map((m) => ({ slug: m[1] }));
    const routes = bestaandeRoutes(root);
    const generated = rootArtikelRedirects(articles, root);
    expect(generated.length).toBeGreaterThan(0);
    for (const redirect of generated) expect(routes.has(redirect.from)).toBe(false);
    // The build inserts this block; source _redirects is intentionally only the base rules.
    const output = voegArtikelRedirectsToe(fs.readFileSync(path.join(root, "public/_redirects"), "utf8"), generated);
    const block = output.match(/# BEGIN gegenereerde root-artikelredirects([\s\S]*?)# END gegenereerde root-artikelredirects/);
    expect(block).not.toBeNull();
    for (const match of (block?.[1] ?? "").matchAll(/^\/(\S+)\s+/gm)) {
      expect(routes.has(match[1].replace(/\/$/, "").toLowerCase())).toBe(false);
      expect(match[1].replace(/\/$/, "").toLowerCase()).not.toBe("tv");
    }
  });

  it("blok blijft uniek en vóór vangregels, ook na opnieuw genereren", () => {
    const input = fs.readFileSync(path.join(root, "public/_redirects"), "utf8");
    const redirects = rootArtikelRedirects([{ slug: "sbi-codes" }, { slug: "sbi-codes" }], root);
    const once = voegArtikelRedirectsToe(input, redirects);
    expect(voegArtikelRedirectsToe(once, redirects)).toBe(once);
    expect(once.indexOf("# BEGIN gegenereerde")).toBeLessThan(once.indexOf("/radio/*"));
  });
});
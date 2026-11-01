// @vitest-environment node
import { describe, expect, it } from "vitest";
import path from "node:path";
import { srcAssetUrls, zoekSrcAssetDoel } from "@/lib/srcAssetsRedirect";
import { zoekLegacyDoel } from "@/config/legacyRedirects";
import { navigeerLegacyBestand } from "@/components/shared/LegacyRedirect";
import { srcAssetBestanden, srcAssetsRedirectPlugin, srcAssetStubDoelen, srcAssetStubHtml } from "../../scripts/srcAssetsRedirects";

const root = process.cwd();
const bestanden = srcAssetBestanden(root);
const prefixes = ["", "en/", "de/", "fr/"];

describe("Structurele oude src/assets-adressen", () => {
  it("opent ook andere bronbestandsoorten met een volledige paginanavigatie", () => {
    const bezocht: string[] = [];
    expect(navigeerLegacyBestand("/assets/registry-hash.json", url => bezocht.push(url), true)).toBe(true);
    expect(bezocht).toEqual(["/assets/registry-hash.json"]);
  });
  it("neemt ieder bestaand bronbestand op, ook zonder gewone pagina-import", () => {
    expect(bestanden.length).toBeGreaterThan(0);
    expect(Object.keys(srcAssetUrls).sort()).toEqual(bestanden.map(file => `/${file}`).sort());
    for (const file of bestanden) {
      for (const prefix of prefixes) {
        for (const slash of ["", "/"]) {
          const bron = `/${prefix}${file}${slash}`;
          expect(zoekSrcAssetDoel(bron)).toBe(zoekLegacyDoel(bron) ?? srcAssetUrls[`/${file}`]);
          expect(zoekSrcAssetDoel(bron)).toBeTruthy();
        }
      }
    }
  });

  it("schrijft echte hosting-stubs naar het gehashte bestand voor ieder bronbestand en iedere taal", () => {
    const plugin = srcAssetsRedirectPlugin(root);
    const emitted: { type: string; fileName?: string; source?: unknown }[] = [];
    const context = {
      emitFile(asset: { type: string; fileName?: string; source?: unknown }) { emitted.push(asset); return String(emitted.length - 1); },
      getFileName(ref: string) { return `assets/${path.parse(bestanden[Number(ref)]).name}-testHash${path.extname(bestanden[Number(ref)])}`; },
    };
    const start = plugin.buildStart;
    const generate = plugin.generateBundle;
    if (typeof start !== "function" || typeof generate !== "function") throw new Error("Build hooks ontbreken");
    Reflect.apply(start, context, []);
    Reflect.apply(generate, context, []);
    expect(emitted.filter(file => !file.fileName)).toHaveLength(bestanden.length);
    expect(emitted.filter(file => file.fileName)).toHaveLength(bestanden.length * 4);
    bestanden.forEach((bron, index) => {
      for (const { from, to } of srcAssetStubDoelen(bron, `/${context.getFileName(String(index))}`)) {
        expect(emitted.find(file => file.fileName === `${from}/index.html`)?.source).toBe(srcAssetStubHtml(to));
        expect(srcAssetStubHtml(to)).toContain(`window.location.replace(${JSON.stringify(to)})`);
      }
    });
  });

  it("behoudt expliciete bestemmingen vóór de structurele bestandskaart", () => {
    for (const [file, doel] of [["ellen-baars-avatar.webp", "/over-ons"], ["partner-hiscox.webp", "/logos/hiscox.png"]]) {
      const bron = `src/assets/${file}`;
      const expliciet = zoekLegacyDoel(`/${bron}`);
      expect(expliciet).toBe(doel);
      for (const prefix of prefixes) {
        expect(zoekSrcAssetDoel(`/${prefix}${bron}/`)).toBe(expliciet);
      }
      expect(srcAssetStubDoelen(bron, "/assets/unused-hash.webp").every(rule => rule.to === expliciet)).toBe(true);
    }
  });

  it("verwijst verwijderde of onbekende bestanden en tv nooit naar een afbeelding", () => {
    const removed = `${["team", "walking"].join("-")}.webp`;
    for (const file of [removed, "bestaat-niet.webp"]) {
      expect(bestanden).not.toContain(`src/assets/${file}`);
      for (const prefix of prefixes) {
        for (const slash of ["", "/"]) expect(zoekSrcAssetDoel(`/${prefix}src/assets/${file}${slash}`)).toBeNull();
      }
    }
    for (const pad of ["/tv", "/tv/voorbeeld", "/assets/onbekend.webp", "/es/src/assets/ellen-baars-portrait.webp", "/src/assets/../config/site.ts"]) {
      expect(zoekSrcAssetDoel(pad)).toBeNull();
    }
  });
});
// @vitest-environment node
import { describe, expect, it } from "vitest";
import { geordendeRedirects, isVangregel, legacyRedirects, zoekLegacyDoel } from "@/config/legacyRedirects";
import { bestaandeRoutes } from "../../scripts/routeConflicts";
import { readFileSync } from "node:fs";
import path from "node:path";

const nieuwePaden = [
  ["bedankt-jaarlijks", "/verzekeringen"], ["product/screening-pakket-4", "/screening"],
  ["post/advies-zzp", "/kennisbank"], ["academy/partners", "/partners"], ["fr/portal/login", "/portal/login"],
  ["kennisbank/verplichte-aov-zzp", "/kennisbank/verplichte-aov-voor-zzp"],
  ["kennisbank/bav-afsluiten-zzp", "/kennisbank/bav-afsluiten-als-zzper-dit-is-waarom-en-hoe-je-het-regelt"],
  ["de/portal/login", "/portal/login"], ["academy/contact", "/contact"],
] as const;

const verwacht: Array<[string, string]> = [
  ["/vergelijken", "/bav-zzp-vergelijken"], ["/vergelijker/", "/bav-zzp-vergelijken"],
  ["/zoekresultaten", "/kennisbank"],
  ["/radio", "/"], ["/radio/show/de-gig-economy-volgens-leonard-millenaar", "/"],
  ["/radio/show/iets-anders", "/kennisbank"], ["/radio/uitzendingen/", "/kennisbank"], ["/radio/guests/jan", "/kennisbank"],
  ["/checkout", "/verzekeringen"], ["/winkelwagen", "/verzekeringen"],
  ["/services", "/"], ["/services/advies", "/diensten"], ["/services/bav", "/verzekeringen"], ["/services/contact", "/contact"],
  ["/services/bancair-sparen", "/diensten"], ["/services/bav/aanmelden", "/verzekeringen#combinatiepolis"],
  ["/services/aov", "/aov"], ["/services/aov/", "/aov"], ["/services/faq", "/faq"],
  ["/services/juridisch-advies", "/diensten"], ["/services/zorg-verzekering/", "/zorgverzekering"],
  ["/services/iets/onbekends", "/diensten"],
  ["/financien/pensioengat-reserveringsruimte-berekenen", "/pensioen"],
  ["/product/screening-pakket-1", "/screening"], ["/product/screening-pakket-2", "/screening"], ["/product/screening-pakket-3/", "/screening"],
  ["/about", "/over-ons"], ["/policies/refund-policy", "/algemene-voorwaarden"],
];

describe("A16 doorverwijzingen", () => {
  it.each(nieuwePaden)("16 oktober: %s naar %s, inclusief afsluitende slash en 301-uitvoer", (van, naar) => {
    expect(zoekLegacyDoel(`/${van}`)).toBe(naar);
    expect(zoekLegacyDoel(`/${van}/`)).toBe(naar);
    const root = path.resolve(__dirname, "../..");
    expect(bestaandeRoutes(root).has(naar.slice(1))).toBe(true);
    expect(readFileSync(path.join(root, "public/_redirects"), "utf8")).toContain(`/${van}    ${naar}    301`);
    const csv = readFileSync(path.join(root, "docs/cloudflare-bulk-redirects.csv"), "utf8");
    for (const slash of ["", "/"]) expect(csv).toContain(`zpzaken.nl/${van}${slash},https://zpzaken.nl${naar},301,`);
  });

  it("laat Evi-paden en /tv ongemoeid", () => {
    for (const p of ["/zzp-pensioen-via-evi", "/pensioen-opbouwen-zzp", "/tv", "/tv/"]) expect(zoekLegacyDoel(p)).toBeNull();
  });
  it.each(verwacht)("%s → %s", (van, naar) => expect(zoekLegacyDoel(van)).toBe(naar));

  it("geen regel voor /tv en bestaande routes", () => {
    for (const p of ["/tv", "/scherm", "/diensten", "/verzekeringen", "/offerte", "/voorwaarden"]) expect(zoekLegacyDoel(p)).toBeNull();
  });

  it("vangregels staan na alle specifieke regels", () => {
    const g = geordendeRedirects();
    const eersteVang = g.findIndex(isVangregel);
    expect(eersteVang).toBeGreaterThan(0);
    expect(g.slice(eersteVang).every(isVangregel)).toBe(true);
    const bron = legacyRedirects.map((r) => r.from);
    for (const s of ["services", "services/advies", "services/bav", "services/aov", "radio"]) expect(bron.indexOf(s)).toBeLessThan(bron.indexOf(s.startsWith("radio") ? "radio/*" : "services/*"));
  });
});

describe("kantoor-tv nooit doorverwezen", () => {
  it("geen tv-bron in legacyRedirects en _redirects", async () => {
    const { legacyRedirects } = await import("@/config/legacyRedirects");
    for (const r of legacyRedirects) expect(["tv", "tv/*", "tv/"]).not.toContain(r.from.replace(/^\//, ""));
    const fs = await import("fs");
    const red = fs.readFileSync(new URL("../../public/_redirects", import.meta.url), "utf8");
    for (const regel of red.split("\n")) expect(regel.trim()).not.toMatch(/^\/tv(\/|\*|\s)/);
  });
  it("nieuwe A16-regels uit 15 okt", async () => {
    const { legacyRedirects } = await import("@/config/legacyRedirects");
    const doel = (f: string) => legacyRedirects.find((r) => r.from === f)?.to;
    expect(doel("kerstactiemember")).toBe("/verzekeringen");
    expect(doel("beroepsaansprakelijkheids")).toBe("/verzekeringen");
    expect(doel("account/my-account")).toBe("/mijn-zp/polis");
    expect(doel("factoring")).toBe("/diensten");
  });
});


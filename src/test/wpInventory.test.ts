import { existsSync } from "node:fs";
import { describe, it, expect } from "vitest";
import inventaris from "./fixtures/wpInventory.json";
import { legacyRedirects } from "../config/legacyRedirects";
import { seoRoutes } from "../config/seoRoutes";

const routes = new Set(seoRoutes.map((r) => r.path.replace(/^\//, "")));
const redirects = new Map(legacyRedirects.map((r) => [r.from, r.to]));
// Mijn ZP-pagina's staan niet in seoRoutes (geen index), maar zijn wel routes.
const appRoutes = new Set([...routes, "", "kennisbank", "offerte", "mijn-zp/polis", "mijn-zp/opzeggen", "mijn-zp/pauzeren", "mijn-zp/certificaat", "mijn-zp/documenten"]);

function geldigeBestemming(to: string): boolean {
  const pad = to.split("#")[0].replace(/^\//, "");
  // Bestaand statisch bestand in public/ (bijv. een pdf) is ook een geldige bestemming.
  if (/\.[a-z0-9]+$/i.test(pad) && existsSync(`public/${pad}`)) return true;
  return pad === "" || pad === "en" || appRoutes.has(pad) || /^kennisbank\/[a-z0-9-]+$/.test(pad);
}

describe("oude WordPress-URL's", () => {
  it.each((inventaris as { paden: string[] }).paden)("/%s heeft een route of redirect", (pad) => {
    const lokaal = pad.startsWith("en/") ? pad.slice(3) : pad;
    const isRoute = appRoutes.has(pad) || appRoutes.has(lokaal);
    expect(isRoute || redirects.has(pad)).toBe(true);
  });

  it("elke redirect wijst naar een bestaande pagina en nooit via een tweede redirect", () => {
    for (const { from, to } of legacyRedirects) {
      expect(geldigeBestemming(to), `${from} → ${to}`).toBe(true);
      expect(redirects.has(to.replace(/^\//, "").split("#")[0]), `keten bij ${from}`).toBe(false);
    }
  });

  it("frontend- en serverlijst zijn gelijk", async () => {
    const fs = await import("node:fs");
    const blok = (f: string) => {
      const s = fs.readFileSync(f, "utf8");
      const a = s.indexOf("[", s.indexOf("export const legacyRedirects"));
      return s.slice(a, s.indexOf("\n];", a));
    };
    expect(blok("supabase/functions/_shared/legacyRedirects.ts")).toBe(blok("src/config/legacyRedirects.ts"));
  });
});

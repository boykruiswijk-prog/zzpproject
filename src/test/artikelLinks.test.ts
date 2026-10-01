// @vitest-environment node
// Linkcheck: alle interne links in gepubliceerde artikelinhoud moeten naar een
// bestaande route, een gepubliceerde artikel-slug of een legacy-doorverwijzing gaan.
import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { seoRoutes } from "@/config/seoRoutes";
import { legacyRedirects } from "@/config/legacyRedirects";

const env = (k: string) => process.env[k] || "";
const base = env("VITE_SUPABASE_URL");
const key = env("VITE_SUPABASE_PUBLISHABLE_KEY") || env("VITE_SUPABASE_ANON_KEY");

/** Statische paden uit App.tsx (zonder parameters). */
function appRoutes(): Set<string> {
  const app = fs.readFileSync(path.resolve(__dirname, "../App.tsx"), "utf8");
  const set = new Set<string>(["/"]);
  for (const m of app.matchAll(/<Route path="([^"]+)"/g)) {
    if (m[1].includes(":") || m[1] === "*") continue;
    set.add(m[1].startsWith("/") ? m[1] : `/${m[1]}`);
  }
  return set;
}

export function interneLinks(markdown: string): string[] {
  const out: string[] = [];
  for (const m of markdown.matchAll(/\]\(([^)\s]+)/g)) {
    let href = m[1];
    href = href.replace(/^https?:\/\/(www\.)?zpzaken\.nl/i, "");
    if (!href.startsWith("/") || href.startsWith("//")) continue;
    out.push(href.split(/[?#]/)[0].replace(/\/$/, "") || "/");
  }
  return out;
}

describe("doorverwijzingen voor oude interne paden", () => {
  const verwacht: Record<string, string> = {
    zorgverzekering: "/kennisbank/zorgverzekering-2025-voor-zzpers-zorgeloos-zzpen",
    "mentale-gezondheid": "/kennisbank/zorgverzekering-2025-voor-zzpers-zorgeloos-zzpen",
    pensioen: "/kennisbank/jaarruimte-en-reserveringsruimte",
    partners: "/over-ons",
    "bav-avb": "/verzekeringen",
    "moneysure-aov-alternatief": "/aov",
  };
  const routes = appRoutes();
  for (const [from, to] of Object.entries(verwacht)) {
    it(`/${from} → ${to}`, () => {
      expect(legacyRedirects.find((r) => r.from === from)?.to).toBe(to);
      // Geen eigen route meer, anders schrijft de prerender geen doorverwijzing.
      expect(routes.has(`/${from}`)).toBe(false);
      expect(seoRoutes.some((r) => r.path === `/${from}`)).toBe(false);
    });
  }
});

describe.skipIf(!base || !key)("interne links in artikelinhoud", () => {
  it("verwijzen allemaal naar een bestaande pagina", async () => {
    const res = await fetch(`${base}/rest/v1/articles?select=slug,content&is_published=eq.true&limit=1000`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    const articles = (await res.json()) as Array<{ slug: string; content: string | null }>;
    const ok = appRoutes();
    for (const r of seoRoutes) ok.add(r.path);
    for (const a of articles) ok.add(`/kennisbank/${a.slug}`);
    for (const r of legacyRedirects) ok.add(`/${r.from}`);
    const kapot: string[] = [];
    for (const a of articles) {
      for (const href of interneLinks(a.content || "")) {
        const clean = href.replace(/^\/(en|de|fr)(?=\/|$)/, "") || "/";
        if (clean.startsWith("/wp-content/") || /\.(pdf|png|jpe?g|webp|svg)$/i.test(clean)) continue;
        if (!ok.has(clean)) kapot.push(`${a.slug} → ${href}`);
      }
    }
    expect(kapot).toEqual([]);
  }, 30000);
});

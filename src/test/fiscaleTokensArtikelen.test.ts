// @vitest-environment node
// Alle gepubliceerde artikelen: na tokenvervanging en markdown-render mag er
// nergens nog "{{" staan. Plus controle van de fiscale kernwaarden 2026.
import { describe, expect, it } from "vitest";
import { resolveFiscaleTokens, resolveFiscaalToken } from "@/lib/fiscaleTokens";
import { getFiscaalCijfer } from "@/data/fiscaleCijfers";

const env = (k: string) => process.env[k] || "";
const base = env("VITE_SUPABASE_URL");
const key = env("VITE_SUPABASE_PUBLISHABLE_KEY") || env("VITE_SUPABASE_ANON_KEY");

describe("fiscale waarden 2026", () => {
  const verwacht: Record<string, number> = {
    zelfstandigenaftrek: 1200,
    zelfstandigenaftrekAowLeeftijd: 600,
    startersaftrek: 2123,
    mkbWinstvrijstelling: 12.7,
    kilometeraftrekOndernemer: 0.25,
    bijtellingStandaardtarief: 22,
    bijtellingVerlaagdTarief: 18,
    bijtellingDrempelCataloguswaarde: 30000,
    bijtellingYoungtimerLeeftijd: 16,
    schijf1Tarief: 35.75,
    schijf1Grens: 38883,
    schijf2Tarief: 37.56,
    schijf2Grens: 78426,
    schijf3Tarief: 49.5,
    maximaleReserveringsruimte: 42753,
    korOmzetgrens: 20000,
  };
  for (const [k, v] of Object.entries(verwacht)) {
    it(k, () => {
      const c = getFiscaalCijfer(k);
      expect(c?.waarde).toBe(v);
      expect(c?.belastingjaar).toBe(2026);
    });
  }
  it("vult beide tokenvormen in", () => {
    expect(resolveFiscaleTokens("{{fiscaal:startersaftrek}}")).toBe("€ 2.123 (2026)");
    expect(resolveFiscaleTokens("{{fiscaal:startersaftrek:waarde}}")).toBe("€ 2.123");
    expect(resolveFiscaalToken("bestaatNiet")).toBeNull();
  });
});

describe.skipIf(!base || !key)("gepubliceerde artikelen", () => {
  it("bevatten na rendering geen ruwe {{...}}", async () => {
    const res = await fetch(
      `${base}/rest/v1/articles?select=slug,title,excerpt,content,seo_title,seo_description&is_published=eq.true&limit=1000`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } },
    );
    const articles = (await res.json()) as Array<Record<string, string | null>>;
    expect(articles.length).toBeGreaterThan(0);
    const fout: string[] = [];
    for (const a of articles) {
      for (const veld of ["title", "excerpt", "seo_title", "seo_description"]) {
        if (resolveFiscaleTokens(a[veld]).includes("{{")) fout.push(`${a.slug}.${veld}`);
      }
      const m = resolveFiscaleTokens(a.content).match(/\{\{[^}]{0,60}/);
      if (m) fout.push(`${a.slug}: ${m[0]}`);
    }
    expect(fout).toEqual([]);
  }, 30000);
});

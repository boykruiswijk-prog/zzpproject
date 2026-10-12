// @vitest-environment node
import { describe, expect, it } from "vitest";
import { articleSchema } from "@/lib/schema";
import { SITE_CONFIG } from "@/config/site";

describe("Article actualiteit voor zoekmachines", () => {
  it("bevat publicatie- en wijzigingsdatum, auteur en uitgever", () => {
    const schema = articleSchema({
      title: "Testartikel",
      description: "Testbeschrijving",
      slug: "testartikel",
      datePublished: "2026-10-06T08:00:00.000Z",
      dateModified: "2026-10-12T12:00:00.000Z",
    });

    expect(schema.datePublished).toBe("2026-10-06T08:00:00.000Z");
    expect(schema.dateModified).toBe("2026-10-12T12:00:00.000Z");
    expect(schema.author).toEqual({
      "@type": "Organization",
      name: "ZP Zaken",
      url: SITE_CONFIG.url,
    });
    expect(schema.publisher).toEqual({
      "@type": "Organization",
      name: "ZP Zaken",
      url: SITE_CONFIG.url,
      logo: { "@type": "ImageObject", url: SITE_CONFIG.logo },
    });
  });

  it("gebruikt updated_at in client, prerender en sitemap", () => {
    const detail = Bun.file("src/pages/ArtikelDetail.tsx");
    const prerender = Bun.file("scripts/prerender.ts");
    const sitemap = Bun.file("supabase/functions/sitemap/index.ts");
    return Promise.all([detail.text(), prerender.text(), sitemap.text()]).then(([detailText, prerenderText, sitemapText]) => {
      expect(detailText).toContain("const updatedAt = article.updated_at || publishedAt");
      expect(detailText).toContain('<meta property="og:updated_time" content={updatedAt} />');
      expect(prerenderText).toContain("articleModifiedTime: dateModified");
      expect(prerenderText).toContain("const lastmod = (a.updated_at || a.published_at");
      expect(sitemapText).toContain("updated_at ?? (a as any).published_at");
    });
  });
});
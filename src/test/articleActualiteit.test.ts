// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { articleSchema } from "@/lib/schema";
import { SITE_CONFIG } from "@/config/site";
import { buildHtml } from "../../scripts/prerender";

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
    const detailText = readFileSync("src/pages/ArtikelDetail.tsx", "utf8");
    const prerenderText = readFileSync("scripts/prerender.ts", "utf8");
    const sitemapText = readFileSync("supabase/functions/sitemap/index.ts", "utf8");
    expect(detailText).toContain("const updatedAt = article.updated_at || publishedAt");
    expect(detailText).toContain('<meta property="og:updated_time" content={updatedAt} />');
    expect(prerenderText).toContain("articleModifiedTime: dateModified");
    expect(prerenderText).toContain("const lastmod = (a.updated_at || a.published_at");
    expect(sitemapText).toContain("updated_at ?? (a as any).published_at");
  });

  it("zet de gewijzigde datum en volledige Article-JSON-LD in voorgerenderde HTML", () => {
    const datePublished = "2026-10-06T08:00:00.000Z";
    const dateModified = "2026-10-12T12:00:00.000Z";
    const schema = articleSchema({
      title: "Testartikel",
      description: "Testbeschrijving",
      slug: "testartikel",
      datePublished,
      dateModified,
    });
    const html = buildHtml(
      '<html><head><title>Oud</title><meta name="description" content="Oud" /><meta property="og:title" content="Oud" /><meta property="og:description" content="Oud" /><meta property="og:url" content="https://zpzaken.nl/" /><meta property="og:type" content="website" /></head><body><div id="root"></div></body></html>',
      {
        routePath: "/kennisbank/testartikel",
        title: "Testartikel | ZP Zaken",
        description: "Testbeschrijving",
        ogType: "article",
        schemas: [schema],
        fallback: "<article>Test</article>",
        articlePublishedTime: datePublished,
        articleModifiedTime: dateModified,
      },
    );

    expect(html).toContain(`property="article:modified_time" content="${dateModified}"`);
    expect(html).toContain(`property="og:updated_time" content="${dateModified}"`);
    const json = html.match(/<script type="application\/ld\+json">([^<]+)<\/script>/)?.[1];
    const parsed = JSON.parse(json ?? "{}") as Record<string, unknown>;
    expect(parsed).toMatchObject({
      "@type": "Article",
      datePublished,
      dateModified,
      author: { "@type": "Organization", name: "ZP Zaken", url: SITE_CONFIG.url },
    });
  });
});
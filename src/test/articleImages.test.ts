// @vitest-environment node
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { articleImage, absoluteArticleImage } from "../lib/articleImage";
import { renderArticleImage } from "../../scripts/articleImages";
import { buildHtml } from "../../scripts/prerender";
import { articleSchema } from "../lib/schema";

describe("automatische artikelafbeeldingen", () => {
  const article = { slug: "opdrachtgever-eist-bav", title: "Opdrachtgever eist een BAV: wat moet je regelen?", category: "Verzekeringen", image_url: null };
  it("behoudt bestaande afbeeldingen en maakt fallback-URLs absoluut", () => {
    expect(articleImage({ ...article, image_url: "/bestaand.png" })).toBe("/bestaand.png");
    expect(absoluteArticleImage(article)).toBe("https://zpzaken.nl/images/kennisbank/opdrachtgever-eist-bav.png");
  });
  it("rendert een echte PNG van 1200x630, ook voor lange titels", async () => {
    for (const title of [article.title, "Een lange titel met veel woorden ".repeat(20)]) {
      const png = await renderArticleImage({ ...article, title }, path.resolve("."));
      expect(png.subarray(1, 4).toString()).toBe("PNG");
      expect(png.readUInt32BE(16)).toBe(1200);
      expect(png.readUInt32BE(20)).toBe(630);
    }
  });
  it("gebruikt dezelfde afbeelding in prerender OG, Twitter en JSON-LD", () => {
    const image = absoluteArticleImage(article);
    const html = buildHtml(fs.readFileSync("index.html", "utf8"), {
      routePath: `/kennisbank/${article.slug}`, title: article.title, description: "Test", ogType: "article",
      image, generatedImage: true, fallback: "",
      schemas: [articleSchema({ title: article.title, description: "Test", slug: article.slug, datePublished: "2026-10-06", image })],
    });
    expect(html).toContain(`property="og:image" content="${image}"`);
    expect(html).toContain(`name="twitter:image" content="${image}"`);
    expect(html).toContain(`"image":["${image}"]`);
    expect(html).toContain('property="og:image:width" content="1200"');
    expect(html).toContain('property="og:image:height" content="630"');
    expect(html).toContain('property="og:image:type" content="image/png"');
  });
  it("zet statische afbeeldingsregels voor de SPA-fallback", () => {
    const config = fs.readFileSync("vite.config.ts", "utf8");
    expect(config.indexOf('/images/kennisbank/*    /images/kennisbank/:splat    200')).toBeLessThan(config.indexOf('/*    /index.html    200'));
  });
});
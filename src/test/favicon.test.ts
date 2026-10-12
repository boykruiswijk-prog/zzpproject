// @vitest-environment node
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { buildHtml, redirectStubHtml } from "../../scripts/prerender";

const template = fs.readFileSync("index.html", "utf8");
const files = ["favicon.ico", "favicon-48x48.png", "favicon-192x192.png", "apple-touch-icon.png"];

function checkHead(html: string) {
  const icons = html.match(/<link\b[^>]*rel="(?:icon|apple-touch-icon|manifest)"[^>]*>/g) ?? [];
  expect(icons).toHaveLength(5);
  expect(icons.join(" ")).not.toMatch(/lovable|gpt-engineer/i);
  for (const file of files) expect(icons.join(" ")).toContain(`href="/${file}"`);
  expect(icons.join(" ")).toContain('sizes="48x48"');
  expect(icons.join(" ")).toContain('sizes="192x192"');
  const social = html.match(/<meta\b[^>]*(?:og:image|twitter:image)[^>]*>/g) ?? [];
  expect(social.join(" ")).not.toMatch(/lovable|gpt-engineer/i);
}

describe("ZP Zaken site-iconen", () => {
  it("gebruikt uitsluitend eigen iconen en deelafbeeldingen in de head", () => checkHead(template));
  it("bewaart de volledige set op prerenderpagina’s en doorverwijspagina’s", () => {
    checkHead(buildHtml(template, { routePath: "/contact", title: "Contact | ZP Zaken", description: "Contact", ogType: "website", schemas: [], fallback: "Contact" }));
    checkHead(redirectStubHtml("oud", "/contact"));
  });
  it("heeft echte ICO-frames van 16, 32 en 48 pixels", () => {
    const ico = fs.readFileSync("public/favicon.ico");
    expect(ico.readUInt16LE(0)).toBe(0);
    expect(ico.readUInt16LE(2)).toBe(1);
    expect(ico.readUInt16LE(4)).toBe(3);
    const sizes = [0, 1, 2].map((i) => [ico[6 + i * 16], ico[7 + i * 16]]);
    expect(sizes).toEqual([[16, 16], [32, 32], [48, 48]]);
  });
  it("bevat alle bestanden, vierkante PNGs en de juiste manifestnaam", () => {
    for (const file of files) expect(fs.existsSync(`public/${file}`)).toBe(true);
    for (const [file, size] of [["favicon-48x48.png", 48], ["favicon-192x192.png", 192], ["apple-touch-icon.png", 180]] as const) {
      const png = fs.readFileSync(`public/${file}`);
      expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
      expect(png.readUInt32BE(16)).toBe(size);
      expect(png.readUInt32BE(20)).toBe(size);
    }
    const manifest = JSON.parse(fs.readFileSync("public/site.webmanifest", "utf8"));
    expect(manifest.name).toBe("ZP Zaken");
    expect(manifest.short_name).toBe("ZP Zaken");
    for (const icon of manifest.icons) {
      expect(fs.existsSync(`public${icon.src}`)).toBe(true);
      expect(icon.src).not.toMatch(/lovable/i);
    }
  });
});
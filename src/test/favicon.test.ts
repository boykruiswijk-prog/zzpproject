// @vitest-environment node
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { buildHtml, redirectStubHtml } from "../../scripts/prerender";

const template = fs.readFileSync("index.html", "utf8");
const version = "?v=20261015";
const expected = [
  '<link rel="icon" href="/favicon.ico?v=20261015" sizes="48x48" />',
  '<link rel="icon" type="image/svg+xml" href="/favicon.svg?v=20261015" />',
  '<link rel="icon" type="image/png" sizes="48x48" href="/favicon-48x48.png?v=20261015" />',
  '<link rel="icon" type="image/png" sizes="96x96" href="/favicon-96x96.png?v=20261015" />',
  '<link rel="icon" type="image/png" sizes="192x192" href="/favicon-192x192.png?v=20261015" />',
  '<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png?v=20261015" />',
  '<link rel="manifest" href="/site.webmanifest?v=20261015" />',
];
const files = ["favicon.ico", "favicon.svg", "favicon.png", ...[48, 96, 192, 512].map(s => `favicon-${s}x${s}.png`), "apple-touch-icon.png", "site.webmanifest", "manifest.json"];
function checkHead(html: string) {
  const icons = html.match(/<link\b[^>]*rel="(?:icon|shortcut icon|apple-touch-icon|manifest)"[^>]*>/g) ?? [];
  expect(icons).toEqual(expected);
  expect(icons.join(" ")).not.toMatch(/lovable|gpt-engineer/i);
  expect(html).toContain('<meta name="theme-color" content="#ffffff" />');
  const social = html.match(/<meta\b[^>]*(?:og:image|twitter:image)[^>]*>/g) ?? [];
  expect(social.join(" ")).not.toMatch(/lovable|gpt-engineer/i);
  expect(social.join(" ")).toContain("https://zpzaken.nl/og/zpzaken-og-2026.jpg");
}
function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(file) : /\.(html|ts|tsx|json|webmanifest)$/.test(file) ? [file] : [];
  });
}

describe("ZP Zaken site-iconen", () => {
  it("gebruikt exact de zeven versiegebonden links in de hoofdpagina", () => checkHead(template));
  it("bewaart dezelfde zeven links in prerender- en doorverwijspagina's", () => {
    checkHead(buildHtml(template, { routePath: "/contact", title: "Contact | ZP Zaken", description: "Contact", ogType: "website", schemas: [], fallback: "Contact" }));
    checkHead(redirectStubHtml("oud", "/contact"));
  });
  it("heeft nergens vreemde icoonlinks of deelafbeeldingen", () => {
    for (const file of ["public", "src", "scripts", "supabase/functions"].flatMap(walk)) {
      const text = fs.readFileSync(file, "utf8");
      const links = text.match(/<link\b[^>]*>/gi) ?? [];
      for (const link of links.filter(tag => /rel\s*=\s*["'](?:icon|shortcut icon|apple-touch-icon|manifest)["']/i.test(tag))) {
        expect(link, file).not.toMatch(/href\s*=\s*["'][^"']*(?:lovable|gpt-engineer)/i);
      }
      const social = text.match(/<meta\b[^>]*(?:og:image|twitter:image)[^>]*>/g) ?? [];
      expect(social.join(" "), file).not.toMatch(/content\s*=\s*["'][^"']*(?:lovable|gpt-engineer)/i);
    }
  });
  it("heeft echte ICO-frames van 16, 32 en 48 pixels", () => {
    const ico = fs.readFileSync("public/favicon.ico");
    expect(ico.readUInt16LE(0)).toBe(0);
    expect(ico.readUInt16LE(2)).toBe(1);
    expect(ico.readUInt16LE(4)).toBe(3);
    expect([0, 1, 2].map(i => [ico[6 + i * 16], ico[7 + i * 16]])).toEqual([[16, 16], [32, 32], [48, 48]]);
  });
  it("heeft vierkante PNG's met de juiste maten en een ondoorzichtig Apple-icoon", () => {
    for (const file of files) expect(fs.existsSync(`public/${file}`), file).toBe(true);
    for (const [file, size] of [...[48, 96, 192, 512].map(s => [`favicon-${s}x${s}.png`, s] as const), ["apple-touch-icon.png", 180], ["favicon.png", 192]] as const) {
      const png = fs.readFileSync(`public/${file}`);
      expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
      expect(png.readUInt32BE(16)).toBe(size);
      expect(png.readUInt32BE(20)).toBe(size);
      if (file === "apple-touch-icon.png") expect(png[25]).toBe(2);
    }
  });
  it("bevat een SVG met exact de ingesloten 512px-versie", () => {
    const svg = fs.readFileSync("public/favicon.svg", "utf8");
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" viewBox="0 0 512 512">/);
    expect(svg).toContain(`href="data:image/png;base64,${fs.readFileSync("public/favicon-512x512.png").toString("base64")}"`);
    expect(svg.trim()).toMatch(/<\/svg>$/);
  });
  it("heeft gelijke manifesten met versiegebonden 192-, 512- en 48px-iconen", () => {
    expect(fs.readFileSync("public/manifest.json", "utf8")).toBe(fs.readFileSync("public/site.webmanifest", "utf8"));
    const manifest = JSON.parse(fs.readFileSync("public/site.webmanifest", "utf8"));
    expect(manifest.name).toBe("ZP Zaken");
    expect(manifest.short_name).toBe("ZP Zaken");
    expect(JSON.stringify(manifest)).not.toMatch(/lovable|gpt-engineer/i);
    expect(manifest.icons.map((icon: { sizes: string }) => icon.sizes)).toEqual(["192x192", "512x512", "48x48"]);
    for (const icon of manifest.icons) {
      expect(icon.purpose).toBe("any");
      expect(icon.src).toEndWith(version);
      expect(fs.existsSync(`public${icon.src.split("?")[0]}`)).toBe(true);
    }
  });
  it("verschilt byte voor byte van het historische Lovable-icoon", (context) => {
    let old: Buffer;
    try { old = execFileSync("git", ["show", "9eb13a0d:public/favicon.ico"], { stdio: ["ignore", "pipe", "pipe"] }); }
    catch { console.warn("Historische faviconcontrole overgeslagen: commit 9eb13a0d of git niet beschikbaar."); context.skip(); return; }
    for (const file of files.filter(name => /\.(ico|png|svg)$/.test(name))) expect(fs.readFileSync(`public/${file}`).equals(old), file).toBe(false);
  });
  it("serveert statische iconen vóór de niet-geforceerde SPA-fallback, zonder icoonredirects", () => {
    const redirects = fs.readFileSync("public/_redirects", "utf8");
    const rules = redirects.split("\n").map(line => line.trim()).filter(line => line && !line.startsWith("#"));
    expect(rules.at(-1)).toMatch(/^\/\*\s+\/index.html\s+200$/);
    for (const rule of rules.slice(0, -1)) {
      const source = rule.split(/\s+/)[0];
      const pattern = new RegExp(`^${source.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/:[a-z]+/g, "[^/]+").replace(/\*/g, ".*")}$`);
      for (const file of files) expect(pattern.test(`/${file}`), rule).toBe(false);
    }
    expect(redirects).toContain("hosting serveert ze vóór de SPA-fallback");
    expect(fs.readFileSync("vite.config.ts", "utf8")).toContain("hosting serveert ze vóór de SPA-fallback");
  });
  it("ververst iconen en manifesten binnen een dag zonder immutable", () => {
    const headers = fs.readFileSync("public/_headers", "utf8");
    for (const route of ["/favicon.ico", "/favicon.svg", "/favicon-*.png", "/apple-touch-icon.png", "/site.webmanifest", "/manifest.json"]) {
      expect(headers).toContain(`${route}\n  Cache-Control: public, max-age=86400`);
    }
    expect(headers).not.toContain("immutable");
  });
});

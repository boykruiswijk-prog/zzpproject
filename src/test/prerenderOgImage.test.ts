// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { prerender } from "../../scripts/prerender";
import { SITE_CONFIG } from "@/config/site";

const created: string[] = [];

afterEach(() => {
  for (const dir of created.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

function allIndexFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? allIndexFiles(full) : entry.name === "index.html" ? [full] : [];
  });
}

describe("Open Graph-afbeelding in prerender", () => {
  it("gebruikt op iedere gegenereerde pagina een absolute URL naar een bestaand bestand", async () => {
    const dist = fs.mkdtempSync(path.join(os.tmpdir(), "zp-og-prerender-"));
    created.push(dist);
    fs.copyFileSync(path.resolve("index.html"), path.join(dist, "index.html"));

    await prerender(dist, {});

    const pages = allIndexFiles(dist);
    expect(pages.length).toBeGreaterThan(1);
    for (const page of pages) {
      const html = fs.readFileSync(page, "utf8");
      const match = html.match(/<meta property="og:image" content="([^"]+)"/);
      expect(match, page).not.toBeNull();
      const imageUrl = new URL(match?.[1] ?? "");
      expect(imageUrl.origin, page).toBe(SITE_CONFIG.url);
      expect(fs.existsSync(path.resolve("public", imageUrl.pathname.slice(1))), page).toBe(true);
    }
  }, 180000);
});
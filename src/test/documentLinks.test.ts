// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { legacyRedirects } from "../config/legacyRedirects";

// Elke /documenten/*.pdf-link in src en in de edge functions moet bestaan in public/documenten.
function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|md|html)$/.test(n)) out.push(p);
  }
  return out;
}

describe("documentlinks", () => {
  it("alle /documenten/*.pdf-links bestaan", () => {
    const files = [...walk("src"), ...walk("supabase/functions"), "index.html"];
    const broken: string[] = [];
    for (const f of files) {
      if (f.endsWith("documentLinks.test.ts")) continue;
      const txt = readFileSync(f, "utf8");
      for (const m of txt.matchAll(/\/documenten\/([^"'`\s)<>]+?\.pdf)/g)) {
        if (!existsSync(join("public/documenten", decodeURIComponent(m[1])))) broken.push(`${f}: ${m[0]}`);
      }
    }
    expect(broken).toEqual([]);
  });

  it("beide korte polisvoorwaardenlinks komen uit bij de branchekaarten", () => {
    const target = "/documenten#verzekeringsvoorwaarden";
    const rules = readFileSync("public/_redirects", "utf8");
    const page = readFileSync("src/pages/Documenten.tsx", "utf8");
    for (const from of ["voorwaarden", "polisvoorwaarden"]) {
      expect(legacyRedirects.find((redirect) => redirect.from === from)?.to).toBe(target);
      expect(rules).toContain(`/${from}    ${target}    301`);
    }
    expect(page).toContain('id="verzekeringsvoorwaarden"');
  });
});

import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// Token opgebouwd uit delen, zodat dit testbestand het zelf niet bevat.
const TOKEN = ["VJQZ-6EVO02DGs8fTtIQ7", "QMMtkg4XanhaooPJoadt8o"].join("");
const OVERSLAAN = new Set(["node_modules", ".git", ".lovable"]);

function bestanden(dir: string, uit: string[] = []): string[] {
  if (!existsSync(dir)) return uit;
  for (const n of readdirSync(dir)) {
    if (OVERSLAAN.has(n)) continue;
    const p = join(dir, n);
    const s = statSync(p);
    if (s.isDirectory()) bestanden(p, uit);
    else if (s.size < 5_000_000) uit.push(p);
  }
  return uit;
}

describe("oude Search Console-koppeling vorig bureau", () => {
  it("token staat nergens in broncode, public, scripts of build", () => {
    const lijst = [
      "index.html",
      ...["src", "public", "scripts", "supabase", "dist"].flatMap((d) => bestanden(d)),
    ];
    const treffers = lijst.filter((f) => existsSync(f) && readFileSync(f, "utf8").includes(TOKEN));
    expect(treffers).toEqual([]);
  });

  it("eigen verificatiebestand blijft bestaan", () => {
    expect(existsSync("public/googlede44f7e9b27c2920.html")).toBe(true);
  });
});

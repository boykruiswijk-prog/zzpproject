import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { seoRoutes } from "@/config/seoRoutes";
import { buildLlmsTxt, buildLlmsFullTxt } from "../../scripts/llmsTxt";
import { legacyRedirects } from "@/config/legacyRedirects";

const VERBODEN = ["beschermt jou", "beschermen je bij", "Beschermd bij fouten", "Kies wat het beste bij je past"];

function bestanden(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return /admin|test/.test(n) ? [] : bestanden(p);
    return /\.(tsx?|json)$/.test(n) && !/\.test\./.test(n) ? [p] : [];
  });
}

describe("kwaliteitscontrole 27-10", () => {
  const bronnen: [string, string][] = [
    ...[...bestanden("src/pages"), ...bestanden("src/components"), ...bestanden("src/i18n"), ...bestanden("src/config"), ...bestanden("src/data")]
      .map((f) => [f, readFileSync(f, "utf8")] as [string, string]),
    ["seoRoutes", JSON.stringify(seoRoutes)],
    ["llms.txt", buildLlmsTxt(seoRoutes, [])],
    ["llms-full.txt", buildLlmsFullTxt(seoRoutes, [])],
    ["zekerKennis", readFileSync("supabase/functions/_shared/zekerKennis.generated.ts", "utf8")],
  ];
  for (const zin of VERBODEN) {
    it(`bevat nergens "${zin}"`, () => {
      expect(bronnen.filter(([, t]) => t.includes(zin)).map(([f]) => f)).toEqual([]);
    });
  }
  it("/privacybeleid verwijst met 301 naar de privacypagina", () => {
    expect(legacyRedirects.find((r) => r.from === "privacybeleid")?.to).toBe("/cookies");
    expect(legacyRedirects.some((r) => r.from === "tv")).toBe(false);
  });
});

// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { seoRoutes } from "@/config/seoRoutes";
import { buildLlmsTxt, buildLlmsFullTxt } from "../../scripts/llmsTxt";
import { bouwZekerKennis } from "@/lib/zeker/bouwKennis";

const oudeFormuleringen = [
  "(cyberfraude €1.000) Hulp",
  "Twijfel je welke BAV bij je past",
  "Twijfel je of de polis past",
  "kijken we bij je aanvraag even mee",
  "dan helpt een BAV en AVB",
  "automatisch gedekt",
  "passende oplossing voor een BV",
  "passend voorstel",
  "Als adviseur zit het risico",
];

function bestanden(map: string): string[] {
  return readdirSync(map, { withFileTypes: true }).flatMap((item) => {
    const pad = resolve(map, item.name);
    if (item.isDirectory()) return item.name === "test" || item.name === "__tests__" ? [] : bestanden(pad);
    return /\.(tsx?|json|md|txt)$/.test(item.name) && !/\.(test|spec)\./.test(item.name) ? [pad] : [];
  });
}

describe("Kwaliteitscontrole 28 oktober", () => {
  const bronnen: [string, string][] = [
    ...bestanden(resolve("src")).map((pad) => [pad, readFileSync(pad, "utf8")] as [string, string]),
    ...["public/llms.txt", "public/llms-full.txt", "scripts/llmsTxt.ts", "supabase/functions/_shared/zekerKennis.generated.ts"]
      .map((pad) => [pad, readFileSync(pad, "utf8")] as [string, string]),
    ["llms-generator", buildLlmsTxt(seoRoutes, []) + buildLlmsFullTxt(seoRoutes, [])],
    ["Zeker-generator", JSON.stringify(bouwZekerKennis())],
  ];
  for (const zin of oudeFormuleringen) {
    it(`oude formulering ontbreekt: ${zin}`, () => {
      expect(bronnen.filter(([, tekst]) => tekst.includes(zin)).map(([pad]) => pad)).toEqual([]);
    });
  }
});
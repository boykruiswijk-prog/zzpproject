// @vitest-environment node
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { seoRoutes } from "@/config/seoRoutes";

const claim = /\b(?:uniek(?:e)?|unique|einzigartig\w*)\b|exclusief via ZP Zaken|alleen ZP Zaken|als enige|exclusively (?:through|via) ZP Zaken|exklusiv (?:über|bei) ZP Zaken|exclusivement (?:via|par) ZP Zaken/i;
function bronnen(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const pad = join(dir, entry.name);
    if (entry.isDirectory()) return ["test", "__tests__", "admin", "crm", "scherm", "integrations", "ui"].includes(entry.name) ? [] : bronnen(pad);
    return /\.(tsx?|json)$/.test(pad) ? [pad] : [];
  });
}

describe("Tekstnorm 8 november", () => {
  it("publieke productteksten bevatten geen exclusiviteitsclaims", () => {
    const files = [...bronnen("src/components"), ...bronnen("src/pages"), ...bronnen("src/i18n"), ...bronnen("src/data"),
      "src/config/seoRoutes.ts", "scripts/llmsTxt.ts", "supabase/functions/_shared/zekerKennis.generated.ts"];
    const fouten = files.flatMap(file => readFileSync(file, "utf8").split("\n").flatMap((line, index) => {
      // SQL duplicate detection is not public product copy.
      if (file === "src/pages/OffertePage.tsx" && line.includes("23505")) return [];
      return claim.test(line) ? [`${file}:${index + 1}: ${line.trim()}`] : [];
    }));
    expect(fouten).toEqual([]);
  });

  it("alle centrale metadata met eurobedrag vermeldt maand, jaar en kosten voluit", () => {
    const fouten = seoRoutes.flatMap(route => ["title", "description"].flatMap(key => {
      const tekst = route[key as "title" | "description"];
      return /€/.test(tekst) && !(/per maand/i.test(tekst) && /per jaar/i.test(tekst) && /inclusief kosten en assurantiebelasting/i.test(tekst)) ? [`${route.path} ${key}: ${tekst}`] : [];
    }));
    expect(fouten).toEqual([]);
  });

  it("gegenereerde llms sluiten productclaims uit maar laten niet-productgebonden artikeltaal staan", () => {
    for (const file of ["public/llms.txt", "public/llms-full.txt"]) {
      expect(existsSync(file)).toBe(true);
      const fouten = readFileSync(file, "utf8").split("\n").filter(line => claim.test(line) && !/unieke bedrijfsnaam|unieke situatie|hoe uniek is jouw expertise/i.test(line));
      expect(fouten).toEqual([]);
    }
  });
});
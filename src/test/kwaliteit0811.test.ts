// @vitest-environment node
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { seoRoutes } from "@/config/seoRoutes";
import { buildLlmsTxt, buildLlmsFullTxt } from "../../scripts/llmsTxt";
import { buildHtml } from "../../scripts/prerender";
import { formatPageTitle } from "@/lib/seoTitle";

const claim = /\b(?:uniek(?:e)?|unique|einzigartig\w*)\b|exclusief (?:via|bij) ZP Zaken|alleen ZP Zaken|als enige|exclusive(?:ly)? (?:through|via|at) ZP Zaken|exklusiv (?:über|bei) ZP Zaken|exclusif chez ZP Zaken|exclusivement (?:via|par) ZP Zaken/i;
const nietProduct = /unieke bedrijfsnaam|unieke situatie|hoe uniek is jouw expertise/i;
const product = /ZP Zaken|BAV|AVB|polis|verzekering|liability|Police|Haftpflicht/i;
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
      "src/config/seoRoutes.ts", "src/lib/schema.ts", "scripts/llmsTxt.ts", "supabase/functions/_shared/zekerKennis.generated.ts"];
    const fouten = files.flatMap(file => readFileSync(file, "utf8").split("\n").flatMap((line, index) => {
      // SQL duplicate detection is not public product copy.
      if (file === "src/pages/OffertePage.tsx" && line.includes("23505")) return [];
      return claim.test(line) ? [`${file}:${index + 1}: ${line.trim()}`] : [];
    }));
    expect(fouten).toEqual([]);
  });

  it("controleert daadwerkelijk gegenereerde title, og en twitter metadata voor alle routes", () => {
    const template = readFileSync("index.html", "utf8");
    for (const route of seoRoutes) {
      const html = buildHtml(template, { routePath: route.path, title: route.path === "/" ? route.title : formatPageTitle(route.title), description: route.description, ogType: "website", schemas: [], fallback: "" });
      const teksten = [...html.matchAll(/<title>(.*?)<\/title>|<meta (?:name|property)="(?:description|og:title|og:description|twitter:title|twitter:description)"[^>]*content="([^"]*)"/g)].map(m => m[1] || m[2]);
      expect(teksten.filter(t => t.includes("€") && !(/per maand/.test(t) && /per jaar/.test(t) && /inclusief kosten en assurantiebelasting/.test(t)))).toEqual([]);
    }
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
      const fouten = readFileSync(file, "utf8").split("\n").filter(line => claim.test(line) && !(nietProduct.test(line) && !product.test(line)));
      expect(fouten).toEqual([]);
    }
    for (const generate of [buildLlmsTxt, buildLlmsFullTxt]) {
      expect(claim.test(generate(seoRoutes, []))).toBe(false);
    }
  });
});
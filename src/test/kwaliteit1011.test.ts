// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import ts from "typescript";
import { seoRoutes } from "@/config/seoRoutes";
import { buildHtml } from "../../scripts/prerender";
import { formatPageTitle } from "@/lib/seoTitle";

function verboden(tekst: string, pad: string): boolean {
  const schoon = tekst.replace(/Senior Adviseur/g, "Ellen");
  return /adviseurs?/i.test(pad === "/aov" ? schoon.replace(/externe adviseur/g, "extern") : schoon);
}

describe("TEKSTNORM 7-11, kwaliteitscontrole 10-11", () => {
  it("centrale titels, descriptions, og/twitter en h1 bevatten geen adviseur(s)", () => {
    const fouten: string[] = [];
    for (const route of seoRoutes) {
      const html = buildHtml(readFileSync("index.html", "utf8"), {
        routePath: route.path, title: formatPageTitle(route.title), description: route.description,
        ogType: "website", schemas: [], fallback: "",
      });
      const velden = [route.title, route.description, route.h1,
        ...[...html.matchAll(/<title>(.*?)<\/title>|<meta (?:name|property)="(?:description|og:title|og:description|twitter:title|twitter:description)"[^>]*content="([^"]*)"/g)].map(m => m[1] || m[2])];
      for (const tekst of velden) if (verboden(tekst, route.path)) fouten.push(`${route.path}: ${tekst}`);
    }
    expect(fouten).toEqual([]);
  });

  it("beroepspagina-h1 en expliciete metadata bevatten geen adviseur(s), inhoudelijke blokken vallen erbuiten", () => {
    const fouten: string[] = [];
    for (const file of readdirSync("src/pages").filter(f => /^ZzpVerzekering.*\.tsx$/.test(f))) {
      const source = ts.createSourceFile(file, readFileSync(`src/pages/${file}`, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      function bezoek(node: ts.Node) {
        if (ts.isJsxAttribute(node) && ["title", "seoTitle", "seoDescription"].includes(node.name.getText(source))) {
          if (verboden(node.initializer?.getText(source) || "", file)) fouten.push(`${file}: ${node.getText(source)}`);
        }
        if (ts.isJsxElement(node) && node.openingElement.tagName.getText(source) === "h1" && verboden(node.getText(source), file)) fouten.push(`${file}: ${node.getText(source)}`);
        ts.forEachChild(node, bezoek);
      }
      bezoek(source);
    }
    expect(fouten).toEqual([]);
  });

  it("staat alleen de afgesproken beroepsnaam-uitzonderingen toe", () => {
    expect(verboden("Senior Adviseur", "/over-ons")).toBe(false);
    expect(verboden("onze externe adviseur", "/aov")).toBe(false);
    expect(verboden("onze externe adviseur", "/contact")).toBe(true);
    expect(verboden("HR-adviseurs", "/zzp-verzekering-hr")).toBe(true);
  });
});
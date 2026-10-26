// Kwaliteitscontrole 26-10-2026: geen concurrentdomeinen, volledige prijzen,
// geen absolute beschermingsbeloftes, leesbaar telefoonnummer.
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { seoRoutes } from "../config/seoRoutes";

function bestanden(map: string): string[] {
  return readdirSync(map).flatMap((naam) => {
    const pad = join(map, naam);
    if (statSync(pad).isDirectory()) {
      if (naam === "node_modules" || naam === "fixtures") return [];
      return bestanden(pad);
    }
    return /\.(ts|tsx|json|txt)$/.test(naam) ? [pad] : [];
  });
}

const DOMEINEN = ["insify.nl", "knab.nl", "centraalbeheer.nl", "goudse.nl", "zzp-nederland.nl", "allianz.nl", "nn.nl", "rabobank.nl", "yezzer.nl"];
const PUBLIEK = [
  "src/pages/BavZzpVergelijken.tsx",
  "src/data/bavVergelijking.ts",
  "src/config/seoRoutes.ts",
  "public/llms.txt",
  "public/llms-full.txt",
  "supabase/functions/_shared/zekerKennis.generated.ts",
];

describe("kwaliteit 26-10", () => {
  it("geen concurrentdomeinen op de vergelijkingspagina, seoRoutes, llms of Zeker-kennis", () => {
    for (const pad of PUBLIEK) {
      const inhoud = readFileSync(pad, "utf8");
      for (const domein of DOMEINEN) {
        expect(inhoud.includes(domein), `${domein} in ${pad}`).toBe(false);
      }
    }
  });

  it("elke description of llms-regel met € 55 of € 600 noemt per maand/jaar én assurantiebelasting", () => {
    const regels: string[] = [];
    for (const r of seoRoutes) {
      if (/€ ?55|€ ?600/.test(r.description)) regels.push(`${r.path}: ${r.description}`);
    }
    for (const pad of ["public/llms.txt", "public/llms-full.txt"]) {
      for (const regel of readFileSync(pad, "utf8").split("\n")) {
        if (/€ ?55|€ ?600/.test(regel)) regels.push(`${pad}: ${regel}`);
      }
    }
    for (const regel of regels) {
      expect(regel, regel).toMatch(/per maand/);
      expect(regel, regel).toMatch(/per jaar/);
      expect(regel, regel).toContain("assurantiebelasting");
    }
  });

  it("geen absolute beschermingsbeloftes in beroepspagina-teksten", () => {
    const bronnen = [
      ...bestanden("src/pages").filter((p) => p.includes("ZzpVerzekering")),
      "src/config/seoRoutes.ts",
      "public/llms.txt",
      "public/llms-full.txt",
      "supabase/functions/_shared/zekerKennis.generated.ts",
    ];
    for (const pad of bronnen) {
      const inhoud = readFileSync(pad, "utf8");
      expect(inhoud.includes("ben je beschermd."), pad).toBe(false);
      expect(inhoud.includes("beschermen je."), pad).toBe(false);
    }
  });

  it("llms.txt bevat geen ongeformatteerd telefoonnummer", () => {
    expect(readFileSync("public/llms.txt", "utf8")).not.toContain("+31204573077");
    expect(readFileSync("public/llms-full.txt", "utf8")).not.toContain("+31204573077");
  });

  it("vergelijkingspagina toont platte brontekst zonder links", () => {
    const pagina = readFileSync("src/pages/BavZzpVergelijken.tsx", "utf8");
    expect(pagina).toContain("Bron: website van de aanbieder, stand oktober 2026");
    expect(pagina).not.toContain("YEZZER_URL");
  });
});

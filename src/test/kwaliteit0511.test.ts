import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { seoRoute } from "@/config/seoRoutes";

// Kwaliteitscontrole 5-11: Movir en Nationale-Nederlanden alleen op de /aov-pagina zelf.
const AOV_EIGEN = new Set(["src/pages/AOVMovir.tsx", "src/config/aovPagina.ts"]);
const aov = seoRoute("/aov");
const AOV_TEKSTEN = [aov.title, aov.description, aov.h1, aov.intro].filter(Boolean) as string[];
const VERBODEN = /Movir|Nationale-Nederlanden/;

function bestanden(map: string): string[] {
  return readdirSync(map).flatMap((n) => {
    const p = join(map, n);
    return statSync(p).isDirectory() ? bestanden(p) : /\.(tsx?|json|txt)$/.test(n) ? [p] : [];
  });
}

const bronnen = [
  ...["src/pages", "src/components", "src/i18n", "src/data"].flatMap(bestanden),
  "public/llms.txt", "public/llms-full.txt",
  "supabase/functions/_shared/zekerKennis.generated.ts",
].filter((p) => !AOV_EIGEN.has(p));

describe("kwaliteit 5-11: geen AOV-aanbiedersnamen buiten /aov", () => {
  it.each(bronnen)("%s", (pad) => {
    let tekst = readFileSync(pad, "utf8");
    for (const t of AOV_TEKSTEN) tekst = tekst.split(t).join("");
    // De /aov-sectie in llms-full.txt beschrijft de AOV-pagina zelf.
    tekst = tekst.replace(/### AOV voor zzp'ers[\s\S]*?(?=\n### |\n## |$)/, "");
    const regel = tekst.split("\n").find((r) => VERBODEN.test(r));
    expect(regel, `aanbiedersnaam buiten /aov in ${pad}`).toBeUndefined();
  });

  it("FAQ-zin over de AOV is neutraal", () => {
    expect(readFileSync("src/data/faqItems.ts", "utf8")).toContain("Op zpzaken.nl/aov lees je hoe de AOV werkt en bereken je je premie via onze externe adviseur.");
  });
});

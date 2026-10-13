// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const verbodenClaims = [
  new RegExp(["verzekerde", "bedrag", "gedeeld"].join("\\s+"), "i"),
  new RegExp(["bedrag", "wordt", "gedeeld"].join("\\s+"), "i"),
  new RegExp(["sluit", "direct", "af"].join("\\s+"), "i"),
  new RegExp("\\bBAV\\b[^\\n]*" + ["direct", "af"].join("\\s+") + "\\b", "i"),
  new RegExp(["beste", "prijs-kwaliteit"].join("\\s+"), "i"),
  new RegExp(["beste", "oplossing"].join("\\s+"), "i"),
  new RegExp(["Voordelig", "ste"].join(""), "i"),
  // "met korting" alleen verboden in verzekeringscontext (BAV/AVB/combinatiepolis/verzekering/polis);
  // kortingen van partners bij collectieve inkoop zijn toegestaan.
  new RegExp(
    ["met", "korting"].join("\\s+") + "[^\\n]*\\b(BAV|AVB|combinatiepolis|verzekering|polis)\\b" +
      "|\\b(BAV|AVB|combinatiepolis|verzekering|polis)\\b[^\\n]*" + ["met", "korting"].join("\\s+"),
    "i",
  ),
  new RegExp(["bespaart", "gemiddeld"].join("\\s+"), "i"),
];

function bestandenIn(map: string): string[] {
  return readdirSync(map, { withFileTypes: true }).flatMap((entry) => {
    const pad = join(map, entry.name);
    return entry.isDirectory() ? bestandenIn(pad) : [pad];
  });
}

describe("Collectieve polis zonder gedeelde-dekkingsclaim", () => {
  it("bewaakt alle src-bestanden, llms en de Zeker-kennis", () => {
    const bestanden = [
      ...bestandenIn("src"),
      "public/llms.txt",
      "public/llms-full.txt",
      "scripts/llmsTxt.ts",
      "scripts/genereer-zeker-kennis.ts",
      "supabase/functions/_shared/zekerKennis.generated.ts",
      "supabase/functions/_shared/zeker.ts",
    ];
    const overtredingen = bestanden.filter((pad) => {
      const tekst = readFileSync(pad, "utf8");
      return verbodenClaims.some((patroon) => patroon.test(tekst));
    });
    expect(overtredingen).toEqual([]);
  });

  it("herkent verboden formuleringen ook met hoofdletters en extra witruimte", () => {
    const voorbeelden = [
      ["verzekerde", "bedrag", "gedeeld"].join(" "),
      ["bedrag", "wordt", "gedeeld"].join("\n  ").toUpperCase(),
      ["sluit", "direct", "af"].join(" "),
      ["BAV", "direct", "af"].join(" "),
      ["beste", "prijs-kwaliteit"].join(" "),
      ["beste", "oplossing"].join(" "),
      ["Voordelig", "ste"].join(""),
      ["met", "korting"].join(" "),
      ["bespaart", "gemiddeld"].join(" "),
    ];
    voorbeelden.forEach((tekst) => {
      expect(verbodenClaims.some((patroon) => patroon.test(tekst))).toBe(true);
    });
  });

  it("bewaakt de online-aanvraagtekst in beide CTA's en de artikelgenerator", () => {
    const pagina = readFileSync("src/pages/BavZzpVergelijken.tsx", "utf8");
    expect(pagina).toContain("Bekijk de verzekering en vraag online aan");
    expect(pagina.match(/<Ctas\b/g)).toHaveLength(2);
    const generator = readFileSync("supabase/functions/genereer-artikel/index.ts", "utf8");
    expect(generator).toContain("Vraag de BAV + AVB online aan");
    expect(generator).toContain("Bekijk de BAV + AVB en vraag online aan");
  });

  it("behoudt de exacte collectieve-polisformulering en dekking per aanspraak", () => {
    const pagina = readFileSync("src/pages/WaaromZpZaken.tsx", "utf8");
    expect(pagina).toContain("Collectieve polis voor 5.000+ zzp'ers: jij profiteert");
    expect(pagina).toContain("ZP Zaken werkt met een collectieve polis bij Hiscox voor meer dan 5.000 zzp'ers. Daardoor kan de premie structureel laag blijven: niet als tijdelijke aanbieding, maar als permanent voordeel. Je dekking is per aanspraak: BAV € 5.000.000 en AVB € 2.500.000.");
  });
});
// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { seoRoute, seoRoutes } from "@/config/seoRoutes";
import { productSchema } from "@/lib/schema";
import { bavPakketten } from "@/data/bavPakketten";
import { bouwZekerKennis } from "@/lib/zeker/bouwKennis";
import { buildLlmsTxt, buildLlmsFullTxt } from "../../scripts/llmsTxt";

const oud = [
  "Plan een vrijblijvend gesprek en ontdek welke diensten bij jouw situatie passen.",
  "Selecteer het pakket dat past bij jouw situatie",
  "Ontdek welke verzekeringen passen bij jouw situatie en beroep.",
  "Met de BAV + AVB ben je verzekerd als een fout in je werk of een ongeluk op locatie schade veroorzaakt.",
  "Beroepsaansprakelijkheidsverzekering: aansprakelijkheidsverzekering zzp vanaf",
  "Wij zijn op zoek naar een gedreven online sales adviseur die zzp'ers helpt de juiste verzekering te vinden.",
  "Online Sales Adviseur", "Sales Adviseur Buitendienst", "energieke buitendienstadviseur",
  "Ben jij de adviseur die ons team compleet maakt?", "recht op eerlijk, persoonlijk gesprek",
  "met helder, onafhankelijke bemiddeling", "Nog geen recente post :",
  "Hier vind je de polisvoorwaarden, verzekeringskaarten en brochures per branche.",
  "Bekijk en download polisvoorwaarden, verzekeringskaarten en brochures van ZP Zaken per branche.",
  "Twijfel je welke dekking bij jouw werk past?",
  "Select the package that fits your situation", "Wählen Sie das Paket, das zu Ihrer Situation passt",
  "Sélectionnez le forfait adapté à votre situation",
  "discover which services suit your situation", "entdecken Sie, welche Dienstleistungen zu Ihrer Situation passen",
  "découvrez quels services conviennent à votre situation",
  "Discover which insurance fits your situation and profession.",
  "Entdecken Sie, welche Versicherungen zu Ihrer Situation und Ihrem Beruf passen.",
  "Découvrez quelles assurances correspondent à votre situation et votre profession.",
];

function bestanden(map: string): string[] {
  return readdirSync(map, { withFileTypes: true }).flatMap(item => {
    const pad = resolve(map, item.name);
    if (item.isDirectory()) return /^(test|__tests__)$/.test(item.name) ? [] : bestanden(pad);
    return /\.(tsx?|json|txt)$/.test(item.name) && !/\.(test|spec)\./.test(item.name) ? [pad] : [];
  });
}

describe("Kwaliteitscontrole 29 oktober", () => {
  const bronnen: [string, string][] = [
    ...bestanden(resolve("src")).map(pad => [pad, readFileSync(pad, "utf8")] as [string, string]),
    ...["public/llms.txt", "public/llms-full.txt", "supabase/functions/_shared/zekerKennis.generated.ts"]
      .map(pad => [pad, readFileSync(pad, "utf8")] as [string, string]),
    ["llms-generator", buildLlmsTxt(seoRoutes, []) + buildLlmsFullTxt(seoRoutes, [])],
    ["Zeker-generator", JSON.stringify(bouwZekerKennis())],
  ];
  for (const zin of oud) {
    it(`oude tekst ontbreekt: ${zin}`, () => {
      expect(bronnen.filter(([, tekst]) => tekst.includes(zin)).map(([pad]) => pad)).toEqual([]);
    });
  }
  it("bav-zzp-description bevat maand, jaar en assurantiebelasting", () => {
    expect(seoRoute("/bav-zzp").description).toBe("Beroepsaansprakelijkheidsverzekering: aansprakelijkheidsverzekering zzp voor € 55 per maand of € 600 per jaar, inclusief kosten en assurantiebelasting.");
  });
  it("beide cyberbeschrijvingen geven het volledige tarief zonder andere offerprijzen", () => {
    const cyber = bavPakketten.filter(p => p.dekkingen.cyber);
    expect(cyber).toHaveLength(2);
    for (const p of cyber) {
      expect(productSchema(p).description).toBe("Beroeps- en bedrijfsaansprakelijkheidsverzekering voor zzp'ers inclusief cyberdekking. € 82,50 per maand of € 850 per jaar, inclusief kosten en assurantiebelasting.");
      expect(productSchema(p).offers).toMatchObject({ price: String(p.prijs) });
    }
  });
  it("documentenverwijzing verwijst expliciet naar de voorwaardenpagina", () => {
    const route = seoRoute("/documenten");
    expect(route.description).not.toContain("polisvoorwaarden");
    expect(route.intro).toContain("Polisvoorwaarden: https://zpzaken.nl/voorwaarden");
    expect(buildLlmsTxt(seoRoutes, [])).toContain("][https://zpzaken.nl/voorwaarden]".replace("][", "](" ).replace("]", ")"));
  });
});
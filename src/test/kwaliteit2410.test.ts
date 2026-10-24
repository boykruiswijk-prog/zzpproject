// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { zoekLegacyDoel, taalprefixRedirects } from "@/config/legacyRedirects";

const oudeZinnen = [
  "We bekijken samen welke verzekeringen passen bij jouw beroep en situatie, zonder verplichtingen.",
  "Ik help je graag bij het vinden van de juiste verzekering.",
  "We nemen de tijd om je situatie te begrijpen en bemiddelen alleen wat je écht nodig hebt.",
  "Geen callcenters of verkooppraatjes, we denken met je mee.",
  "Onze bemiddeling is gebaseerd op wat bij jou past.",
  "helpt zij ondernemers met passende bemiddeling voor hun situatie",
  "De juiste dekking voor jouw ICT-opdrachten",
  "Nee, een BAV is niet wettelijk verplicht. Opdrachtgevers eisen het wel vaak in hun contract.",
  'question: "Kan ik dagelijks opzeggen en is er uitloopdekking?", answer: "Ja.',
  "ZP Zaken bespreekt in een persoonlijk gesprek welk pensioenplan bij je situatie past.",
  "Als zzp'er zelf je pensioen regelen? ZP Zaken denkt met je mee in een persoonlijk gesprek.",
  "Together we'll look at which insurance fits your profession and situation, no obligations.",
  "Gemeinsam schauen wir, welche Versicherungen zu Ihrem Beruf und Ihrer Situation passen, ohne Verpflichtungen.",
  "Ensemble, nous verrons quelles assurances correspondent à votre profession et votre situation, sans obligation.",
];

function bronnen(map: string): string[] {
  return readdirSync(map, { withFileTypes: true }).flatMap((item) => {
    const pad = resolve(map, item.name);
    if (item.isDirectory()) return bronnen(pad);
    return /\.(tsx?|json)$/.test(item.name) && !/\.(test|spec)\./.test(item.name) ? [pad] : [];
  });
}

describe("Kwaliteitscontrole 24 oktober D6", () => {
  it("nieuwjaarsactie gaat met slash en taalprefixen naar verzekeringen; tv blijft uitgesloten", () => {
    for (const prefix of ["", "/en", "/de", "/fr"]) {
      for (const slash of ["", "/"]) {
        expect(zoekLegacyDoel(`${prefix}/fb-nieuwjaarsactie${slash}`)).toBe("/verzekeringen");
      }
      expect(zoekLegacyDoel(`${prefix}/tv`)).toBeNull();
    }
    const csv = readFileSync(resolve("docs/cloudflare-bulk-redirects.csv"), "utf8");
    for (const slash of ["", "/"]) {
      expect(csv).toContain(`zpzaken.nl/fb-nieuwjaarsactie${slash},https://zpzaken.nl/verzekeringen,301,TRUE,TRUE,FALSE,FALSE`);
    }
    for (const taal of ["en", "de", "fr"]) {
      expect(taalprefixRedirects().find((r) => r.from === `${taal}/fb-nieuwjaarsactie`)?.to).toBe("/verzekeringen");
    }
  });
  for (const zin of oudeZinnen) {
    it(`oude formulering ontbreekt: ${zin}`, () => {
      const bestanden = [
        ...bronnen(resolve("src")),
        resolve("public/llms.txt"), resolve("public/llms-full.txt"),
        resolve("supabase/functions/_shared/zekerKennis.generated.ts"),
      ];
      for (const pad of bestanden) {
        expect(readFileSync(pad, "utf8").includes(zin), pad).toBe(false);
      }
    });
  }
});
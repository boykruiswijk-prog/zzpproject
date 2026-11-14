// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { faqItems } from "@/data/faqItems";
import {
  geordendeRedirects,
  legacyRedirects,
  taalprefixRedirects,
  zoekLegacyDoel,
} from "@/config/legacyRedirects";
import { legacyRedirects as serverRedirects } from "../../supabase/functions/_shared/legacyRedirects";
import { cloudflareBulkCsv } from "../../vite.config";

const KVK_VRAAG = "Kan ik mijn KvK-nummer wijzigen?";
const BV_VRAAG = "Ik ga van eenmanszaak naar bv. Wat moet ik doen?";
const KVK_ANTWOORD = "Nee. Je BAV en AVB zijn afgegeven op je onderneming met het KvK-nummer uit je aanvraag. Het risico en de polis horen bij dat KvK-nummer. Krijg je een nieuw KvK-nummer, bijvoorbeeld omdat je van eenmanszaak naar bv gaat of een nieuwe onderneming start? Dan vraag je een nieuwe verzekering aan voor je nieuwe onderneming en zeg je de verzekering van je oude onderneming op per de datum waarop je werk daar stopt. Die datums hoeven niet op elkaar aan te sluiten en mogen een tijd overlappen; leidend is met welke onderneming je de overeenkomst met je opdrachtgever hebt. Je adres, e-mailadres of telefoonnummer wijzigen kan wel gewoon door contact met ons op te nemen.";
const BV_ANTWOORD = "Een bv krijgt een eigen KvK-nummer en is daarmee een nieuwe onderneming. Je kunt de omzetting zelf aanvragen in Mijn ZP: je geeft een einddatum op voor je eenmanszaak en een ingangsdatum voor je bv. Vraag je de nieuwe BAV + AVB via het aanvraagformulier aan, vermeld dan je oude onderneming. Loopt er nog een opdracht via je eenmanszaak, dan kan een paar weken of maanden dubbele dekking nodig zijn; leidend is met welke onderneming je de overeenkomst met je opdrachtgever hebt. Krijg je een nieuwe zakelijke rekening, dan geef je een nieuwe incassomachtiging af. Het stappenplan lees je op zpzaken.nl/kennisbank/eenmanszaak-naar-bv-verzekering.";

function antwoord(vraag: string): string | undefined {
  return faqItems.flatMap(categorie => categorie.questions).find(item => item.question === vraag)?.answer;
}

function talenBestanden(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const pad = join(dir, entry.name);
    return entry.isDirectory() ? talenBestanden(pad) : [pad];
  });
}

describe("Loep 14 november: rechtsvorm-FAQ", () => {
  it("vervangt alleen de twee gevraagde antwoorden door de registerversie", () => {
    expect(antwoord(KVK_VRAAG)).toBe(KVK_ANTWOORD);
    expect(antwoord(BV_VRAAG)).toBe(BV_ANTWOORD);
  });

  it.each(["dag voordat de nieuwe ingaat", "Wij zorgen dat je oude polis stopt"])(
    "oude automatische einddatum ontbreekt overal: %s",
    zin => {
      const bestanden = [
        "src/data/faqItems.ts",
        "supabase/functions/_shared/zekerKennis.generated.ts",
        "public/llms-full.txt",
        ...talenBestanden("src/i18n/locales"),
      ];
      expect(bestanden.filter(pad => readFileSync(pad, "utf8").includes(zin))).toEqual([]);
    },
  );
});

describe("Loep 14 november: root-sitemap-XML-terugval", () => {
  const voorbeelden = [
    "product_brand-sitemap.xml",
    "product-sitemap.xml",
    "product_cat-sitemap.xml",
    "local-sitemap.xml",
    "sitemap_index.xml",
  ];

  it("vangt elke root-sitemap-XML met slash en taalprefix, behalve expliciete regels", () => {
    const geordend = geordendeRedirects([...legacyRedirects, ...taalprefixRedirects()]);
    for (const prefix of ["", "en/", "de/", "fr/"]) {
      for (const bestand of voorbeelden) {
        expect(zoekLegacyDoel(`/${prefix}${bestand}`)).toBe("/sitemap.xml");
        expect(zoekLegacyDoel(`/${prefix}${bestand}/`)).toBe("/sitemap.xml");
      }
      expect(zoekLegacyDoel(`/${prefix}sitemap-index.xml`)).toBe("/sitemap.xml");
      expect(zoekLegacyDoel(`/${prefix}news_sitemap.xml/`)).toBe("/sitemap.xml");
      expect(geordend.findIndex(regel => regel.from === `${prefix}*sitemap*.xml`))
        .toBeGreaterThan(geordend.findIndex(regel => regel.from === `${prefix}sitemap-index.xml`));
    }
  });

  it("laat de echte sitemap, geneste paden, andere XML en tv ongemoeid", () => {
    for (const pad of [
      "/sitemap.xml",
      "/en/sitemap.xml",
      "/nl/product-sitemap.xml",
      "/kennisbank/product-sitemap.xml",
      "/product-feed.xml",
      "/tv",
      "/en/tv",
    ]) expect(zoekLegacyDoel(pad), pad).toBeNull();
  });

  it("spiegelt de bron en plaatst de gegenereerde vangregels na expliciete regels", () => {
    expect(serverRedirects).toContainEqual({ from: "*sitemap*.xml", to: "/sitemap.xml" });
    const tekst = readFileSync("public/_redirects", "utf8");
    const spa = tekst.indexOf("/*    /index.html    200");
    for (const prefix of ["", "en/", "de/", "fr/"]) {
      const regel = `/${prefix}*sitemap*.xml    /sitemap.xml    301`;
      const positie = tekst.indexOf(regel);
      expect(positie, regel).toBeGreaterThan(tekst.indexOf(`/${prefix}news-sitemap.xml/    /sitemap.xml    301`));
      expect(positie).toBeLessThan(spa);
    }
  });

  it("schrijft geen ongeldige bestandsnaam-wildcard naar Cloudflare Bulk CSV", () => {
    expect(cloudflareBulkCsv(["/*sitemap*.xml    /sitemap.xml    301"])).toEqual([]);
    expect(readFileSync("docs/cloudflare-bulk-redirects.csv", "utf8")).not.toContain("*sitemap*");
  });
});

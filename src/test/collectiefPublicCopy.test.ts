import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

const publicSources = [
  "src/pages/CollectieveInkoop.tsx",
  "src/components/layout/Header.tsx",
  "src/pages/CollectiefLedenorganisaties.tsx",
  "src/config/seoRoutes.ts",
  "src/data/searchIndex.ts",
  "src/i18n/locales/nl.json",
  "src/i18n/locales/en.json",
  "src/i18n/locales/de.json",
  "src/i18n/locales/fr.json",
];

describe("publieke collectiefteksten", () => {
  it("toont geen live teller, voortgangsbalk of vast groepsdoel", () => {
    const content = publicSources.map(read).join("\n");
    expect(content).not.toMatch(/get_pilot_signup_count|pilot-count|<Progress|count\s*}\s*\/|goal:\s*\d+/);
    expect(content).not.toMatch(/(?:bundelen|bundling|bündeln|regrouper)\s+100\s+(?:zzp'ers|freelancers|Freiberufler)/i);
  });

  it("heeft eerlijke commerciële tekst in alle talen", () => {
    const expected = [
      ["nl", "Beperkt aantal plekken", "Reserveer je plek"],
      ["en", "Limited places", "Reserve your place"],
      ["de", "Begrenzte Plätze", "Platz reservieren"],
      ["fr", "Places limitées", "Réservez votre place"],
    ];
    for (const [locale, badge, cta] of expected) {
      const content = read(`src/i18n/locales/${locale}.json`);
      expect(content).toContain(badge);
      expect(content).toContain(cta);
    }
  });

  it("gebruikt alleen de korte NIEUW-badge in het hoofdmenu", () => {
    const header = read("src/components/layout/Header.tsx");
    expect(header).toContain(">Nieuw</span>");
    expect(header).not.toContain('t("collectieveInkoop.limitedPlaces")');
  });
});

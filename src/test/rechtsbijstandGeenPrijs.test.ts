import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const root = path.resolve(__dirname, "../..");
const bestanden = [
  "src/i18n/locales/nl.json", "src/i18n/locales/en.json", "src/i18n/locales/de.json", "src/i18n/locales/fr.json",
  "src/config/seoRoutes.ts", "src/data/faqItems.ts", "src/pages/Verzekeringen.tsx",
  "supabase/functions/_shared/zekerKennis.generated.ts", "public/llms.txt", "public/llms-full.txt", "scripts/llmsTxt.ts",
];

describe("rechtsbijstand zonder prijs", () => {
  it("geen eurobedrag bij rechtsbijstand", () => {
    for (const f of bestanden) {
      const p = path.join(root, f);
      if (!fs.existsSync(p)) continue;
      for (const regel of fs.readFileSync(p, "utf8").split(/\n/)) {
        if (!/rechtsbijstand/i.test(regel)) continue;
        // Zoek een bedrag binnen 150 tekens rond het woord rechtsbijstand.
        for (const m of regel.matchAll(/rechtsbijstand/gi)) {
          const stuk = regel.slice(Math.max(0, m.index! - 150), m.index! + 150);
          expect(stuk, `${f}: ${stuk}`).not.toMatch(/€\s?\d|\d\s?€|\bEUR\s?\d/);
        }
      }
    }
  });
  it("prijsveld rechtsbijstand toont neutrale tekst", () => {
    const nl = JSON.parse(fs.readFileSync(path.join(root, "src/i18n/locales/nl.json"), "utf8"));
    expect(nl.insuranceData.rechtsbijstandPrice).toBe("Prijs op aanvraag");
  });
});

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CYBER_AKKOORD, CYBER_LOOPTIJD, CYBER_OPZEGTEKST } from "../../supabase/functions/_shared/cyber";
import { bouwSysteemPrompt } from "../../supabase/functions/_shared/zeker";
import { bavPakketten } from "../data/bavPakketten";
import { faqItems } from "../data/faqItems";

const verboden = [
  "Zeg je op, dan krijg je een creditnota", "bij maand- en jaarbetaling",
  "stilzwijgend met 12 maanden verlengd", "Cyber is niet dagelijks opzegbaar",
  "jaarcontract in 12 termijnen", "niet op commissies",
  "cyber 12 maanden", "Cyber heeft een vaste looptijd van 12 maanden",
];

function bestanden(pad: string): string[] {
  return readdirSync(pad, { withFileTypes: true }).flatMap((item) => {
    const naam = join(pad, item.name);
    // Tests contain prohibited examples; authenticated tools are not public copy.
    if (item.isDirectory()) return /^(test|__tests__|admin|portal|mijn-zp|integrations)$/.test(item.name) ? [] : bestanden(naam);
    return /\.(tsx?|json)$/.test(naam) && !/\.(test|spec)\./.test(naam) ? [naam] : [];
  });
}

describe("Publieke opzeg- en cyberteksten D1/E", () => {
  it("bevat nergens oude publieke claims, inclusief gegenereerde kennis", () => {
    const fouten: string[] = [];
    const paden = [...bestanden("src"), "scripts/llmsTxt.ts", "public/llms.txt", "public/llms-full.txt", "supabase/functions/_shared/zekerKennis.generated.ts"];
    for (const pad of paden) {
      const tekst = readFileSync(pad, "utf8").toLowerCase();
      for (const zin of verboden) if (tekst.includes(zin.toLowerCase())) fouten.push(`${pad}: ${zin}`);
    }
    expect(fouten).toEqual([]);
  });

  it("onderscheidt jaar- en maandbetaling in pakketten en FAQ", () => {
    for (const pakket of bavPakketten) {
      const tekst = pakket.usps.join(" ");
      expect(tekst).toContain("Betaal je per jaar, dan krijg je bij opzeggen een creditnota");
      expect(tekst).toContain("Betaal je per maand, dan stopt je verzekering op de opzegdatum, zonder creditnota.");
    }
    const antwoord = faqItems.flatMap(c => c.questions).find(q => q.question === "Hoe kan ik mijn verzekering opzeggen?")?.answer;
    expect(antwoord).toContain("Betaal je per jaar");
    expect(antwoord).toContain("zonder creditnota");
  });

  it("Zeker gebruikt dagelijks opzegbare cyber zonder teruggave", () => {
    const prompt = bouwSysteemPrompt({ taal: "nl", artikelen: [] });
    expect(prompt).toContain(CYBER_OPZEGTEKST);
    for (const zin of verboden) expect(prompt.toLowerCase()).not.toContain(zin.toLowerCase());
  });

  it("beschermde toestemming en bestaande mail-/bewijsconstante blijven ongewijzigd", () => {
    expect(CYBER_AKKOORD).toBe("Ik begrijp dat de cyberdekking een looptijd heeft van 12 maanden en daarna stilzwijgend met 12 maanden wordt verlengd. De BAV + AVB blijft dagelijks opzegbaar.");
    expect(CYBER_LOOPTIJD).toContain("jaarcontract in 12 termijnen van €27,50");
    for (const pad of ["supabase/functions/process-bav-wizard/index.ts", "supabase/functions/polis-lifecycle/index.ts", "supabase/functions/calculate-pauze-preview/index.ts"]) {
      expect(readFileSync(pad, "utf8")).not.toContain("CYBER_OPZEGTEKST");
    }
    expect(readFileSync("src/components/home/BAVApplicationModule.tsx", "utf8")).toContain("{CYBER_AKKOORD}</Label>");
  });
});
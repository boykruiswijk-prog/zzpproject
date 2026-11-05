// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { faqItems } from "@/data/faqItems";
import { faqSchema } from "@/lib/schema";
import { bouwZekerKennis } from "@/lib/zeker/bouwKennis";
import { seoRoutes } from "@/config/seoRoutes";
import { buildLlmsFullTxt } from "../../scripts/llmsTxt";

const antwoord = "De premie van een AOV hangt af van je beroep, je leeftijd, de hoogte van de uitkering en de wachttijd. ZP Zaken geeft geen advies over de AOV en vergelijkt geen AOV's. Op zpzaken.nl/aov lees je hoe de AOV werkt en bereken je je premie via onze externe adviseur.";
const questions = faqItems.flatMap(c => c.questions);

describe("Kwaliteitscontrole 3 november", () => {
  it("AOV-FAQ bevat geen eurobedragen", () => {
    const aov = questions.filter(q => /\bAOV\b/i.test(q.question));
    expect(aov.length).toBeGreaterThan(0);
    for (const q of aov) expect(q.answer, q.question).not.toMatch(/€|\b(?:EUR|euro)\s*\d|\d\s*(?:EUR|euro)\b/i);
  });
  it("het kostenantwoord is gelijk in FAQ, schema, Zeker en llms", () => {
    const vraag = "Wat kost een AOV gemiddeld per maand?";
    expect(questions.find(q => q.question === vraag)?.answer).toBe(antwoord);
    const schema = faqSchema(questions) as { mainEntity: { name: string; acceptedAnswer: { text: string } }[] };
    expect(schema.mainEntity.find(q => q.name === vraag)?.acceptedAnswer.text).toBe(antwoord);
    expect(bouwZekerKennis().faq.find(q => q.vraag === vraag)?.antwoord).toBe(antwoord);
    for (const tekst of [buildLlmsFullTxt(seoRoutes, []), readFileSync("public/llms-full.txt", "utf8"), readFileSync("supabase/functions/_shared/zekerKennis.generated.ts", "utf8")]) {
      expect(tekst).toContain(antwoord);
      expect(tekst).not.toContain("Gemiddeld betalen zzp'ers tussen de €150 en €400 per maand");
    }
  });
});
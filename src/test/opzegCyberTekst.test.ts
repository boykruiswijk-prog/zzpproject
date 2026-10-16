import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CYBER_AKKOORD, CYBER_LOOPTIJD, CYBER_OPZEGTEKST, CYBER_VERSIE, nieuweCyber, aanvraagPremie } from "../../supabase/functions/_shared/cyber";
import { bouwSysteemPrompt } from "../../supabase/functions/_shared/zeker";
import { bavPakketten } from "../data/bavPakketten";
import { faqItems } from "../data/faqItems";

const verboden = [
  "Zeg je op, dan krijg je een creditnota", "bij maand- en jaarbetaling",
  "stilzwijgend met 12 maanden verlengd", "Cyber is niet dagelijks opzegbaar",
  "jaarcontract in 12 termijnen", "niet op commissies",
  "cyber 12 maanden", "Cyber heeft een vaste looptijd van 12 maanden",
];
const verbodenKlantCyber = [
  "stilzwijgend met 12 maanden", "looptijd van 12 maanden", "niet dagelijks opzegbaar",
  "jaarcontract in 12 termijnen", "Resterende termijnen blijven verschuldigd",
  "telkens 12 maanden verlengd", "Lopend cyberjaar",
];

function bestanden(pad: string, alleenPubliek = true): string[] {
  return readdirSync(pad, { withFileTypes: true }).flatMap((item) => {
    const naam = join(pad, item.name);
    // Tests contain prohibited examples; authenticated tools are not public copy.
    if (item.isDirectory()) return /^(test|__tests__|migrations)$/.test(item.name) || (alleenPubliek && /^(admin|portal|mijn-zp|integrations)$/.test(item.name)) ? [] : bestanden(naam, alleenPubliek);
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

  it("gebruikt dezelfde nieuwe voorwaarden voor toestemming en klantuitleg", () => {
    expect(CYBER_VERSIE).toBe("2026-10-16");
    expect(CYBER_AKKOORD).toBe("Ik begrijp dat cyber dagelijks opzegbaar is en dat ik al betaalde premie voor cyber bij opzeggen niet terugkrijg. Cyber is niet pauzeerbaar. De BAV + AVB blijft dagelijks opzegbaar.");
    expect(CYBER_LOOPTIJD).toBe(CYBER_OPZEGTEKST);
    expect(CYBER_LOOPTIJD).toBe("Cyber is dagelijks opzegbaar. Al betaalde premie voor cyber krijg je bij opzeggen niet terug. Cyber is niet pauzeerbaar. Bij maandbetaling: €27,50 per maand.");
    expect(readFileSync("src/components/home/BAVApplicationModule.tsx", "utf8")).toContain("{CYBER_AKKOORD}</Label>");
  });

  it("bevat geen oude cyberuitleg in functies of klantportaal", () => {
    const paden = [...bestanden("supabase/functions", false), ...bestanden("src/components/portal", false), ...bestanden("src/pages/mijn-zp", false)];
    const fouten = paden.flatMap(pad => {
      const tekst = readFileSync(pad, "utf8").toLowerCase();
      return verbodenKlantCyber.filter(zin => tekst.includes(zin.toLowerCase())).map(zin => `${pad}: ${zin}`);
    });
    expect(fouten).toEqual([]);
  });

  it("blijft bestaande afzonderlijke cyberpolissen herkennen zonder bedragen te wijzigen", () => {
    for (const versie of ["2026-10-08", CYBER_VERSIE]) {
      expect(nieuweCyber({ cyber_voorwaarden_versie: versie, gekozen_pakket: "maandelijks-cyber" })).toBe(true);
      expect(nieuweCyber({ extra_data: { cyber: { versie, gekozen: true } } })).toBe(true);
    }
    expect(nieuweCyber({ cyber_voorwaarden_versie: "legacy", gekozen_pakket: "maandelijks-cyber" })).toBe(false);
    expect(aanvraagPremie("maandelijks-cyber", false)).toEqual({ bav: 55, cyber: 27.5, totaal: 82.5, maand: true });
    expect(aanvraagPremie("jaarlijks-cyber", false)).toEqual({ bav: 600, cyber: 250, totaal: 850, maand: false });
  });

  it("bewaart datumkolommen maar toont geen cybereinddatum in nieuwe mailvelden", () => {
    const wizard = readFileSync("supabase/functions/process-bav-wizard/index.ts", "utf8");
    expect(wizard).toContain("Bevestig de voorwaarden van cyber");
    expect(wizard).toContain("cyber_ingangsdatum: cyberGekozen ? submission.ingangsdatum : null");
    expect(wizard).toContain("cyber_einddatum: cyberGekozen ? cyberJaarEind(submission.ingangsdatum) : null");
    expect(wizard.slice(wizard.indexOf('type: "bav",'), wizard.indexOf('// ── 4.'))).not.toContain("cyber_einddatum");
    expect(readFileSync("supabase/functions/generate-certificate/index.ts", "utf8")).toContain("Cyber: dagelijks opzegbaar.");
    const exact = readFileSync("supabase/functions/lead-to-exact-activate/index.ts", "utf8");
    expect(exact).toContain("Cyber, dagelijks opzegbaar, €27,50 per maand");
    expect(exact).toContain('Notes: "Cyber, dagelijks opzegbaar."');
  });
});
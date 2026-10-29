// Register D-aanvulling Cyber upsell (29-10): Zeker kent cyber later toevoegen en antwoordt in de taal van de laatste vraag.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { bouwSysteemPrompt, ZEKER_CYBER_LATER, ZEKER_CYBER_LATER_ROUTE, ZEKER_VASTE_FEITEN } from "../../supabase/functions/_shared/zeker";
import { STARTER_VOORWAARDE_TEKST } from "@/lib/starterTarief";
import { faqItems } from "@/data/faqItems";

/** Vragen en verwachte kern; de live-controle met het echte model staat in scripts/zekerCyberEval.ts. */
export const ZEKER_CYBER_VRAGEN = [
  { vraag: "If I take BAV & AVB can I add Cyber later?", taal: "en", kern: [/\byes\b/i, /later/i, /mijn-zp\/polis|\/contact|tel:/i] },
  { vraag: "Kan ik cyber later toevoegen aan mijn BAV/AVB?", taal: "nl", kern: [/\bja\b/i, /later|alsnog/i] },
  { vraag: "Kan ik alleen cyber afsluiten?", taal: "nl", kern: [/\bnee\b/i, /samen met (de )?BAV \+ AVB/i] },
] as const;

const prompt = bouwSysteemPrompt({ taal: "nl", artikelen: [] });

describe("Zeker: cyber later toevoegen", () => {
  it("vast feit staat letterlijk in de systeemprompt", () => {
    expect(ZEKER_CYBER_LATER).toBe("Cyber kun je alleen afsluiten samen met BAV + AVB. Heb je al een lopende BAV + AVB-polis, dan kun je Cyber later alsnog toevoegen.");
    expect(prompt).toContain(ZEKER_CYBER_LATER);
    expect(prompt).toContain(ZEKER_CYBER_LATER_ROUTE);
  });
  it("route verwijst naar bestaande pagina's: Mijn ZP-polis met de knop Cyber toevoegen, contact en aanvraag", () => {
    expect(readFileSync("src/App.tsx", "utf8")).toContain('path="mijn-zp/polis"');
    expect(readFileSync("src/pages/mijn-zp/Certificaat.tsx", "utf8")).toContain("<CyberToevoegen />");
    expect(readFileSync("src/components/portal/CyberToevoegen.tsx", "utf8")).toContain(">Cyber toevoegen</Button>");
    expect(readFileSync("src/config/cyberToevoegen.ts", "utf8")).toContain("CYBER_TOEVOEGEN_PUBLIEK = true");
    expect(ZEKER_CYBER_LATER_ROUTE).toContain("(/mijn-zp/polis)");
    expect(ZEKER_CYBER_LATER_ROUTE).toContain("(/contact)");
  });
  it("vaste feiten noemen geen eigen prijzen; starterprijs komt uit dezelfde bron als de site", () => {
    expect(ZEKER_CYBER_LATER + ZEKER_CYBER_LATER_ROUTE).not.toMatch(/€|\d+ ?euro/i);
    expect(ZEKER_VASTE_FEITEN.join(" ")).toContain(STARTER_VOORWAARDE_TEKST);
  });
  it("site-FAQ zegt hetzelfde: cyber alleen samen met BAV + AVB", () => {
    const faq = faqItems;
    expect(JSON.stringify(faq)).toContain("Cyber kan alleen samen met de BAV + AVB");
    expect(prompt).toContain("Cyber kan alleen samen met de BAV + AVB");
  });
  it("taal volgt altijd het laatste bericht, ook bij twijfel of doorverwijzing", () => {
    for (const t of ["nl", "en"] as const) {
      const p = bouwSysteemPrompt({ taal: t, artikelen: [] });
      expect(p).toContain("Antwoord altijd in de taal van het laatste bericht van de bezoeker");
      expect(p).toContain("ook bij twijfel, een doorverwijzing of als je iets niet weet");
    }
  });
  it("productvragen waarvan het antwoord op de site staat zijn vaste feiten", () => {
    expect(prompt).toContain("VASTE PRODUCTFEITEN (zeker waar; zeg hierover nooit dat je het niet zeker weet)");
    for (const v of ["Hoe kan ik mijn verzekering opzeggen?", "Hoe pauzeer ik mijn verzekering?", "Wanneer begint en eindigt de verzekering?", "Kan ik cyber dagelijks opzeggen of pauzeren?", "Wat dekt cyber?"]) expect(prompt).toContain(`V: ${v}`);
    expect(prompt).toContain("vroegst de dag na je aanvraag");
  });
  it("geen verboden woorden of concurrentnamen in de nieuwe kennis", () => {
    const nieuw = ZEKER_VASTE_FEITEN.join(" ");
    expect(nieuw).not.toMatch(/advies|adviseur|bemiddelaar|tussenperso|goedkoopst/i);
    expect(nieuw).not.toMatch(/Centraal Beheer|Interpolis|Allianz|a\.s\.r|Nationale-Nederlanden|Movir|Markel|Ohra/i);
  });
  it("testvragen zijn gedefinieerd", () => { expect(ZEKER_CYBER_VRAGEN).toHaveLength(3); });
});

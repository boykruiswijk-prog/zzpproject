import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  WAAR_LET_JE_OP_PUNTEN, WAAR_LET_JE_OP_PRIJS, WAAR_LET_JE_OP_TITEL, WAAR_LET_JE_OP_INTRO, waarLetJeOpFaq,
} from "@/data/waarLetJeOpBav";

const lees = (p: string) => readFileSync(p, "utf8");
const alleTekst = [
  WAAR_LET_JE_OP_TITEL, WAAR_LET_JE_OP_INTRO,
  ...WAAR_LET_JE_OP_PUNTEN.flatMap((p) => [p.titel, p.vaak, p.vaakKort, p.bijZpZaken]),
  waarLetJeOpFaq().question, waarLetJeOpFaq().answer,
  lees("src/components/diensten/WaarLetJeOpBav.tsx"),
].join("\n");

describe("Waar let je op bij een BAV? (F-aanvulling Waarde zichtbaar)", () => {
  it("staat op alle genoemde pagina's", () => {
    for (const n of ["BavZzp", "Beroepsaansprakelijkheidsverzekering", "ZzpVerzekeringConsultant", "ZzpVerzekeringInterimManager", "ZzpVerzekeringFinance", "ZzpVerzekeringHR", "ZzpVerzekeringMarketing", "ZzpVerzekeringCoach"]) {
      expect(lees(`src/pages/${n}.tsx`), n).toMatch(/<BeroepVerzekeringPagina\s+waarLetJeOp\b/);
    }
    expect(lees("src/components/diensten/BeroepVerzekeringPagina.tsx")).toContain("naHero={p.waarLetJeOp ? <WaarLetJeOpBav />");
    expect(lees("src/pages/ZzpVerzekeringICT.tsx")).toContain("naHero={<WaarLetJeOpBav />}");
    for (const n of ["Verzekeringen", "Starters", "BavZzpVergelijken"]) {
      expect(lees(`src/pages/${n}.tsx`), n).toContain("<WaarLetJeOpBav />");
    }
  });

  it("vergelijkpagina heeft tabel met de drie kolommen en de nieuwe FAQ-vraag", () => {
    const s = lees("src/pages/BavZzpVergelijken.tsx");
    for (const k of ["Waar je op let", "Wat je vaak ziet bij goedkope pakketten", "Bij ZP Zaken"]) expect(s).toContain(k);
    expect(s).toContain("const faq = [waarLetJeOpFaq(), ...bavVergelijkingFaq()]");
    expect(waarLetJeOpFaq().question).toBe("Waar let ik op bij het vergelijken van een BAV?");
    for (const p of WAAR_LET_JE_OP_PUNTEN) expect(waarLetJeOpFaq().answer).toContain(p.bijZpZaken);
  });

  it("noemt geen andere aanbieders en geen verboden woorden", () => {
    expect(alleTekst).not.toMatch(/Movir|Nationale-Nederlanden|\bNN\b|Aanbieder [A-Z]|Centraal Beheer|Allianz|ASR|Interpolis|Achmea|Zurich|Klav|Dazure|Markel|Onderlinge/);
    expect(alleTekst).not.toMatch(/per gebeurtenis|goedkoopste|advies|adviseur|incl\.|altijd gedekt|direct gedekt/i);
  });

  it("prijs voluit met inclusief kosten en assurantiebelasting, bedragen per aanspraak", () => {
    expect(WAAR_LET_JE_OP_PRIJS).toBe("€ 55 per maand of € 600 per jaar, inclusief kosten en assurantiebelasting");
    expect(WAAR_LET_JE_OP_PUNTEN[0].bijZpZaken).toBe("BAV € 5.000.000 en AVB € 2.500.000 per aanspraak.");
    expect(WAAR_LET_JE_OP_PUNTEN[1].bijZpZaken).toBe("Geen eigen risico op de BAV + AVB.");
    expect(waarLetJeOpFaq().answer).toContain("Wat precies gedekt is, staat in de polisvoorwaarden.");
  });
});

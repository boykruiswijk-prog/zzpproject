import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const BRON = readFileSync("src/pages/Voorwaarden.tsx", "utf8");

// Het cyberblok is de sectie met anker #cyber: van dat anker tot de
// afsluitende paragraaf over brochures die er direct op volgt.
function cyberBlok() {
  const start = BRON.indexOf('id="cyber"');
  const einde = BRON.indexOf("Brochures en de documenten", start);
  expect(start).toBeGreaterThan(-1);
  expect(einde).toBeGreaterThan(start);
  return BRON.slice(start, einde);
}

describe("cyber disclaimer op /voorwaarden (Boy 4-11, register E4-aanvulling)", () => {
  const blok = cyberBlok();

  it("toont de exacte regel over de polisvoorwaarden", () => {
    expect(blok).toContain(
      "Wat precies gedekt is, staat in de polisvoorwaarden. Deze samenvatting is algemene informatie.",
    );
  });

  it("staat die regel onder de cybervoorwaarden-tekst en de pdf-links", () => {
    const tekst = blok.indexOf("Cyber sluit je alleen af samen met de BAV + AVB.");
    const links = blok.indexOf("CYBER_DOCUMENTEN.map");
    const regel = blok.indexOf("Deze samenvatting is algemene informatie.");
    expect(tekst).toBeGreaterThan(-1);
    expect(links).toBeGreaterThan(tekst);
    expect(regel).toBeGreaterThan(links);
  });

  it("noemt geen gedeelde limiet en geen bedrag van 2.500.000 in het cyberblok", () => {
    const plat = blok.toLowerCase();
    expect(plat).not.toContain("gedeelde limiet");
    expect(plat).not.toContain("2.500.000");
    expect(plat).not.toContain("2500000");
  });

  it("laat de rest van de pagina verder ongemoeid", () => {
    expect(BRON).toContain('<div id="cyber"');
    expect(BRON).toContain("Cyberverzekering (CyberClear by Hiscox)");
    expect(BRON).toContain("Versie HCC-2022/01");
    expect(BRON.match(/id="cyber"/g)).toHaveLength(1);
  });
});

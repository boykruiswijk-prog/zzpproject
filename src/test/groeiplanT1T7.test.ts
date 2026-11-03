// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { seoRoutes, seoRoute } from "@/config/seoRoutes";
import { getPakket } from "@/data/bavPakketten";
import { AVB_FAQS } from "@/pages/Bedrijfsaansprakelijkheidsverzekering";
import { ARTIKEL_INTERNE_LINKS } from "@/data/artikelInterneLinks";
import { buildLlmsTxt } from "../../scripts/llmsTxt";

const VERGELIJKEND = /\b(goedkoopst\w*|beste|uniek\w*|alleen wij|enige aanbieder)\b/i;
const ADVIES = /\b(wij adviseren|ons advies|adviseren je|persoonlijk advies)\b/i;

describe("Groeiplan T1-T7 (3 november)", () => {
  it("T1 compliance-scan: geen vergelijkende claim in titels, h1 of beschrijvingen", () => {
    for (const r of seoRoutes) expect(`${r.title} ${r.h1} ${r.description}`, r.path).not.toMatch(VERGELIJKEND);
  });
  it("T1: het 'goedkoopste'-artikel blijft een 301 naar het BAV-artikel", () => {
    expect(readFileSync("public/_redirects", "utf8")).toMatch(/^\/kennisbank\/zp-zaken-zorgeloos-zzpen-goedkoopste-bav-avb\s+\/kennisbank\/bav-afsluiten-als-zzper-dit-is-waarom-en-hoe-je-het-regelt\s+301/m);
  });
  it("T4: AVB-pagina zegt eerlijk dat er geen losse AVB is en gebruikt de prijsbron", () => {
    const r = seoRoute("/bedrijfsaansprakelijkheidsverzekering");
    const tekst = [r.description, r.intro, ...AVB_FAQS.map(f => f.answer)].join(" ");
    expect(tekst).toContain(`€ ${getPakket("maandelijks").prijs} per maand of € ${getPakket("jaarlijks").prijs} per jaar, inclusief kosten en assurantiebelasting`);
    expect(AVB_FAQS.find(f => f.question.includes("alleen een AVB"))?.answer).toMatch(/^Nee\. ZP Zaken biedt de AVB niet los aan/);
    expect(tekst).not.toMatch(VERGELIJKEND);
    expect(tekst).not.toMatch(ADVIES);
  });
  it("T4: AVB-pagina staat in llms.txt, sitemap en de router", () => {
    expect(buildLlmsTxt(seoRoutes, [])).toContain("https://zpzaken.nl/bedrijfsaansprakelijkheidsverzekering");
    expect(readFileSync("public/llms.txt", "utf8")).toContain("https://zpzaken.nl/bedrijfsaansprakelijkheidsverzekering");
    expect(readFileSync("public/sitemap.xml", "utf8")).toContain("<loc>https://zpzaken.nl/bedrijfsaansprakelijkheidsverzekering</loc>");
    expect(readFileSync("src/App.tsx", "utf8")).toContain('path="bedrijfsaansprakelijkheidsverzekering"');
  });
  it("T3: artikellinks wijzen alleen naar bestaande routes, met /bav-zzp en de AVB-pagina", () => {
    const paden = new Set(seoRoutes.map(r => r.path));
    for (const [slug, links] of Object.entries(ARTIKEL_INTERNE_LINKS)) {
      expect(links.map(l => l.to), slug).toContain("/bav-zzp");
      expect(links.map(l => l.to), slug).toContain("/bedrijfsaansprakelijkheidsverzekering");
      for (const l of links) { expect(paden.has(l.to), l.to).toBe(true); expect(l.label.length).toBeGreaterThan(15); }
    }
  });
  it("T7: beroepspagina's dragen de exacte zoekterm in titel en h1", () => {
    const verwacht: Record<string, RegExp> = {
      "/zzp-verzekering-ict": /^Beroepsaansprakelijkheidsverzekering ICT zzp/,
      "/zzp-verzekering-consultant": /^Beroepsaansprakelijkheidsverzekering consultant/,
      "/zzp-verzekering-coach": /^Beroepsaansprakelijkheidsverzekering coach/,
      "/zzp-verzekering-marketing": /^Beroepsaansprakelijkheidsverzekering marketing/,
      "/zzp-verzekering-interim-manager": /^Beroepsaansprakelijkheidsverzekering interim manager/,
      "/zzp-verzekering-bouw": /^Aansprakelijkheidsverzekering zzp bouw/,
    };
    for (const [p, re] of Object.entries(verwacht)) {
      expect(seoRoute(p).title, p).toMatch(re);
      expect(seoRoute(p).h1, p).toMatch(/aansprakelijkheidsverzekering voor/i);
    }
  });
});

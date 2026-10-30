// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { isStatischLegacyDoel, navigeerLegacyBestand } from "@/components/shared/LegacyRedirect";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { faqItems } from "@/data/faqItems";
import { faqSchema } from "@/lib/schema";
import { bouwZekerKennis } from "@/lib/zeker/bouwKennis";
import { seoRoutes } from "@/config/seoRoutes";
import { legacyRedirects, zoekLegacyDoel, taalprefixRedirects } from "@/config/legacyRedirects";
import { buildLlmsTxt, buildLlmsFullTxt } from "../../scripts/llmsTxt";
import { rootArtikelRedirects, voegArtikelRedirectsToe } from "../../scripts/articleRedirects";
import { cloudflareBulkCsv } from "../../vite.config";

const read = (path: string) => readFileSync(resolve(path), "utf8");
const redirects = read("public/_redirects");
const csv = read("docs/cloudflare-bulk-redirects.csv");
const exact = [
  ["privacy-statement", "/cookies"],
  ["control/verzekeringen/zorg-en-zekerheid", "/zorgverzekering"],
  ["kopie-van-inschrijven-shift-happens", "/"],
  ["zzp-verzekering-interim", "/zzp-verzekering-interim-manager"],
  ["src/assets/partner-hiscox.webp", "/logos/hiscox.png"],
] as const;

describe("Kwaliteitscontrole 30 oktober", () => {
  const sources = [
    read("src/data/faqItems.ts"), JSON.stringify(bouwZekerKennis()),
    read("supabase/functions/_shared/zekerKennis.generated.ts"),
    read("public/llms.txt"), read("public/llms-full.txt"),
    buildLlmsTxt(seoRoutes, []), buildLlmsFullTxt(seoRoutes, []),
  ];
  for (const banned of ["vergelijken we AOV", "beschermt je inkomen", "financieel niet in de problemen", "uit zolang je arbeidsongeschikt", "voorstel op maat"]) {
    it(`oude tekst ontbreekt: ${banned}`, () => {
      expect(sources.filter(text => text.includes(banned))).toEqual([]);
    });
  }
  it("FAQ-schema en Zeker nemen dezelfde FAQ-bron over", () => {
    const questions = faqItems.flatMap(category => category.questions);
    const schema = faqSchema(questions) as { mainEntity: { name: string; acceptedAnswer: { text: string } }[] };
    expect(schema.mainEntity.map(q => ({ question: q.name, answer: q.acceptedAnswer.text }))).toEqual(questions);
    expect(bouwZekerKennis().faq.map(q => ({ question: q.vraag, answer: q.antwoord }))).toEqual(questions);
  });
  it.each(exact)("%s heeft beide directe 301-varianten naar %s, inclusief taalprefix", (from, to) => {
    for (const prefix of ["", "en/", "de/", "fr/"]) for (const slash of ["", "/"]) {
      const path = `/${prefix}${from}${slash}`;
      expect(zoekLegacyDoel(path)).toBe(to);
      expect(redirects).toContain(`${path}    ${to}    301`);
      expect(csv).toContain(`zpzaken.nl${path},https://zpzaken.nl${to},301,TRUE,TRUE,FALSE,FALSE`);
    }
  });
  it("home/nieuws vangt alle onderliggende paden en taalprefixen zonder suffix", () => {
    for (const prefix of ["", "en/", "de/", "fr/"]) {
      expect(zoekLegacyDoel(`/${prefix}home/nieuws`)).toBe("/kennisbank");
      expect(zoekLegacyDoel(`/${prefix}home/nieuws/page/6/`)).toBe("/kennisbank");
      expect(zoekLegacyDoel(`/${prefix}home/nieuws/oud/bericht/`)).toBe("/kennisbank");
      const line = `/${prefix}home/nieuws/*    /kennisbank    301`;
      const row = `zpzaken.nl/${prefix}home/nieuws/,https://zpzaken.nl/kennisbank,301,TRUE,TRUE,TRUE,FALSE`;
      expect(redirects).toContain(line);
      expect(cloudflareBulkCsv([line])).toEqual([row]);
      expect(csv).toContain(row);
    }
    expect(taalprefixRedirects().filter(r => r.from.endsWith("/home/nieuws/*"))).toHaveLength(3);
    expect(zoekLegacyDoel("/home/nieuws-onbekend/voorbeeld")).toBeNull();
  });
  it("root-artikelslug normaliseert trailing slash structureel en genereert directe varianten", () => {
    const slug = "zijn-internetkosten-aftrekbaar-voor-een-zzp-er";
    const result = rootArtikelRedirects([{ slug: `${slug}/` }], resolve("."));
    expect(result).toEqual([{ from: slug, to: `/kennisbank/${slug}` }]);
    const gebouwd = voegArtikelRedirectsToe(redirects, result);
    const gebouwdCsv = cloudflareBulkCsv(gebouwd.split("\n")).join("\n");
    expect(voegArtikelRedirectsToe(redirects, [])).not.toContain(`/${slug}/    /kennisbank/${slug}    301`);
    const text = voegArtikelRedirectsToe("/:path/ /:path 301!\n/* /index.html 200\n", result);
    for (const slash of ["", "/"]) {
      const rule = `/${slug}${slash}    /kennisbank/${slug}    301`;
      expect(text).toContain(rule);
      // Zelfde stap als de build (vite.config prerenderPlugin) op de echte bron.
      expect(gebouwd).toContain(rule);
      expect(gebouwdCsv).toContain(`zpzaken.nl/${slug}${slash},https://zpzaken.nl/kennisbank/${slug},301`);
    }
  });
  it("ook bestaande legacy-artikelen hebben een directe slashvariant", () => {
    expect(redirects).toContain("/verplichte-aov-voor-zzp/    /kennisbank/verplichte-aov-voor-zzp    301");
  });
  it("tv is nooit een legacybron", () => {
    for (const path of ["/tv", "/tv/", "/tv/voorbeeld", "/en/tv/"]) expect(zoekLegacyDoel(path)).toBeNull();
    expect(legacyRedirects.filter(r => /^(?:en\/|de\/|fr\/)?tv(?:\/|$)/.test(r.from))).toEqual([]);
    expect(csv).not.toMatch(/^zpzaken\.nl\/(?:en\/|de\/|fr\/)?tv(?:\/|,)/m);
  });
  it("Hiscox-doel is een echt gepubliceerd PNG-bestand", () => {
    expect(readFileSync(resolve("public/logos/hiscox.png")).subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  });
  it.each(["png", "jpg", "jpeg", "webp", "svg", "gif", "pdf", "ico", "txt", "xml"])("legacy-bestand .%s gebruikt volledige navigatie, ook met query en fragment", extension => {
    const replace = vi.fn();
    for (const suffix of ["", "?download=1#voorbeeld", "#voorbeeld"]) {
      const to = `/bestanden/voorbeeld.${extension.toUpperCase()}${suffix}`;
      expect(isStatischLegacyDoel(to)).toBe(true);
      expect(navigeerLegacyBestand(to, replace)).toBe(true);
      expect(replace).toHaveBeenLastCalledWith(to);
    }
    expect(replace).toHaveBeenCalledTimes(3);
  });
  it("gewone pagina's blijven routerdoelen en bestandsnamen in een query zijn geen bestandsdoel", () => {
    const replace = vi.fn();
    for (const to of ["/cookies", "/contact?bijlage=logo.png", "/kennisbank/artikel#logo.svg"]) {
      expect(navigeerLegacyBestand(to, replace)).toBe(false);
    }
    expect(replace).not.toHaveBeenCalled();
  });
  it("beide legacy-ingangen gebruiken de gedeelde bestandsbewuste doorverwijzing, nooit rechtstreeks Navigate", () => {
    expect(read("src/App.tsx")).toContain('element={<LegacyRedirect to={to} />}');
    expect(read("src/App.tsx")).not.toContain('element={<Navigate to={to} replace />}');
    expect(read("src/pages/NotFound.tsx")).toContain('<LegacyRedirect to={redirect} />');
    expect(read("src/pages/NotFound.tsx")).not.toContain('<Navigate to={redirect}');
  });
});
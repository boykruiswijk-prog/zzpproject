// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
vi.mock("@/components/diensten/ServicePageTemplate", () => ({ ServicePageTemplate: () => null }));
vi.mock("@/components/home/BAVApplicationModule", () => ({ BAVApplicationModule: () => null }));
vi.mock("@/components/kennisbank/LeesMeer", () => ({ LeesMeer: () => null }));
import { beroepspaginaPrijsregel, isBeroepspagina } from "@/components/diensten/BeroepspaginaTekst";
import BavZzp from "@/pages/BavZzp";
import Beroepsaansprakelijkheidsverzekering from "@/pages/Beroepsaansprakelijkheidsverzekering";
import Consultant from "@/pages/ZzpVerzekeringConsultant";
import Interim from "@/pages/ZzpVerzekeringInterimManager";
import Finance from "@/pages/ZzpVerzekeringFinance";
import HR from "@/pages/ZzpVerzekeringHR";
import Marketing from "@/pages/ZzpVerzekeringMarketing";
import Coach from "@/pages/ZzpVerzekeringCoach";
import ICT from "@/pages/ZzpVerzekeringICT";
import Zorg from "@/pages/ZzpVerzekeringZorg";
import Bouw from "@/pages/ZzpVerzekeringBouw";

const paginas = [BavZzp, Beroepsaansprakelijkheidsverzekering, Consultant, Interim, Finance, HR, Marketing, Coach, ICT, Zorg, Bouw];
const prijs = /€\s?55(?:\/mnd| per maand)[^€]*€\s?600 per jaar, (?:incl\.|inclusief) kosten en assurantiebelasting/;
const opzeg = "Ja. De BAV + AVB heeft geen jaarcontract en is dagelijks opzegbaar. Betaal je per jaar, dan krijg je bij opzeggen een creditnota voor de dagen die je al betaald hebt. Betaal je per maand, dan stopt je verzekering op de opzegdatum, zonder creditnota.";

describe("Beroepspagina’s D2/D3/D4", () => {
  it("hero toont beide bestaande tarieven, kosten en dekking per aanspraak", () => {
    expect(beroepspaginaPrijsregel()).toBe("Vanaf € 55 per maand of € 600 per jaar, incl. kosten en assurantiebelasting · BAV € 5M · AVB € 2,5M per aanspraak");
  });
  for (const pagina of paginas) {
    it(`${pagina.name}: geen onvolledige vanafprijs in lopende tekst of FAQ`, () => {
      const props = pagina().props;
      const faqs = props.faqs ?? props.schema["@graph"].find((s: Record<string, unknown>) => s["@type"] === "FAQPage").mainEntity.map((q: { name: string; acceptedAnswer: { text: string } }) => ({ question: q.name, answer: q.acceptedAnswer.text }));
      const teksten = [props.subtitle, ...props.benefits.map((b: { description: string }) => b.description), ...props.explainers.map((e: { text: string }) => e.text), ...faqs.map((f: { answer: string }) => f.answer)];
      expect(isBeroepspagina(props.path ?? props.canonicalPath)).toBe(true);
      for (const tekst of teksten) {
        if (/€\s?55\b|€\s?600\b/.test(tekst)) expect(tekst).toMatch(prijs);
        expect(tekst).not.toMatch(/polisvoorwaarden.*pagina documenten|vindt ze op de pagina documenten/i);
      }
      for (const faq of faqs) {
        if (/opzeggen|polis stoppen/.test(faq.question)) expect(faq.answer).toContain(opzeg);
      }
    });
  }
  it("consultant bewaart waarschuwing over claims na opzeggen", () => {
    const faq = Consultant().props.faqs.find((f: { question: string }) => f.question.includes("opzeggen"));
    expect(faq.answer).toBe(`${opzeg} Na opzeggen ben je niet meer verzekerd voor claims, ook niet over eerder werk.`);
  });
  it("andere diensten blijven buiten de aangepaste prijsweergave", () => {
    for (const pad of ["/tv", "/pensioen", "/aov", "/starters", "/verzekeringen", "/"]) expect(isBeroepspagina(pad)).toBe(false);
  });
});
import { describe, expect, it, vi } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";
import type { ReactNode } from "react";
import nl from "@/i18n/locales/nl.json";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key.split(".").reduce<unknown>((v, k) => v && typeof v === "object" ? (v as Record<string, unknown>)[k] : key, nl) }) }));
vi.mock("@/components/layout/Layout", () => ({ Layout: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/components/SEOHead", () => ({ SEOHead: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/components/LocalizedLink", () => ({ LocalizedLink: ({ to, children, ...rest }: { to: string; children: ReactNode }) => <a href={to} {...rest}>{children}</a> }));
vi.mock("@/components/layout/PageHero", () => ({ PageHero: () => null }));
vi.mock("@/components/home/BAVApplicationModule", () => ({ BAVApplicationModule: () => null }));
vi.mock("@/components/kennisbank/LeesMeer", () => ({ LeesMeer: () => null }));
vi.mock("@/components/shared/ThreeOptionCTA", () => ({ ThreeOptionCTA: () => null }));
vi.mock("@/components/shared/TerugbelDialog", () => ({ openTerugbelKlik: vi.fn() }));
vi.mock("@/components/shared/TrustBar", () => ({ TrustBar: () => null }));
vi.mock("@/components/shared/QualificationCheck", () => ({ QualificationCheck: () => null }));
vi.mock("@/components/shared/StepsProcess", () => ({ StepsProcess: () => null }));
vi.mock("@/components/shared/WhyAffordable", () => ({ WhyAffordable: () => null }));
vi.mock("@/components/shared/MiniSocialProof", () => ({ MiniSocialProof: () => null }));
vi.mock("@/components/home/HiscoxTrustStrip", () => ({ HiscoxTrustStrip: () => null }));
vi.mock("@/components/diensten/ServicePageTemplate", () => ({ ServicePageTemplate: ({ schema, children }: { schema: unknown; children: ReactNode }) => <><script type="application/ld+json">{JSON.stringify(schema)}</script>{children}</> }));

import Verzekeringen from "@/pages/Verzekeringen";
import Beroepsaansprakelijkheidsverzekering from "@/pages/Beroepsaansprakelijkheidsverzekering";

function faqSchemas(value: unknown): Record<string, unknown>[] {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap(faqSchemas);
  const node = value as Record<string, unknown>;
  return [...(node["@type"] === "FAQPage" ? [node] : []), ...Object.values(node).flatMap(faqSchemas)];
}

describe("F8: dezelfde FAQ-bron zichtbaar en in structured data", () => {
  for (const [Page, count] of [[Beroepsaansprakelijkheidsverzekering, 10], [Verzekeringen, 7]] as const) {
    it(`${Page.name}: één FAQPage met ${count} identieke antwoorden`, () => {
      const { container, getByRole } = render(<Page />);
      const schemas = [...container.querySelectorAll('script[type="application/ld+json"]')].flatMap(s => faqSchemas(JSON.parse(s.textContent ?? "null")));
      expect(schemas).toHaveLength(1);
      const questions = schemas[0].mainEntity as { name: string; acceptedAnswer: { text: string } }[];
      expect(questions).toHaveLength(count);
      expect(new Set(questions.map(q => q.name)).size).toBe(count);
      for (const q of questions) {
        const trigger = getByRole("button", { name: q.name });
        fireEvent.click(trigger);
        const content = document.getElementById(trigger.getAttribute("aria-controls") ?? "");
        const answer = content?.querySelector("[data-faq-answer]") ?? content;
        expect(answer?.textContent).toBe(q.acceptedAnswer.text);
      }
      cleanup();
    });
  }
});
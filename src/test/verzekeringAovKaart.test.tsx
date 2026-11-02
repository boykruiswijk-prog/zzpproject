import { describe, expect, it, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import nl from "@/i18n/locales/nl.json";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key.split(".").reduce<unknown>((value, part) => value && typeof value === "object" ? (value as Record<string, unknown>)[part] : key, nl) }) }));
vi.mock("@/components/layout/Layout", () => ({ Layout: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/components/SEOHead", () => ({ SEOHead: () => null }));
vi.mock("@/components/LocalizedLink", () => ({ LocalizedLink: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => <a href={to} {...props}>{children}</a> }));
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

import Verzekeringen from "@/pages/Verzekeringen";

describe("AOV-kaart verwijst alleen naar informatie", () => {
  it("linkt naar /aov, nooit naar /contact, en toont geen premiebedrag", () => {
    const { container } = render(<MemoryRouter><Verzekeringen /></MemoryRouter>);
    const kaart = container.querySelector("#arbeidsongeschiktheid");
    expect(kaart).not.toBeNull();
    expect(kaart?.textContent).not.toMatch(/€|zorgt voor financiële zekerheid/);
    expect(kaart?.querySelector('a[href="/aov"]')?.textContent).toContain("Meer over de AOV");
    expect(kaart?.querySelector('a[href="/contact"]')).toBeNull();
    // De andere kaartacties behouden hun bestaande bestemming.
    for (const id of ["bav-avb-combinatiepolis", "rechtsbijstand"]) {
      expect(container.querySelector(`#${id} a[href="/contact"]`)).not.toBeNull();
    }
    cleanup();
  });
});
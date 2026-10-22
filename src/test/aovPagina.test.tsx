// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
vi.mock("@/components/layout/Layout", () => ({ Layout: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getSession: () => Promise.resolve({ data: { session: null } }) }, rpc: vi.fn(), from: vi.fn() } }));
vi.mock("@/components/kennisbank/LeesMeer", () => ({ LeesMeer: () => null }));
import fs from "node:fs";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AOV_NIEUW_PUBLIEK, AOV_ADVISEUR_URL, AOV_REKENTOOL_URL, AOV_REKENTOOL_TEKST, aovNieuwTonen } from "../config/aovPagina";
import AOVMovir, { AOV_SEO, AOV_FAQ } from "../pages/AOVMovir";

const lees = (p: string) => fs.readFileSync(p, "utf8");

function renderPagina() {
  return render(
    <HelmetProvider><QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={["/aov"]}><AOVMovir /></MemoryRouter></QueryClientProvider></HelmetProvider>,
  );
}

describe("F9 nieuwe AOV-pagina", () => {
  it("vlag staat uit zonder akkoord Boy", () => expect(AOV_NIEUW_PUBLIEK).toBe(false));
  it.each(["zpzaken.nl", "www.zpzaken.nl", "zpzaken.nl.lovable.app.evil.test"])("live %s toont oude pagina", (h) =>
    expect(aovNieuwTonen(h, false)).toBe(false));
  it.each(["id-preview--x.lovable.app", "zzpproject.lovable.app", "localhost"])("preview %s toont nieuwe pagina", (h) =>
    expect(aovNieuwTonen(h, false)).toBe(true));
  it("route en oude pagina blijven gekoppeld, prerender gebruikt oude", () => {
    const app = lees("src/App.tsx");
    expect(app).toContain('<Route path="aov" element={<AovRoute />} />');
    expect(app).toContain("? <AOVMovir /> : <AOV />");
    expect(app).toContain('typeof window === "undefined" ? ""');
    for (const p of ["public/llms.txt", "public/sitemap.xml"]) expect(lees(p)).not.toContain("Movir Momentum");
  });
  it("vermelding met AFM-nummer, Michiel 1x", () => {
    const { container } = renderPagina();
    const tekst = container.textContent || "";
    expect(tekst).toContain("Advies en afsluiten van de Movir Momentum AOV lopen via Tjepkema Assurantie & Advies B.V., Middenweg 344, 1097 TZ Amsterdam, AFM-vergunning 12050654. ZP Zaken geeft geen advies en bemiddelt niet in deze verzekering.");
    expect(tekst.match(/Michiel Tjepkema/g)?.length).toBe(1);
  });
  it("geen verboden woorden", () => {
    const { container } = renderPagina();
    const t = (container.textContent || "").toLowerCase() + JSON.stringify(AOV_FAQ).toLowerCase();
    for (const w of ["wij regelen", "wij adviseren", "wij vergelijken", "vergelijken", "goedkoopste", "direct gedekt", "via zp zaken afsluiten", "—"]) expect(t).not.toContain(w);
  });
  it("title en description binnen grenzen, 5 tot 7 vragen", () => {
    expect(AOV_SEO.title.length).toBeLessThanOrEqual(60);
    expect(AOV_SEO.title.endsWith("| ZP Zaken")).toBe(true);
    expect(AOV_SEO.description.length).toBeGreaterThanOrEqual(120);
    expect(AOV_SEO.description.length).toBeLessThanOrEqual(155);
    expect(AOV_FAQ.length).toBeGreaterThanOrEqual(5);
    expect(AOV_FAQ.length).toBeLessThanOrEqual(7);
  });
  it("geen iframe; enige invoer is het aanmeldformulier met vaste velden", () => {
    const { container } = renderPagina();
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.textContent).toContain(AOV_REKENTOOL_TEKST);
    expect(container.querySelectorAll("form").length).toBe(1);
    expect(container.querySelectorAll("textarea, select").length).toBe(0);
    expect(container.querySelector(`a[href="${AOV_REKENTOOL_URL}"]`)).toBeNull();
  });
  it("hero en sticky knop scrollen naar #premie, adviseur is wijzijnaov", () => {
    const { container } = renderPagina();
    expect(container.querySelectorAll('a[href="#premie"]').length).toBe(3);
    expect(AOV_ADVISEUR_URL).toBe("https://www.wijzijnaov.nl");
  });
  it("geen terugbel-, vertrek- of sitebalk op deze pagina, CSP staat alleen dit domein extra toe", () => {
    expect(lees("src/pages/AOVMovir.tsx")).toContain("<Layout zonderGegevensPopups>");
    const l = lees("src/components/layout/Layout.tsx");
    expect(l).toContain("{!zonderGegevensPopups && <><StickyMobileCTA /><StickyContactBar /><ExitIntentPopup /></>}");
    expect(l).toContain("{!zonderGegevensPopups && <><WhatsAppFloatingButton /><ZekerLauncher /></>}");
    expect(l).toContain("{!zonderGegevensPopups && <TerugbelDialog />}");
    expect(l).toContain("zonderGegevensPopups = false");
    expect(lees("index.html")).not.toContain("https://movir-aov-exon.smartplatforms.io");
  });
});

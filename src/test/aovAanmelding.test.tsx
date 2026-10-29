// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
const m = vi.hoisted(() => ({ rpc: vi.fn(), session: vi.fn(), insert: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getSession: m.session }, rpc: m.rpc, from: () => ({ insert: m.insert }) } }));
vi.mock("@/lib/tracking", () => ({ trackGa: vi.fn() }));
import { AovAanmeldStap } from "@/components/shared/AovAanmeldStap";
import { AOV_TOESTEMMING_TEKST, AOV_REKENTOOL_URL, AOV_IFRAME_TEKST } from "@/config/aovPagina";
import { aovAanmeldFouten, AOV_AANMELD_VELDEN, aovKopieTekst, aovAanmeldCsv } from "@/lib/aovDoorverwijzing";

const browser = window as unknown as { happyDOM: { settings: { disableIframePageLoading: boolean } } };
browser.happyDOM.settings.disableIframePageLoading = true;
const element = (container: HTMLElement, selector: string): HTMLElement => {
  const node = container.querySelector<HTMLElement>(selector);
  if (!node) throw new Error(`Missing ${selector}`);
  return node;
};
const ID = "11111111-2222-4333-8444-555555555555";
const toon = (doel: "rekentool" | "advies" = "rekentool") => render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><AovAanmeldStap doel={doel} /></MemoryRouter></QueryClientProvider>);
function vul(c: HTMLElement, { email = "jan@example.nl", vink = true } = {}) {
  fireEvent.change(element(c, "#aov-naam"), { target: { value: "Jan Jansen" } });
  fireEvent.change(element(c, "#aov-email"), { target: { value: email } });
  if (vink) fireEvent.click(element(c, "#aov-toestemming"));
}
let tab: { opener: unknown; location: { href: string }; close: ReturnType<typeof vi.fn> };
beforeEach(() => {
  cleanup(); vi.clearAllMocks(); m.session.mockResolvedValue({ data: { session: null } });
  tab = { opener: 1, location: { href: "" }, close: vi.fn() };
  vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window);
});

describe("F9 aanmeldstap AOV", () => {
  it("heeft precies naam, e-mail, telefoon en toestemming (plus onzichtbaar spamveld)", () => {
    const { container } = toon();
    const namen = [...container.querySelectorAll("input, button[role=checkbox]")].map(e => e.getAttribute("name") || e.id.replace(/^aov-/, "")).filter(n => n !== "website_url");
    expect(new Set(namen)).toEqual(new Set(AOV_AANMELD_VELDEN));
    expect(container.querySelectorAll("textarea, select").length).toBe(0);
    const t = (container.textContent || "").toLowerCase();
    for (const w of ["beroep", "inkomen", "geboortedatum", "leeftijd", "gezondheid", "verzekerd bedrag", "premie"]) expect(t).not.toContain(w);
    expect(element(container, "#aov-toestemming")?.getAttribute("aria-checked")).toBe("false");
    expect(container.textContent).toContain(AOV_TOESTEMMING_TEKST);
  });
  it("zonder vinkje geen opslag en geen doorsturen", async () => {
    const { container } = toon(); vul(container, { vink: false });
    fireEvent.submit(element(container, "form"));
    await waitFor(() => expect(container.textContent).toContain("Zet het vinkje"));
    expect(m.rpc).not.toHaveBeenCalled(); expect(window.open).not.toHaveBeenCalled();
    expect(container.querySelector("iframe")).toBeNull();
  });
  it("zonder geldig e-mailadres geen opslag en geen doorsturen", async () => {
    const { container } = toon(); vul(container, { email: "jan@" });
    fireEvent.submit(element(container, "form"));
    await waitFor(() => expect(container.textContent).toContain("geldig e-mailadres"));
    expect(m.rpc).not.toHaveBeenCalled(); expect(window.open).not.toHaveBeenCalled();
    expect(container.querySelector("iframe")).toBeNull();
  });
  it.each(["rekentool", "advies"] as const)("%s: opslaan met toestemming en tekst, link met ref = aanmelding-id", async (doel) => {
    m.rpc.mockResolvedValue({ data: ID, error: null });
    const { container } = toon(doel); vul(container);
    fireEvent.submit(element(container, "form"));
    await waitFor(() => expect(container.textContent).toContain("Je aanmelding staat bij ZP Zaken."));
    expect(m.rpc).toHaveBeenCalledWith("aov_aanmelden", expect.objectContaining({ p_naam: "Jan Jansen", p_email: "jan@example.nl", p_toestemming: true, p_toestemming_tekst: AOV_TOESTEMMING_TEKST, p_doel: doel, p_bron: "test", p_honeypot: "" }));
    const frame = container.querySelector("iframe");
    expect(frame).not.toBeNull();
    const url = new URL(frame?.getAttribute("src") || "");
    expect(window.open).not.toHaveBeenCalled();
    expect(container.textContent).toContain(AOV_IFRAME_TEKST);
    expect(url.origin + url.pathname).toBe(new URL(AOV_REKENTOOL_URL).origin + new URL(AOV_REKENTOOL_URL).pathname);
    expect(url.searchParams.get("ref")).toBe(ID);
    expect(url.searchParams.get("utm_source")).toBe("zpzaken");
    expect(container.querySelector(`a[href*="ref=${ID}"]`)?.getAttribute("rel")).toContain("noopener");
  });
  it("hoogteberichten vereisen exacte oorsprong en het eigen iframe", async () => {
    m.rpc.mockResolvedValue({data: ID, error: null});
    const {container} = toon(); vul(container);
    fireEvent.submit(element(container, "form"));
    await waitFor(() => expect(container.querySelector("iframe")).not.toBeNull());
    const frame = container.querySelector("iframe");
    if (!frame) throw new Error("Missing frame");
    fireEvent(window, new MessageEvent("message", {origin:"https://evil.test", source:frame.contentWindow, data:{height:1400}}));
    expect(frame.height).toBe("1000");
    fireEvent(window, new MessageEvent("message", {origin:new URL(AOV_REKENTOOL_URL).origin, source:frame.contentWindow, data:{height:1400}}));
    await waitFor(() => expect(frame.height).toBe("1400"));
  });
  it("mislukt opslaan: geen iframe of externe navigatie", async () => {
    m.rpc.mockResolvedValue({ data: null, error: { message: "offline" } });
    const { container } = toon(); vul(container);
    fireEvent.submit(element(container, "form"));
    await waitFor(() => expect(container.querySelector("[role=alert]")?.textContent).toContain("Probeer het opnieuw"));
    expect(window.open).not.toHaveBeenCalled();
    expect(container.querySelector("iframe")).toBeNull();

  });
  it("ingelogd: gegevens uit profiel, alleen vinkje en knop", async () => {
    m.session.mockResolvedValue({ data: { session: { user: { id: "u", email: "klant@example.nl", user_metadata: { full_name: "Klant Een" } } } } });
    const { container } = toon();
    await waitFor(() => expect(container.textContent).toContain("klant@example.nl"));
    expect(container.querySelector("#aov-naam")).toBeNull();
    expect(container.querySelector("#aov-toestemming")).not.toBeNull();
    expect(container.querySelector("iframe")).toBeNull();
    m.rpc.mockResolvedValue({data: ID, error: null});
    fireEvent.click(element(container, "#aov-toestemming"));
    fireEvent.submit(element(container, "form"));
    await waitFor(() => expect(container.querySelector("iframe")?.getAttribute("src")).toContain(ID));
  });
  it("validatie, kopie en CSV bevatten de ref", () => {
    expect(Object.keys(aovAanmeldFouten({ naam: "Jan", email: "jan@example.nl", telefoon: "", toestemming: true }))).toEqual([]);
    expect(aovAanmeldFouten({ naam: "Jan", email: "jan@example.nl", telefoon: "", toestemming: false }).toestemming).toBeTruthy();
    const r = { id: ID, created_at: "2026-10-22T10:00:00Z", naam: "Jan", email: "jan@example.nl", telefoon: null, doel: "rekentool", bron: "test", user_id: null, status: "nieuw", notitie: null, behandeld_op: null, lead_id: null, lead_status: null };
    expect(aovKopieTekst(r)).toContain(`Ref: ${ID}`);
    expect(aovAanmeldCsv([r])).toContain(ID);
  });
  it("databasefunctie controleert dezelfde toestemmingstekst en registreert doorklik met dezelfde id", () => {
    const sql = fs.readFileSync("drizzle/migrations/0154_aov_aanmeldingen_f9.sql", "utf8");
    expect(sql).toContain(AOV_TOESTEMMING_TEKST);
    expect(sql).toContain("INSERT INTO public.aov_doorverwijzingen (klik_id, bron, doel, user_id) VALUES (v_id");
    expect(sql).not.toMatch(/GRANT [^;]*ON public\.aov_aanmeldingen TO [^;]*anon/);
  });
});

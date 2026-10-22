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
import { AOV_TOESTEMMING_TEKST, AOV_REKENTOOL_URL, AOV_ADVISEUR_URL } from "@/config/aovPagina";
import { aovAanmeldFouten, AOV_AANMELD_VELDEN, aovKopieTekst, aovAanmeldCsv } from "@/lib/aovDoorverwijzing";

const ID = "11111111-2222-4333-8444-555555555555";
const toon = (doel: "rekentool" | "advies" = "rekentool") => render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><AovAanmeldStap doel={doel} /></MemoryRouter></QueryClientProvider>);
function vul(c: HTMLElement, { email = "jan@example.nl", vink = true } = {}) {
  fireEvent.change(c.querySelector("#aov-naam")!, { target: { value: "Jan Jansen" } });
  fireEvent.change(c.querySelector("#aov-email")!, { target: { value: email } });
  if (vink) fireEvent.click(c.querySelector("#aov-toestemming")!);
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
    const namen = [...container.querySelectorAll("input, button[role=checkbox]")].map(e => e.getAttribute("name") || e.id).filter(n => n !== "website_url");
    expect(new Set(namen)).toEqual(new Set(AOV_AANMELD_VELDEN));
    expect(container.querySelectorAll("textarea, select").length).toBe(0);
    const t = (container.textContent || "").toLowerCase();
    for (const w of ["beroep", "inkomen", "geboortedatum", "leeftijd", "gezondheid", "verzekerd bedrag", "premie"]) expect(t).not.toContain(w);
    expect(container.querySelector("#aov-toestemming")?.getAttribute("aria-checked")).toBe("false");
    expect(container.textContent).toContain(AOV_TOESTEMMING_TEKST);
  });
  it("zonder vinkje geen opslag en geen doorsturen", async () => {
    const { container } = toon(); vul(container, { vink: false });
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() => expect(container.textContent).toContain("Zet het vinkje"));
    expect(m.rpc).not.toHaveBeenCalled(); expect(window.open).not.toHaveBeenCalled();
  });
  it("zonder geldig e-mailadres geen opslag en geen doorsturen", async () => {
    const { container } = toon(); vul(container, { email: "jan@" });
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() => expect(container.textContent).toContain("geldig e-mailadres"));
    expect(m.rpc).not.toHaveBeenCalled(); expect(window.open).not.toHaveBeenCalled();
  });
  it.each([["rekentool", AOV_REKENTOOL_URL], ["advies", AOV_ADVISEUR_URL]] as const)("%s: opslaan met toestemming en tekst, link met ref = aanmelding-id", async (doel, basis) => {
    m.rpc.mockResolvedValue({ data: ID, error: null });
    const { container } = toon(doel); vul(container);
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() => expect(container.textContent).toContain("Je aanmelding staat bij ZP Zaken."));
    expect(m.rpc).toHaveBeenCalledWith("aov_aanmelden", expect.objectContaining({ p_naam: "Jan Jansen", p_email: "jan@example.nl", p_toestemming: true, p_toestemming_tekst: AOV_TOESTEMMING_TEKST, p_doel: doel, p_bron: "test", p_honeypot: "" }));
    const url = new URL(tab.location.href);
    expect(url.origin + url.pathname).toBe(new URL(basis).origin + new URL(basis).pathname);
    expect(url.searchParams.get("ref")).toBe(ID);
    expect(url.searchParams.get("utm_source")).toBe("zpzaken");
    expect(tab.opener).toBeNull();
    expect(container.querySelector(`a[href*="ref=${ID}"]`)?.getAttribute("rel")).toContain("noopener");
  });
  it("mislukt opslaan: melding, tabblad dicht, geen doorsturen, wel kleine directe link", async () => {
    m.rpc.mockResolvedValue({ data: null, error: { message: "offline" } });
    const { container } = toon(); vul(container);
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() => expect(container.querySelector("[role=alert]")?.textContent).toContain("Probeer het opnieuw"));
    expect(tab.close).toHaveBeenCalled(); expect(tab.location.href).toBe("");
    expect(container.textContent).toContain("Toch direct naar de rekentool");
  });
  it("ingelogd: gegevens uit profiel, alleen vinkje en knop", async () => {
    m.session.mockResolvedValue({ data: { session: { user: { id: "u", email: "klant@example.nl", user_metadata: { full_name: "Klant Een" } } } } });
    const { container } = toon();
    await waitFor(() => expect(container.textContent).toContain("klant@example.nl"));
    expect(container.querySelector("#aov-naam")).toBeNull();
    expect(container.querySelector("#aov-toestemming")).not.toBeNull();
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

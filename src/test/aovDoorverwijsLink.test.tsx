// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
const mocks = vi.hoisted(() => ({ insert: vi.fn(), session: vi.fn(), ga: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getSession: mocks.session }, from: () => ({ insert: mocks.insert }) } }));
vi.mock("@/lib/tracking", () => ({ trackGa: mocks.ga }));
import { AovDoorverwijsLink } from "@/components/shared/AovDoorverwijsLink";
describe("AOV echte klikhandler", () => {
  beforeEach(() => { cleanup(); localStorage.clear(); sessionStorage.clear(); vi.clearAllMocks(); mocks.insert.mockResolvedValue({ error: null }); });
  it("één klik registreert de ingelogde klant met uitsluitend reeds geladen polisreferentie", async () => {
    const client = new QueryClient(); client.setQueryData(["portal-policies", "klant-id"], [{ certificate_number: "BAV-123" }]);
    mocks.session.mockResolvedValue({ data: { session: { user: { id: "klant-id" } } } });
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    const { getByRole } = render(<QueryClientProvider client={client}><AovDoorverwijsLink doel="advies">Advies</AovDoorverwijsLink></QueryClientProvider>);
    fireEvent.click(getByRole("link")); await vi.waitFor(() => expect(mocks.insert).toHaveBeenCalledTimes(1));
    const rij = mocks.insert.mock.calls[0][0];
    expect(rij).toEqual({ klik_id: expect.any(String), doel: "advies", bron: "test", user_id: "klant-id", klant_ref: "BAV-123" });
    expect(new URL(String(open.mock.calls[0][0])).searchParams.get("ref")).toBe(rij.klik_id);
    expect(mocks.ga).not.toHaveBeenCalled(); open.mockRestore();
  });
  it("mislukte registratie blokkeert niet en analytics bevat alleen doel na toestemming", async () => {
    mocks.session.mockResolvedValue({ data: { session: null } }); mocks.insert.mockRejectedValue(new Error("offline"));
    localStorage.setItem("zpzaken_cookie_consent", JSON.stringify({ version: "1.0", analytics: true }));
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    const { getByRole } = render(<QueryClientProvider client={new QueryClient()}><AovDoorverwijsLink doel="rekentool">Rekentool</AovDoorverwijsLink></QueryClientProvider>);
    fireEvent.click(getByRole("link")); await vi.waitFor(() => expect(mocks.insert).toHaveBeenCalledTimes(1));
    expect(open).toHaveBeenCalledTimes(1); expect(mocks.ga).toHaveBeenCalledWith("aov_doorverwijzing", { doel: "rekentool" }); open.mockRestore();
  });
});
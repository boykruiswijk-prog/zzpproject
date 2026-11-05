import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } } }));
vi.mock("@/lib/attributie", () => ({ leesAttributie: () => undefined }));
const terugbel = vi.fn();
const offerte = vi.fn();
vi.mock("@/lib/tracking", () => ({
  trackGenerateLead: vi.fn(), trackChatHandoff: vi.fn(), trackContactVerzonden: vi.fn(),
  isTestOmgeving: () => false,
  trackTerugbelVerzonden: (...a: unknown[]) => terugbel(...a),
  trackOfferteVerzonden: (...a: unknown[]) => offerte(...a),
}));

const { submitPublicForm } = await import("@/lib/antiSpam");
const guard = { honeypot: "", elapsedMs: () => 5000 };
const rij = (extra: Record<string, unknown>, type = "contact") =>
  ({ type, voornaam: "Jan", achternaam: "Jansen", email: "jan@example.nl", telefoon: "0612345678", extra_data: extra });

describe("terugbelverzoek vuurt in elke route na succes", () => {
  beforeEach(() => { invoke.mockReset(); terugbel.mockReset(); offerte.mockReset(); });

  it.each([
    ["TerugbelDialog / beroepspagina", { formulier_naam: "Terugbelverzoek", pagina: "/zzp-verzekering-ict" }],
    ["chat-overdracht", { bron: "chat-zeker", formulier_naam: "Terugbelverzoek chat Zeker", pagina: "/" }],
  ])("%s", async (_n, extra) => {
    invoke.mockResolvedValue({ data: { success: true, id: "x" }, error: null });
    await submitPublicForm("leads", rij(extra), guard);
    expect(terugbel).toHaveBeenCalledTimes(1);
    expect(terugbel).toHaveBeenCalledWith(false);
  });

  it("niet bij mislukte respons", async () => {
    invoke.mockResolvedValue({ data: { success: false, error: "nee" }, error: null });
    await expect(submitPublicForm("leads", rij({ formulier_naam: "Terugbelverzoek" }), guard)).rejects.toThrow();
    expect(terugbel).not.toHaveBeenCalled();
  });

  it("offerte alleen na succes, test-adres als test", async () => {
    invoke.mockResolvedValue({ data: { success: false, error: "nee" }, error: null });
    await expect(submitPublicForm("leads", rij({}, "offerte-aanvraag"), guard)).rejects.toThrow();
    expect(offerte).not.toHaveBeenCalled();
    invoke.mockResolvedValue({ data: { success: true, id: "x" }, error: null });
    await submitPublicForm("leads", { ...rij({}, "offerte-aanvraag"), email: "x@zpzaken.nl" }, guard);
    expect(offerte).toHaveBeenCalledWith(true);
  });
});

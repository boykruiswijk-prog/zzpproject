// @vitest-environment node
import { describe, it, expect } from "vitest";
import { starterBesluitKvk } from "../../supabase/functions/_shared/kvk";

const p = (ins: string, aanvang: string | null = null) => ({ datum_inschrijving: ins, datum_aanvang: aanvang });

describe("startertarief automatisch op KVK", () => {
  it("KVK bevestigt: automatisch goedgekeurd met toelichting", () => {
    expect(starterBesluitKvk(p("2026-01-15"), "2026-10-14", "kvk_api")).toEqual({ status: "goedgekeurd", toelichting: "Automatisch goedgekeurd op KVK-gegevens (ingeschreven 15-01-2026)" });
  });
  it("grens 12 maanden: op de dag zelf niet meer", () => {
    expect(starterBesluitKvk(p("2025-10-14"), "2026-10-13", "kvk_api").status).toBe("goedgekeurd");
    expect(starterBesluitKvk(p("2025-10-14"), "2026-10-14", "kvk_api").status).toBe("te_controleren");
  });
  it("alleen klantopgave of geen KVK: te controleren", () => {
    expect(starterBesluitKvk(p("2026-01-15"), "2026-10-14", "klant").status).toBe("te_controleren");
    expect(starterBesluitKvk(null, "2026-10-14", null).status).toBe("te_controleren");
  });
  it("datum aanvang wijkt meer dan 30 dagen af: te controleren", () => {
    const b = starterBesluitKvk(p("2026-01-15", "2025-11-01"), "2026-10-14", "kvk_api");
    expect(b.status).toBe("te_controleren");
    expect(b.toelichting).toContain("wijkt");
    expect(starterBesluitKvk(p("2026-01-15", "2026-01-01"), "2026-10-14", "kvk_api").status).toBe("goedgekeurd");
  });
});

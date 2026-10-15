// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
const rpc = vi.fn(async () => ({ error: null }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => (rpc as any)(...a) } }));
import { filterOpTab, isGeparkeerd, isOpvolgen, vlagFout, zetVlagVoor, verwijderVlagVoor } from "@/lib/leadVlag";

const V = "2026-10-13";
const klanten = [
  { id: "geen", naam: "A", vlag: null, vlag_datum: null },
  { id: "later_morgen", naam: "B", vlag: "later", vlag_datum: "2026-10-14" },
  { id: "later_vandaag", naam: "C", vlag: "later", vlag_datum: "2026-10-13" },
  { id: "later_gisteren", naam: "D", vlag: "later", vlag_datum: "2026-10-12" },
  { id: "actie_zonder", naam: "E", vlag: "actie", vlag_datum: null },
  { id: "actie_morgen", naam: "F", vlag: "actie", vlag_datum: "2026-10-14" },
  { id: "actie_vandaag", naam: "G", vlag: "actie", vlag_datum: "2026-10-13" },
];
const ids = (x: { id: string }[]) => x.map((l) => l.id);

describe("klantvlag-tabs", () => {
  it("Te doen", () => expect(ids(filterOpTab(klanten, "te_doen", V))).toEqual(["geen", "later_vandaag", "later_gisteren", "actie_vandaag"]));
  it("Gemarkeerd", () => expect(filterOpTab(klanten, "gemarkeerd", V)).toHaveLength(6));
  it("Alle", () => expect(filterOpTab(klanten, "alle", V)).toHaveLength(7));
  it("datumgrens", () => {
    expect(isGeparkeerd({ vlag: "later", vlag_datum: "2026-10-14" }, V)).toBe(true);
    expect(isGeparkeerd({ vlag: "later", vlag_datum: "2026-10-13" }, V)).toBe(false);
    expect(isOpvolgen({ vlag: "later", vlag_datum: "2026-10-13" }, V)).toBe(true);
    expect(isOpvolgen({ vlag: "actie", vlag_datum: null }, V)).toBe(false);
    expect(isGeparkeerd({ vlag: "actie", vlag_datum: null }, V)).toBe(true);
  });
});

describe("klantvlag-validatie", () => {
  it("identiek aan leads", () => {
    expect(vlagFout(null, "abc", "")).toMatch(/Kies/);
    expect(vlagFout("actie", "ab", "")).toMatch(/Notitie/);
    expect(vlagFout("actie", "x".repeat(501), "")).toMatch(/Notitie/);
    expect(vlagFout("later", "bellen", "")).toMatch(/opvolgdatum/);
    expect(vlagFout("later", "bellen", V)).toBeNull();
    expect(vlagFout("actie", "bellen", "")).toBeNull();
  });
});

describe("doel kiest de juiste RPC", () => {
  beforeEach(() => rpc.mockClear());
  it("klant", async () => {
    await zetVlagVoor("klant", "o1", "later", " bellen ", V);
    expect(rpc).toHaveBeenCalledWith("zet_klant_vlag", { _onderneming_id: "o1", _soort: "later", _notitie: "bellen", _datum: V });
    await verwijderVlagVoor("klant", "o1", " klaar ");
    expect(rpc).toHaveBeenCalledWith("verwijder_klant_vlag", { _onderneming_id: "o1", _toelichting: "klaar" });
  });
  it("lead", async () => {
    await zetVlagVoor("lead", "l1", "actie", "mailen", "");
    expect(rpc).toHaveBeenCalledWith("zet_lead_vlag", { _lead_id: "l1", _soort: "actie", _notitie: "mailen", _datum: null });
    await verwijderVlagVoor("lead", "l1", "klaar");
    expect(rpc).toHaveBeenCalledWith("verwijder_lead_vlag", { _lead_id: "l1", _toelichting: "klaar" });
  });
});

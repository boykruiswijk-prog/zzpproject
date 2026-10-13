// @vitest-environment node
import { describe, it, expect } from "vitest";
import { filterOpTab, isGeparkeerd, isOpvolgen, vlagFout, vandaagNL } from "@/lib/leadVlag";
import { tellerUitleg } from "@/lib/menuTellers";

const V = "2026-10-13";
const leads = [
  { id: "geen", vlag: null, vlag_datum: null },
  { id: "later_morgen", vlag: "later", vlag_datum: "2026-10-14" },
  { id: "later_vandaag", vlag: "later", vlag_datum: "2026-10-13" },
  { id: "later_gisteren", vlag: "later", vlag_datum: "2026-10-12" },
  { id: "actie_zonder", vlag: "actie", vlag_datum: null },
  { id: "actie_morgen", vlag: "actie", vlag_datum: "2026-10-14" },
  { id: "actie_vandaag", vlag: "actie", vlag_datum: "2026-10-13" },
];
const ids = (x: { id: string }[]) => x.map((l) => l.id);

describe("vlag-tabs", () => {
  it("Te doen: zonder geparkeerde vlaggen, wel bereikte datum", () => {
    expect(ids(filterOpTab(leads, "te_doen", V))).toEqual(["geen", "later_vandaag", "later_gisteren", "actie_vandaag"]);
  });
  it("Gemarkeerd: alle gevlagde", () => {
    expect(filterOpTab(leads, "gemarkeerd", V)).toHaveLength(6);
  });
  it("Alle: alles", () => {
    expect(filterOpTab(leads, "alle", V)).toHaveLength(7);
  });
  it("datumgrens: morgen geparkeerd, vandaag opvolgen", () => {
    expect(isGeparkeerd({ vlag: "later", vlag_datum: "2026-10-14" }, V)).toBe(true);
    expect(isGeparkeerd({ vlag: "later", vlag_datum: "2026-10-13" }, V)).toBe(false);
    expect(isOpvolgen({ vlag: "later", vlag_datum: "2026-10-13" }, V)).toBe(true);
    expect(isOpvolgen({ vlag: "actie", vlag_datum: null }, V)).toBe(false);
    expect(isGeparkeerd({ vlag: "actie", vlag_datum: null }, V)).toBe(true);
  });
  it("vandaag in NL-tijd, ook vlak na middernacht", () => {
    expect(vandaagNL(new Date("2026-10-13T22:30:00Z"))).toBe("2026-10-14");
    expect(vandaagNL(new Date("2026-10-13T21:30:00Z"))).toBe("2026-10-13");
  });
});

describe("vlag-validatie", () => {
  it("notitie 3-500 tekens en datum bij later", () => {
    expect(vlagFout(null, "abc", "")).toMatch(/Kies/);
    expect(vlagFout("actie", "ab", "")).toMatch(/Notitie/);
    expect(vlagFout("actie", "x".repeat(501), "")).toMatch(/Notitie/);
    expect(vlagFout("later", "bellen", "")).toMatch(/opvolgdatum/);
    expect(vlagFout("later", "bellen", V)).toBeNull();
    expect(vlagFout("actie", "bellen", "")).toBeNull();
  });
});

describe("teller-uitleg", () => {
  it("vermeldt gemarkeerd voor later", () => {
    expect(tellerUitleg("aanvragen", { aanvragen: 3, aanvragen_gemarkeerd: 2 })).toContain("(2 gemarkeerd voor later)");
    expect(tellerUitleg("leads", { leads: 1 })).not.toContain("gemarkeerd");
  });
});

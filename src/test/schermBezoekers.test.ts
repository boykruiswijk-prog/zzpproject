import { describe, it, expect } from "vitest";
import { normaliseerGaRijen, bouwBezoekersPayload, nieuwsteBezoekDag, nuOpSite, NU_OP_SITE_VENSTER_MS, topPlaatsen } from "../../supabase/functions/_shared/bezoekers";
import { bouwSchermPayload } from "../../supabase/functions/_shared/schermAnonimiseer";
import { coordinaatVoor, kaartPunten, PROVINCIE_MIDDEN, nieuweBezoekers } from "@/lib/bezoekersKaart";

describe("Bezoekerskaart A8", () => {
  it("normaliseert GA4: '(not set)' = onbekend, buitenland samengevat, provincie in het Nederlands", () => {
    const p = normaliseerGaRijen([
      { city: "Amsterdam", region: "North Holland", country: "Netherlands", aantal: "7" },
      { city: "(not set)", region: "(not set)", country: "Netherlands", aantal: "3" },
      { city: "Berlin", region: "Berlin", country: "Germany", aantal: "2" },
      { city: "Paris", region: "Ile-de-France", country: "France", aantal: "1" },
    ]);
    expect(p).toEqual([
      { plaats: "Amsterdam", provincie: "Noord-Holland", aantal: 7 },
      { plaats: "buitenland", provincie: "buitenland", aantal: 3 },
      { plaats: "onbekend", provincie: "onbekend", aantal: 3 },
    ]);
  });

  it("schermpayload bevat per plaats alleen plaats, provincie en aantal", () => {
    const b = bouwBezoekersPayload([
      { dag: "2026-11-05", soort: "dag", plaats: "Utrecht", provincie: "Utrecht", aantal: 4, bijgewerkt_op: "2026-11-05T12:00:00Z", ip: "1.2.3.4", email: "x@y.nl" } as never,
      { dag: "2026-11-05", soort: "totaal", plaats: "totaal", provincie: "totaal", aantal: 9 },
      { dag: "2026-11-04", soort: "dag", plaats: "Oud", provincie: "Utrecht", aantal: 99 },
    ], "2026-11-05");
    const p = bouwSchermPayload({ bezoekers: { ...b, extra: "geheim" } });
    expect(p.bezoekers?.totaal).toBe(9);
    for (const r of [...p.bezoekers!.plaatsen, ...p.bezoekers!.nu]) expect(Object.keys(r).sort()).toEqual(["aantal", "plaats", "provincie"]);
    expect(Object.keys(p.bezoekers!).sort()).toEqual(["bijgewerkt_op", "dag", "nu", "plaatsen", "totaal"]);
    const s = JSON.stringify(p.bezoekers);
    for (const v of ["1.2.3.4", "@", "geheim", "Oud"]) expect(s).not.toContain(v);
  });

  it("'(not set)'/onbekend en buitenland komen niet op de kaart of in de top 5", () => {
    const lijst = [{ plaats: "onbekend", provincie: "onbekend", aantal: 50 }, { plaats: "buitenland", provincie: "buitenland", aantal: 20 }, { plaats: "Rotterdam", provincie: "Zuid-Holland", aantal: 5 }];
    expect(kaartPunten(lijst).map((p) => p.plaats)).toEqual(["Rotterdam"]);
    expect(topPlaatsen(lijst).map((p) => p.plaats)).toEqual(["Rotterdam"]);
  });

  it("coördinaten uit de statische lijst, onbekende plaats valt terug op het provinciemidden", () => {
    const a = coordinaatVoor("Amsterdam", "Noord-Holland")!;
    expect(a.bron).toBe("plaats");
    expect(a.lat).toBeCloseTo(52.37, 1);
    expect(coordinaatVoor("Den Haag", "Zuid-Holland")?.bron).toBe("plaats");
    expect(coordinaatVoor("Bestaatnietdorp", "Zeeland")).toEqual({ lat: PROVINCIE_MIDDEN.Zeeland[0], lon: PROVINCIE_MIDDEN.Zeeland[1], bron: "provincie" });
    expect(coordinaatVoor("Bestaatnietdorp", "onbekend")).toBeNull();
  });

  it("boog vuurt opnieuw alleen bij plaatsen met meer bezoekers", () => {
    const vorig = new Map([["Utrecht", 3], ["Delft", 1]]);
    expect(nieuweBezoekers(vorig, [{ plaats: "Utrecht", provincie: "Utrecht", aantal: 4 }, { plaats: "Delft", provincie: "Zuid-Holland", aantal: 1 }])).toEqual(["Utrecht"]);
  });

  it("kaart valt terug op de meest recente dag met rijen als vandaag nog leeg is", () => {
    expect(nieuwsteBezoekDag(["2026-11-05", "2026-11-06"], "2026-11-06")).toBe("2026-11-06");
    expect(nieuwsteBezoekDag(["2026-11-04", "2026-11-05"], "2026-11-06")).toBe("2026-11-05");
    expect(nieuwsteBezoekDag([], "2026-11-06")).toBe("2026-11-06");
    expect(nieuwsteBezoekDag([null, undefined], "2026-11-06")).toBe("2026-11-06");
  });

  it("kaarttitel noemt de afgelopen 7 dagen en niet 'vandaag'", () => {
    const bron = readFileSync("src/components/scherm/BezoekersKaart.tsx", "utf8");
    expect(bron).toContain("Bezoekers afgelopen 7 dagen");
    expect(bron).not.toMatch(/Bezoekers vandaag/);
  });

  it("'Nu op de site' telt alleen de laatste 5 minuten en zakt daarna", () => {
    const nu = Date.parse("2026-11-05T12:00:00Z");
    const t = ["2026-11-05T11:59:00Z", "2026-11-05T11:56:00Z", "2026-11-05T11:54:59Z"];
    expect(NU_OP_SITE_VENSTER_MS).toBe(5 * 60_000);
    expect(nuOpSite(t, nu)).toBe(2);
    expect(nuOpSite(t, nu + 2 * 60_000)).toBe(1);
    expect(nuOpSite(t, nu + 6 * 60_000)).toBe(0);
  });
});

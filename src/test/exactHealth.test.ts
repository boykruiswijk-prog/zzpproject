import { describe, expect, it } from "vitest";
import { amsterdamDagGrenzen, bepaalExactHealth, herkoppelenVoor } from "@/lib/exactHealth";

const now = new Date("2026-09-30T11:40:00Z");

describe("bepaalExactHealth", () => {
  it("groen bij geen fout en keepalive < 26 uur", () => {
    expect(bepaalExactHealth({ isActief: true, lastError: null, laatsteKeepaliveSucces: "2026-09-30T03:17:04Z", now }).kind).toBe("ok");
  });
  it("oranje bij keepalive >= 26 uur of ontbrekend", () => {
    expect(bepaalExactHealth({ isActief: true, lastError: null, laatsteKeepaliveSucces: "2026-09-29T09:40:00Z", now }).kind).toBe("verouderd");
    expect(bepaalExactHealth({ isActief: true, lastError: "", laatsteKeepaliveSucces: null, now }).kind).toBe("verouderd");
  });
  it("rood bij last_error, met melding", () => {
    const h = bepaalExactHealth({ isActief: true, lastError: "Token vernieuwen mislukt", laatsteKeepaliveSucces: "2026-09-30T03:17:04Z", now });
    expect(h).toEqual({ kind: "fout", label: "Koppeling werkt niet", melding: "Token vernieuwen mislukt" });
  });
  it("niet actief", () => {
    expect(bepaalExactHealth({ isActief: false, lastError: null, laatsteKeepaliveSucces: null, now }).kind).toBe("niet_actief");
  });
});

describe("herkoppelenVoor", () => {
  it("refresh + 30 dagen", () => {
    expect(herkoppelenVoor("2026-09-30T11:03:43Z")?.toISOString()).toBe("2026-10-30T11:03:43.000Z");
    expect(herkoppelenVoor(null)).toBeNull();
  });
});

describe("amsterdamDagGrenzen", () => {
  it("zomertijd: middernacht = 22:00 UTC vorige dag; keepalive 05:17 valt erin", () => {
    const g = amsterdamDagGrenzen(now);
    expect(g).toEqual({ start: "2026-09-29T22:00:00.000Z", eind: "2026-09-30T22:00:00.000Z" });
    expect("2026-09-30T03:17:04Z" >= g.start && "2026-09-30T03:17:04Z" < g.eind).toBe(true);
  });
  it("wintertijd: middernacht = 23:00 UTC", () => {
    expect(amsterdamDagGrenzen(new Date("2026-12-15T23:30:00Z")).start).toBe("2026-12-15T23:00:00.000Z");
  });
  it("dag van de klokwissel (25 okt 2026)", () => {
    expect(amsterdamDagGrenzen(new Date("2026-10-25T12:00:00Z"))).toEqual({ start: "2026-10-24T22:00:00.000Z", eind: "2026-10-25T23:00:00.000Z" });
  });
});

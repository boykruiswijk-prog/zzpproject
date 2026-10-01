import { describe, expect, it } from "vitest";
import { berekenOpzegCredit } from "../../supabase/functions/_shared/creditOpzegging.ts";

describe("creditnota bij opzegging (naar rato per dag)", () => {
  it("maandcontract: 16 van 30 dagen terug", () => {
    const r = berekenOpzegCredit("2026-11-30", [{ periode_start: "2026-11-17", periode_eind: "2026-12-16", bedrag: 55 }]);
    expect(r.regels[0].resterende_dagen).toBe(16);
    expect(r.bedrag).toBe(29.33);
  });
  it("jaarcontract: 320 van 365 dagen terug", () => {
    const r = berekenOpzegCredit("2026-11-30", [{ periode_start: "2026-10-17", periode_eind: "2027-10-16", bedrag: 600 }]);
    expect(r.regels[0].resterende_dagen).toBe(320);
    expect(r.bedrag).toBe(526.03);
  });
  it("volle latere periode telt helemaal mee, periode vóór einddatum niet", () => {
    const r = berekenOpzegCredit("2026-11-30", [
      { periode_start: "2026-10-17", periode_eind: "2026-11-16", bedrag: 55 },
      { periode_start: "2026-12-17", periode_eind: "2027-01-16", bedrag: 55 },
    ]);
    expect(r.regels).toHaveLength(1);
    expect(r.bedrag).toBe(55);
  });
  it("niets na einddatum: nul", () => {
    expect(berekenOpzegCredit("2026-12-31", [{ periode_start: "2026-11-17", periode_eind: "2026-12-16", bedrag: 55 }]).bedrag).toBe(0);
  });
});

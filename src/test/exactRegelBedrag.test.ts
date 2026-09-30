import { describe, it, expect } from "vitest";
import { exactRegelBedrag } from "../../supabase/functions/_shared/factuurTekst";
describe("exactRegelBedrag", () => {
  it("8021 creditnota: Quantity -1, UnitPrice positief", () => {
    expect(exactRegelBedrag(8021, 600)).toEqual({ Quantity: -1, UnitPrice: 600 });
    expect(exactRegelBedrag(8021, -598.36)).toEqual({ Quantity: -1, UnitPrice: 598.36 });
  });
  it("8020 factuur: Quantity 1, UnitPrice positief", () => {
    expect(exactRegelBedrag(8020, 600)).toEqual({ Quantity: 1, UnitPrice: 600 });
  });
  it("regelbedrag = Quantity × UnitPrice is negatief voor 8021", () => {
    const r = exactRegelBedrag(8021, 1);
    expect(r.Quantity * r.UnitPrice).toBe(-1);
  });
});

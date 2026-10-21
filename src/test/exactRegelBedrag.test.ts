import { describe, it, expect } from "vitest";
import { exactRegelBedrag } from "../../supabase/functions/_shared/factuurTekst";
import { oudSysteemCreditPayload } from "../../supabase/functions/_shared/creditOpzegging";
describe("exactRegelBedrag (besluit 21-10-2026)", () => {
  it("creditnota: aantal -1, prijs positief, totaal negatief", () => {
    const r = exactRegelBedrag(8021, 69.04);
    expect(r).toEqual({ Quantity: -1, UnitPrice: 69.04 });
    expect(r.Quantity * r.UnitPrice).toBe(-69.04);
  });
  it("geen dubbele min bij negatieve invoer", () => {
    expect(exactRegelBedrag(8021, -598.36)).toEqual({ Quantity: -1, UnitPrice: 598.36 });
    expect(exactRegelBedrag(8021, -10, -2)).toEqual({ Quantity: -2, UnitPrice: 10 });
  });
  it("gewone factuur blijft positief", () => {
    expect(exactRegelBedrag(8020, 600)).toEqual({ Quantity: 1, UnitPrice: 600 });
    expect(exactRegelBedrag(8020, 55, 3)).toEqual({ Quantity: 3, UnitPrice: 55 });
  });
  it("oud-systeem creditpayload heeft negatief aantal", () => {
    const p = oudSysteemCreditPayload({ creditsleutel: "ZPC-8DB774D6", exact_account_id: "acc", exact_item_id: "item", einddatum: "2026-12-31", credit_vanaf: "2027-01-01", credit_tm: "2027-02-11", vandaag: "2026-10-21", btw_code: "0",
      regels: [{ credit_vanaf: "2027-01-01", periode_eind: "2027-02-11", credit_bedrag: 69.04 }] });
    const l = p.SalesInvoiceLines[0] as { Quantity: number; UnitPrice: number };
    expect(l.Quantity).toBe(-1); expect(l.UnitPrice).toBe(69.04);
  });
});

// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { berekenCreditVoorPlanner, berekenOpzegCredit, plannerCreditPayload } from "../../supabase/functions/_shared/creditOpzegging";

describe("D-aanvulling Creditplanner 7-11", () => {
  const perioden = [{ periode_start: "2026-10-20", periode_eind: "2027-10-19", bedrag: 600 }];
  const korting = { bedrag: 60, jaarpremie: 600, korting_pct: 10 };
  it("ZPC-0E5D7316: akkoord 60 blijft 60 in concept, niet de volledige jaarpremie 600", () => {
    const herbereken = vi.fn(() => berekenOpzegCredit("2026-10-19", perioden));
    expect(herbereken().bedrag).toBe(600);
    herbereken.mockClear();
    const resultaat = berekenCreditVoorPlanner({ bron: "correctie", bedrag: 60, berekening: korting }, herbereken);
    expect(resultaat.bedrag).toBe(60);
    expect(resultaat.berekening).toEqual(korting);
    expect(herbereken).not.toHaveBeenCalled();
    const payload = plannerCreditPayload({ exact_account_id: "cfo360", item: "BAV-AVB", btw: "0", bedrag: resultaat.bedrag,
      credit_vanaf: "2026-10-20", credit_tm: "2027-10-19", origineel_factuurnummer: "26700072", creditsleutel: "ZPC-0E5D7316", vandaag: "2026-11-07", bron: "correctie" });
    expect(payload.SalesInvoiceLines[0].UnitPrice).toBe(60);
    expect(payload.SalesInvoiceLines[0].Quantity).toBe(-1);
  });
  it.each(["planner", "oud_systeem"])("handmatig bedrag 60 blijft vast bij bron %s", (bron) => {
    const herbereken = vi.fn(() => berekenOpzegCredit("2026-10-19", perioden));
    expect(berekenCreditVoorPlanner({ bron, bedrag: 60, bedrag_handmatig: true, berekening: korting }, herbereken).bedrag).toBe(60);
    expect(herbereken).not.toHaveBeenCalled();
  });
  it("gewone opzegcredit behoudt de bestaande berekening", () => {
    expect(berekenCreditVoorPlanner({ bron: "planner", bedrag: 0 }, () => berekenOpzegCredit("2026-10-19", perioden)).bedrag).toBe(600);
  });
});
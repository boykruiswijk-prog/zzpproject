// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { berekenCreditVoorPlanner, berekenOpzegCredit, plannerCreditPayload, heeftVastCreditBedrag } from "../../supabase/functions/_shared/creditOpzegging";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

describe("D-aanvulling Creditplanner 7-11", () => {
  const perioden = [{ periode_start: "2026-10-20", periode_eind: "2027-10-19", bedrag: 600 }];
  const korting = { bedrag: 60, jaarpremie: 600, korting_pct: 10 };
  it("werkelijke plannerlus overschrijft het goedgekeurde bedrag niet", async () => {
    const bron = readFileSync("supabase/functions/factuur-planner/index.ts", "utf8");
    const start = bron.indexOf("for (const c of creditRijen ?? [])");
    const loop = bron.slice(start, bron.indexOf("const creditOverzicht", start))
      .split("(pl ?? []) as any[]").join("(pl ?? [])").split("(m as any)").join("m").split("(k as any)").join("k").split("k as any").join("k").split("(x: any)").join("(x)");
    const rij = { id: "test", bron: "correctie", status: "te_maken", planning_ids: ["test"], bedrag: 60, berekening: korting, einddatum: "2026-10-19" };
    const update = vi.fn();
    const query = { select: () => query, in: async () => ({ data: [{ ...perioden[0], btw_code: "0" }] }), update, eq: async () => ({}) };
    await runInNewContext(`(async () => { ${loop} })()`, { creditRijen: [rij], credits: [], admin: { from: () => query }, berekenCreditVoorPlanner, heeftVastCreditBedrag, berekenOpzegCredit, btwCode: (v: string) => v });
    expect(rij.bedrag).toBe(60);
    expect(rij.berekening).toEqual(korting);
    expect(update).not.toHaveBeenCalled();
  });
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
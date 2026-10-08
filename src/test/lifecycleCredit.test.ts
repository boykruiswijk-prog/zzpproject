// @vitest-environment node
import { describe, expect, it } from "vitest";
import { maandLifecycleCredit } from "../../supabase/functions/_shared/lifecycleCredit";

function database(monthly: object[], planning: object[] = []) {
  return { from(table: string) {
    const result = { data: table === "monthly_invoices_log" ? monthly : table === "klant_contracten" ? { id: "contract" } : planning, error: null };
    const chain = { select: () => chain, eq: () => chain, in: () => Promise.resolve(result), maybeSingle: () => Promise.resolve(result), then: (resolve: (r: typeof result) => unknown) => Promise.resolve(result).then(resolve) };
    return chain;
  } };
}

describe("monthly lifecycle credit", () => {
  const lead = { id: "6fc3e1e1-e98a-4401-94ff-9c4f8bfa9393", ingangsdatum: "2026-10-01", exact_invoice_id: "invoice", exact_invoice_amount: 55 };
  it("credits only remaining paid days, not an annual premium", async () => {
    const credit = await maandLifecycleCredit(database([]), lead, "2026-10-12");
    expect(credit.credit_bedrag).toBe(33.71);
    expect(credit.resterende_dagen).toBe(19);
    expect(credit.credit_vanaf).toBe("2026-10-13");
  });
  it("deduplicates the same invoice across legacy log and planner", async () => {
    const period = { exact_invoice_id: "invoice", periode_start: "2026-10-01", periode_eind: "2026-10-31", bedrag: 55, status: "success" };
    const credit = await maandLifecycleCredit(database([period], [period]), lead, "2026-10-12");
    expect(credit.perioden).toHaveLength(1);
    expect(credit.credit_bedrag).toBe(33.71);
  });
  it("does not credit failed invoices or uninvoiced periods", async () => {
    const credit = await maandLifecycleCredit(database([{ exact_invoice_id: "failed", periode_start: "2026-10-01", periode_eind: "2026-10-31", bedrag: 55, status: "failed" }]), { id: lead.id, ingangsdatum: lead.ingangsdatum }, "2026-10-12");
    expect(credit.credit_bedrag).toBe(0);
  });
  it("credits only BAV + AVB when a current cyber year remains active", async () => {
    const cyberLead = {
      ...lead,
      gekozen_pakket: "maandelijks-cyber",
      cyber_voorwaarden_versie: "2026-10-08",
      exact_invoice_amount: 82.5,
    };
    const credit = await maandLifecycleCredit(database([]), cyberLead, "2026-10-12");
    expect(credit.credit_bedrag).toBe(33.71);
    expect(credit.perioden[0]?.bedrag).toBe(55);
  });
});
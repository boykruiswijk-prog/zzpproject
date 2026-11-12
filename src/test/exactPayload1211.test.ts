import { describe, it, expect } from "vitest";
import { bouwFactuurPayload } from "../../supabase/functions/_shared/factuurRegel";
import { controleerExactFactuurPayload, SALES_INVOICE_VELDEN, SALES_INVOICE_LINE_VELDEN } from "../../supabase/functions/_shared/exactFactuurVelden";
import { oudSysteemCreditPayload, plannerCreditPayload } from "../../supabase/functions/_shared/creditOpzegging";
import { readFileSync, readdirSync } from "node:fs";

describe("InvoiceText besluit 12 november", () => {
  it("stuurt geen InvoiceText naar Exact", () => {
    const p = bouwFactuurPayload({ exact_item_id: "i", exact_account_id: "a", aantal: 1, bedrag_per_periode: 55, gl_code: "8003", btw_code: "0", periode_start: "2026-11-12", periode_eind: "2026-12-11" }, null, "ZPF-TEST", "Remarks");
    expect(p).not.toHaveProperty("InvoiceText");
  });
  const factuur = () => bouwFactuurPayload({ exact_item_id: "i", exact_account_id: "a", aantal: 1, bedrag_per_periode: 55, gl_code: "8003", btw_code: "0", periode_start: "2026-11-12", periode_eind: "2026-12-11" }, "gl", "ZPF-TEST", "YourRef");
  const credit = () => plannerCreditPayload({ exact_account_id: "a", item: "i", btw: "0", gl: "gl", bedrag: 60, credit_vanaf: "2026-11-12", credit_tm: "2026-12-11", origineel_factuurnummer: "123", creditsleutel: "ZPC-TEST", vandaag: "2026-11-12", bron: "correctie" });
  const oud = () => oudSysteemCreditPayload({ exact_account_id: "a", exact_item_id: "i", gl_account_id: "gl", btw_code: "0", creditsleutel: "ZPC-TEST", einddatum: "2026-11-11", credit_vanaf: "2026-11-12", credit_tm: "2026-12-11", vandaag: "2026-11-12", regels: [{ credit_vanaf: "2026-11-12", periode_eind: "2026-12-11", credit_bedrag: 60 }] });
  it.each([factuur, credit, oud])("toetst elke kop- en regelsleutel aan de vaste lijsten", (maak) => {
    const p = maak();
    expect(() => controleerExactFactuurPayload(p)).not.toThrow();
    for (const key of Object.keys(p)) expect(SALES_INVOICE_VELDEN).toContain(key);
    for (const line of p.SalesInvoiceLines) for (const key of Object.keys(line)) expect(SALES_INVOICE_LINE_VELDEN).toContain(key);
  });
  it.each([8020, 8021])("weigert onbekende kopvelden vóór verzending voor type %s", (Type) => {
    expect(() => controleerExactFactuurPayload({ ...factuur(), Type, InvoiceText: "ongeldig" })).toThrow("niet toegestaan veld InvoiceText");
    expect(() => controleerExactFactuurPayload({ ...factuur(), Type, NieuwOnbekendVeld: true })).toThrow("NieuwOnbekendVeld");
  });
  it.each([8020, 8021])("weigert onbekende regelsleutels voor type %s", (Type) => {
    const p = factuur();
    expect(() => controleerExactFactuurPayload({ ...p, Type, SalesInvoiceLines: [{ ...p.SalesInvoiceLines[0], OnbekendeRegel: true }] })).toThrow("OnbekendeRegel");
  });
  it("alle SalesInvoices-verzenders hebben de gedeelde controle en geen InvoiceText-veld", () => {
    const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((f) => f.isDirectory() ? walk(`${dir}/${f.name}`) : f.name.endsWith(".ts") ? [`${dir}/${f.name}`] : []);
    const senders = walk("supabase/functions").filter((path) => {
      const s = readFileSync(path, "utf8");
      return /(?:fetch\(`[^`]*salesinvoice\/SalesInvoices`[\s\S]{0,100}?method:\s*"POST"|exact\("salesinvoice\/SalesInvoices",\s*\{\s*method:\s*"POST")/.test(s);
    });
    expect(senders.sort()).toEqual(["exact-diagnose-itemgroups", "factuur-planner", "lead-to-exact-activate", "polis-lifecycle"].map((f) => `supabase/functions/${f}/index.ts`));
    for (const path of senders) {
      const s = readFileSync(path, "utf8");
      expect(s).toContain("controleerExactFactuurPayload(");
      expect(s).not.toMatch(/\bInvoiceText\s*:/);
    }
  });
});
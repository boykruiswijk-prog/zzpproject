// @vitest-environment node
import { describe, it, expect } from "vitest";
import { berekenOudSysteemCredit, oudSysteemCreditPayload } from "../../supabase/functions/_shared/creditOpzegging";
import { readFileSync } from "node:fs";

const jaar = { cyclus: "jaar", aantal: 1, bedrag_per_periode: 540, begin_datum: "2024-10-05", factureren_vanaf: "2024-10-05", gefactureerd_tm: "2027-10-04" };

describe("creditnota oud systeem", () => {
  it("jaar naar rato + volledige periode (Peschier)", () => {
    const r = berekenOudSysteemCredit(jaar, "2026-10-02");
    expect(r.regels.map((x) => x.credit_bedrag)).toEqual([2.96, 540]);
    expect(r.bedrag).toBe(542.96);
  });
  it("maand naar rato", () => {
    const r = berekenOudSysteemCredit({ cyclus: "maand", aantal: 1, bedrag_per_periode: 55, begin_datum: "2026-01-01", factureren_vanaf: null, gefactureerd_tm: "2026-10-31" }, "2026-10-15");
    expect(r.regels).toHaveLength(1);
    expect(r.regels[0].resterende_dagen).toBe(16);
    expect(r.bedrag).toBe(Math.round((55 / 31) * 16 * 100) / 100);
  });
  it("volledige periode na einddatum = volledig bedrag", () => {
    const r = berekenOudSysteemCredit({ ...jaar, gefactureerd_tm: "2027-10-04" }, "2026-10-04");
    expect(r.bedrag).toBe(540);
  });
  it("sleutel in Remarks en YourRef; payload concept 8021", () => {
    const r = berekenOudSysteemCredit(jaar, "2026-10-02");
    const p = oudSysteemCreditPayload({ creditsleutel: "ZPC-ABCDEF12", exact_account_id: "a", exact_item_id: "i", einddatum: "2026-10-02", credit_vanaf: r.vanaf, credit_tm: "2027-10-04", vandaag: "2026-10-02", regels: r.regels });
    expect(p.Type).toBe(8021); expect(p.Status).toBe(20);
    for (const l of p.SalesInvoiceLines as { Quantity: number; UnitPrice: number }[]) {
      expect(l.Quantity).toBe(1); expect(l.UnitPrice).toBeGreaterThan(0);
    }
    expect(p.YourRef).toBe("ZPC-ABCDEF12"); expect(p.Remarks).toContain("ZPC-ABCDEF12");
    expect(p.Description.length).toBeLessThanOrEqual(60);
  });
  it("geen dubbele credit: sleutel uniek per contract+opzegging en planner controleert Exact op sleutel", () => {
    const sql = readFileSync("drizzle/migrations/0035_opzeg_credit_oud_systeem.sql", "utf8");
    expect(sql).toMatch(/ON CONFLICT \(klant_contract_id, aanvraag_id\)/);
    expect(sql).toMatch(/md5\(_contract_id::text \|\| _aanvraag_id::text\)/);
    expect(readFileSync("supabase/functions/factuur-planner/index.ts", "utf8")).toContain('zoekOpSleutel(c.creditsleutel, "Remarks")).length) throw');
  });
  it("geblokkeerd zonder artikelmapping of Exact-koppeling", () => {
    const sql = readFileSync("drizzle/migrations/0035_opzeg_credit_oud_systeem.sql", "utf8");
    expect(sql).toMatch(/v_status := 'geblokkeerd';\s*v_melding := 'geen bevestigde artikelmapping/);
    expect(sql).toContain("relatie niet gekoppeld aan Exact");
  });
});

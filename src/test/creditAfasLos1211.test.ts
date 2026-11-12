// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { kiesCreditRoute, losseCreditPayload, ontbrekendCreditMelding } from "../../supabase/functions/_shared/creditOpzegging";
import { controleerExactFactuurPayload } from "../../supabase/functions/_shared/exactFactuurVelden";

const basis = { exact_account_id: "acc", _item: "item", origineel_factuurnummer: null };

describe("losse creditnota bij AFAS-factuur (besluit Boy 12-11-2026)", () => {
  it("correctie zonder origineel factuurnummer wordt een losse creditnota", () => {
    expect(kiesCreditRoute({ ...basis, bron: "correctie", bedrag: 60 })).toEqual({ route: "los" });
  });
  it("oud systeem met vast bedrag wordt een losse creditnota", () => {
    expect(kiesCreditRoute({ ...basis, bron: "oud_systeem", bedrag_handmatig: true })).toEqual({ route: "los" });
  });
  it("oud systeem met berekend bedrag houdt de bestaande route", () => {
    expect(kiesCreditRoute({ ...basis, bron: "oud_systeem" })).toEqual({ route: "oud" });
  });
  it("correctie met origineel factuurnummer blijft bij die factuur", () => {
    expect(kiesCreditRoute({ ...basis, bron: "correctie", origineel_factuurnummer: "26100123" })).toEqual({ route: "factuur" });
  });
  it("opzegging zonder factuurnummer blijft geblokkeerd", () => {
    expect(kiesCreditRoute({ ...basis, bron: "opzegging" })).toEqual({ route: "ontbreekt", ontbreekt: ["oorspronkelijk factuurnummer"] });
  });
  it("ontbrekende relatie of artikel wordt genoemd", () => {
    expect(kiesCreditRoute({ bron: "correctie", exact_account_id: null, _item: null })).toEqual({ route: "ontbreekt", ontbreekt: ["Exact-relatie", "artikel"] });
  });
  it("payload: bestaande relatie, artikel, btw, periode en creditsleutel als referentie, door de allowlist", () => {
    const p = losseCreditPayload({ exact_account_id: "acc", item: "item", btw: "0", gl: "gl", bedrag: 60, credit_vanaf: "2026-09-12", credit_tm: "2027-09-11", creditsleutel: "ZPC-01D80B50", vandaag: "2026-11-12" });
    expect(() => controleerExactFactuurPayload(p)).not.toThrow();
    expect(p.Type).toBe(8021);
    expect(p.Status).toBe(20);
    expect(p.InvoiceTo).toBe("acc");
    expect(p.YourRef).toBe("ZPC-01D80B50");
    expect(p.Remarks).toContain("ZPC-01D80B50");
    const r = p.SalesInvoiceLines[0] as Record<string, unknown>;
    expect(r.Item).toBe("item");
    expect(r.VATCode).toBe("0");
    expect(r.Description).toBe("Credit 12-09-2026 t/m 11-09-2027");
    expect(Math.abs(Number(r.Quantity) * Number(r.UnitPrice))).toBe(60);
  });
  it("melding aan Ellen noemt wat ontbreekt", () => {
    const m = ontbrekendCreditMelding({ creditsleutel: "ZPC-X", credit_vanaf: "2026-01-01", credit_tm: "2026-12-31" }, ["Exact-relatie"]);
    expect(m.onderdeel).toBe("admin");
    expect(m.omschrijving).toContain("Exact-relatie");
    expect(m.titel).toContain("ZPC-X");
  });
  it("planner zet een ontbrekende relatie nooit op handmatig_afgehandeld", () => {
    const src = readFileSync("supabase/functions/factuur-planner/index.ts", "utf8");
    const blok = src.slice(src.indexOf('keuze.route === "ontbreekt"'), src.indexOf("const oud = keuze.route"));
    expect(blok).toContain('status: "geblokkeerd"');
    expect(blok).toContain("wijzigingsmeldingen");
    expect(blok).not.toContain("handmatig_afgehandeld");
  });
});

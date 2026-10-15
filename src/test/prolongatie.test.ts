// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { isProlongatieKandidaat } from "@/lib/prolongatie";

const basis = { cyclus: "jaar", status: "actief", is_test: false, volgende_factuurdatum: "2026-10-29", opgezegd: false };
describe("prolongatie jaarpolis", () => {
  it("selectie precies 14 dagen vooruit", () => {
    expect(isProlongatieKandidaat(basis, "2026-10-15")).toBe(true);
    expect(isProlongatieKandidaat(basis, "2026-10-14")).toBe(false);
    expect(isProlongatieKandidaat(basis, "2026-10-16")).toBe(false);
  });
  it("opgezegd, maand en test uitgesloten", () => {
    expect(isProlongatieKandidaat({ ...basis, opgezegd: true }, "2026-10-15")).toBe(false);
    expect(isProlongatieKandidaat({ ...basis, cyclus: "maand" }, "2026-10-15")).toBe(false);
    expect(isProlongatieKandidaat({ ...basis, is_test: true }, "2026-10-15")).toBe(false);
  });
  it("SQL gebruikt dezelfde regels en log is uniek", () => {
    const sql = readFileSync("drizzle/migrations/0145_0145_prolongatie_rechten.sql", "utf8");
    expect(sql).toContain("k.cyclus = 'jaar'");
    expect(sql).toContain("public.contract_opzegging(k.id) IS NULL");
    expect(sql).toContain("NOT k.is_test");
    expect(readFileSync("drizzle/migrations/0144_0144_klantmails_incasso_prolongatie.sql", "utf8")).toContain("UNIQUE (klant_contract_id, verlengdatum)");
    expect(readFileSync("src/lib/prolongatie.ts", "utf8")).toBe(readFileSync("supabase/functions/_shared/prolongatie.ts", "utf8"));
  });
});

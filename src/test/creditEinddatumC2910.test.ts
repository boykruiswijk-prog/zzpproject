import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { standaardLaatsteDekkingsdag, verwachtCredit } from "@/lib/creditVoorstel";

const ingenuity = { cyclus: "jaar", aantal: 1, bedrag_per_periode: 600, begin_datum: "2024-09-25", factureren_vanaf: "2024-09-25", gefactureerd_tm: "2027-09-24" };

describe("C-aanvulling 29-10: laatste dag van de dekking", () => {
  it("standaard = dag vóór de verlengdatum (Ingenuity: 25-09 -> 24-09)", () => {
    expect(standaardLaatsteDekkingsdag({ ...ingenuity, volgende_factuurdatum: "2026-09-25" }, "2026-09-20")).toBe("2026-09-24");
  });
  it("verlengdatum voorbij: dag vóór de laatst gestarte periode", () => {
    expect(standaardLaatsteDekkingsdag({ ...ingenuity, volgende_factuurdatum: "2026-09-25" }, "2026-10-29")).toBe("2026-09-24");
  });
  it("Ingenuity: laatste dag 24-09-2026 geeft precies EUR 600,00 over 25-09-2026 t/m 24-09-2027", () => {
    const v = verwachtCredit(ingenuity, "2026-09-24");
    expect(v).toMatchObject({ bedrag: 600, vanaf: "2026-09-25", tm: "2027-09-24" });
  });
  it("één dag te laat (25-09) maakt het verschil zichtbaar: minder dan EUR 600", () => {
    expect(verwachtCredit(ingenuity, "2026-09-25")!.bedrag).toBeLessThan(600);
  });
});

describe("crm_einddatum_wijzigen herberekent ook wacht_op_akkoord", () => {
  const dir = "drizzle/migrations";
  const f = readdirSync(dir).filter((x) => x.includes("einddatum_credit_wacht_op_akkoord"))[0];
  const sql = readFileSync(`${dir}/${f}`, "utf8");
  it("update geldt voor te_maken, geblokkeerd, fout en wacht_op_akkoord", () => {
    expect(sql).toMatch(/status IN \('te_maken','geblokkeerd','fout','wacht_op_akkoord'\)/);
  });
  it("blokkade bij Exact-statussen blijft", () => {
    expect(sql).toContain("status IN ('geclaimd','concept_aangemaakt','verwerkt','te_laat')");
  });
  it("status wordt niet gewijzigd en beoordeling blijft leeg", () => {
    const upd = sql.slice(sql.indexOf("UPDATE public.factuur_credit_planning"), sql.indexOf("GET DIAGNOSTICS"));
    expect(upd).not.toMatch(/SET[^;]*\bstatus\s*=/);
    expect(upd).toContain("beoordeeld_op = CASE WHEN status = 'wacht_op_akkoord' THEN NULL");
    expect(upd).toContain("bedrag = NULL");
    expect(upd).toContain("credit_vanaf = _einddatum + 1");
  });
});

describe("admin-dialogen", () => {
  const src = readFileSync("src/components/admin/crm/LopendeProducten.tsx", "utf8");
  it("datumveld heet 'Laatste dag van de dekking' met hulptekst", () => {
    expect(src).toContain('"Laatste dag van de dekking"');
    expect(src).toContain('"De creditnota loopt vanaf de dag erna"');
    expect(src.match(/<CreditVoorbeeld/g)?.length).toBe(2);
  });
});

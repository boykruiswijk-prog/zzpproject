// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const sql = readFileSync("drizzle/migrations/0291_klanttelling_verstreken_opzegging_1411.sql", "utf8");

function functie(naam: string): string {
  const start = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${naam}(`);
  expect(start).toBeGreaterThanOrEqual(0);
  const einde = sql.indexOf("\n$$;", start);
  expect(einde).toBeGreaterThan(start);
  return sql.slice(start, einde);
}

describe("A6: verstreken opzegging en stilzwijgende verlenging", () => {
  it("gebruikt de opzegdatum ten opzichte van vandaag in alle actuele tellers", () => {
    for (const naam of ["tel_klanten", "tel_contracten", "tel_klanten_set"]) {
      const f = functie(naam);
      expect(f).toContain("coalesce(public.contract_opzegging(k.id), date '9999-12-31') >= (now() AT TIME ZONE 'Europe/Amsterdam')::date");
      expect(f).not.toContain("k.eind_datum <");
    }
  });

  it("gebruikt dezelfde opzeggrens historisch en nooit eind_datum als opzegging", () => {
    const f = functie("tel_klanten_set_op");
    expect(f).toContain("coalesce(public.contract_opzegging(k.id), date '9999-12-31') >= _op");
    expect(f).not.toContain("coalesce(k.eind_datum");
    expect(f).toContain("k.status <> 'vervangen'");
  });

  it("houdt de productsplitsing op het scherm gelijk aan tel_contracten", () => {
    expect(functie("scherm_groei")).toContain("coalesce(public.contract_opzegging(k.id), date '9999-12-31') >= v_vandaag");
  });

  it("bewaakt beide testcontracten nu en historisch in het terugdraaibare scenario", () => {
    const f = functie("_ts_telling_admin_tv");
    for (const naam of [
      "verstreken opzegging telt nu niet",
      "verlopen einddatum zonder opzegging telt nu wel",
      "opzegdatum zelf telt historisch nog",
      "dag na opzegdatum telt historisch niet",
      "verlopen einddatum zonder opzegging telt historisch wel",
      "contracttelling neemt alleen verlenging mee",
    ]) expect(f).toContain(`'${naam}'`);
    expect(f).toContain("Testtelling verstreken opzegging");
    expect(f).toContain("Testtelling stilzwijgende verlenging");
  });
});

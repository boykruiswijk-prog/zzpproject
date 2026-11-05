import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const sql = readFileSync("drizzle/migrations/0249_scherm_dagomzet_zonder_einddatum.sql", "utf8");
const dagomzet = sql.slice(sql.indexOf("FUNCTION public.scherm_dagomzet_rijen"));
const cohort = sql.slice(0, sql.indexOf("FUNCTION public.scherm_dagomzet_rijen"));

// Spiegel van de SQL-periodefilter: telt een aanvraag op dag `dag` mee als `vandaag` de schermdag is?
function teltMee(dag: string, vandaag: string) {
  return dag >= "2026-10-06" && dag <= vandaag && dag === vandaag;
}

describe("Dagomzet zonder einddatum 2026", () => {
  it("telt een aanvraag op 15-03-2027", () => {
    expect(teltMee("2027-03-15", "2027-03-15")).toBe(true);
  });
  it("Dagomzet bevat geen vaste einddatum 2026-12-31", () => {
    expect(cohort).not.toContain("2026-12-31");
    expect(dagomzet).not.toContain("2026-12-31");
    expect(dagomzet).toContain("tel_aanvraag_cohort_tot(date '2026-10-06', (now() AT TIME ZONE 'Europe/Amsterdam')::date)");
  });
  it("behoudt test- en ontdubbelregels", () => {
    expect(cohort).toContain("NOT coalesce(l.is_test,false)");
    expect(cohort).toContain("NOT coalesce(b.is_test,false)");
    expect(cohort).toContain("GROUP BY 1");
  });
  it("past het aanvraagdoel niet aan", () => {
    expect(sql).not.toMatch(/FUNCTION public\.tel_aanvraag_cohort\(/);
    expect(sql).not.toContain("tel_aanvragen_doel");
  });
});

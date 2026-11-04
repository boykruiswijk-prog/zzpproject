// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { conceptMoetGecontroleerdWorden } from "../../supabase/functions/_shared/conceptControle";
import { bedragVoorPeriode, isStarter } from "../../supabase/functions/_shared/starterTarief";

describe("De Directietafel eenmalig besluit", () => {
  it("standaard maandtarief is 55 zonder aangetoonde starterdatum", () => {
    expect(isStarter(null, "2026-11-03")).toBe(false);
    expect(bedragVoorPeriode("maand", null, "2026-11-03")).toBe(55);
  });
  it("bewust vervallen concept wordt niet gecontroleerd, gewoon concept wel", () => {
    expect(conceptMoetGecontroleerdWorden({ exact_invoice_status: 20, exact_invoice_vervallen_op: "2026-11-04T06:12:00Z" })).toBe(false);
    expect(conceptMoetGecontroleerdWorden({ exact_invoice_status: 20 })).toBe(true);
  });
  it("coulance geldt alleen voor deze onderneming en dit contract met auditbesluit", async () => {
    const db = new PGlite();
    try {
      await db.exec(`CREATE TABLE sensitive_audit_log(target_table text,target_id uuid,actie text,details jsonb);
        CREATE TABLE klant_contracten(id uuid,onderneming_id uuid,product text,cyber_ingangsdatum date,cyber_einddatum date,eind_datum date,bedrag_per_periode numeric,maandwaarde numeric,status text,cyber_toevoeg_verzoek_id uuid,cyber_voorwaarden_versie text);
        CREATE FUNCTION cyber_term_eind(date,date) RETURNS date LANGUAGE sql AS $$SELECT date '2027-11-02'$$;`);
      const sql = readFileSync("drizzle/migrations/0237_directietafel_coulance_concept_vervallen.sql", "utf8");
      await db.exec(sql.slice(sql.indexOf("CREATE OR REPLACE FUNCTION"), sql.indexOf("DO $ddl$")));
      await db.exec(`CREATE TRIGGER guard BEFORE INSERT OR UPDATE ON klant_contracten FOR EACH ROW EXECUTE FUNCTION guard_cyber_contract();`);
      const id = "17b3e297-c26c-44e1-8c28-d05e370ccb18", ond = "0c04440f-2ffc-45ee-8865-297cbc1d6360";
      await db.query(`INSERT INTO klant_contracten VALUES($1,$2,'cyber_clear','2026-11-03','2026-11-03','2026-11-03',0,0,'loopt_af',null,'2026-10-08')`, [id, ond]);
      expect((await db.query<{eind:string}>(`SELECT eind_datum::text eind FROM klant_contracten`)).rows[0].eind).toBe("2027-11-02");
      await db.query(`INSERT INTO sensitive_audit_log VALUES('klant_contracten',$1,'coulance_boy_20261104','{"reden":"coulance Boy 4-11, opgezegd binnen enkele uren na aanvraag"}')`, [id]);
      await db.exec(`UPDATE klant_contracten SET cyber_einddatum='2026-11-03',eind_datum='2026-11-03'`);
      expect((await db.query<{eind:string}>(`SELECT eind_datum::text eind FROM klant_contracten`)).rows[0].eind).toBe("2026-11-03");
      await db.exec(`UPDATE klant_contracten SET onderneming_id='00000000-0000-0000-0000-000000000002'`);
      expect((await db.query<{eind:string}>(`SELECT eind_datum::text eind FROM klant_contracten`)).rows[0].eind).toBe("2027-11-02");
    } finally { await db.close(); }
  }, 30000);
});
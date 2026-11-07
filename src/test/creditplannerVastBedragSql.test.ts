// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, it, expect } from "vitest";
import { readFileSync } from "node:fs";
const db = new PGlite();
beforeAll(async () => {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE TABLE public.factuur_credit_planning(creditsleutel text primary key,bron text,bedrag numeric,berekening jsonb,beoordeeld_op timestamptz,status text);
    CREATE FUNCTION public.herbeoordeel_opzeg_credits() RETURNS integer LANGUAGE plpgsql AS $$ BEGIN
      PERFORM 1 FROM factuur_credit_planning WHERE status='te_maken' AND bron <> 'correctie'; RETURN 0; END $$;`);
  await db.exec(readFileSync("drizzle/migrations/0256_creditplanner_vast_bedrag.sql", "utf8"));
  await db.exec(`INSERT INTO factuur_credit_planning VALUES('ZPC-0E5D7316','correctie',60,'{"bedrag":60,"jaarpremie":600,"korting_pct":10}','2026-11-06 13:33:17+00','te_maken',false),
    ('manual','planner',60,'{"bedrag":60}',NULL,'te_maken',true),('normal','planner',60,'{"bedrag":60}',NULL,'te_maken',false);`);
}, 30000);
afterAll(() => db.close());
it("database weigert exact het incident: na Ellen-akkoord 60 wijzigen naar 600", async () => {
  await expect(db.exec(`UPDATE factuur_credit_planning SET bedrag=600,berekening='{"bedrag":600,"regel":"per dag"}' WHERE creditsleutel='ZPC-0E5D7316'`)).rejects.toThrow("Vastgelegd creditbedrag");
  expect((await db.query<{bedrag:string}>(`SELECT bedrag FROM factuur_credit_planning WHERE creditsleutel='ZPC-0E5D7316'`)).rows[0].bedrag).toBe("60");
});
it("statusovergang naar concept blijft toegestaan zonder bedragwijziging", async () => {
  await db.exec(`UPDATE factuur_credit_planning SET status='geclaimd' WHERE creditsleutel='ZPC-0E5D7316'; UPDATE factuur_credit_planning SET status='concept_aangemaakt' WHERE creditsleutel='ZPC-0E5D7316'`);
  expect((await db.query<{status:string}>(`SELECT status FROM factuur_credit_planning WHERE creditsleutel='ZPC-0E5D7316'`)).rows[0].status).toBe("concept_aangemaakt");
});
it("handmatig bedrag kan niet worden overschreven of ontgrendeld", async () => {
  await expect(db.exec(`UPDATE factuur_credit_planning SET bedrag=600 WHERE creditsleutel='manual'`)).rejects.toThrow("Vastgelegd creditbedrag");
  await expect(db.exec(`UPDATE factuur_credit_planning SET bedrag_handmatig=false WHERE creditsleutel='manual'`)).rejects.toThrow("Vastgelegd creditbedrag");
});
it("bron of onderbouwing wijzigen om goedgekeurd bedrag heen is geblokkeerd", async () => {
  await expect(db.exec(`UPDATE factuur_credit_planning SET bron='planner' WHERE creditsleutel='ZPC-0E5D7316'`)).rejects.toThrow("Vastgelegd creditbedrag");
  await expect(db.exec(`UPDATE factuur_credit_planning SET berekening='{"bedrag":600}' WHERE creditsleutel='ZPC-0E5D7316'`)).rejects.toThrow("Vastgelegd creditbedrag");
});
it("gewone opzegcredit kan nog herberekend worden", async () => {
  await db.exec(`UPDATE factuur_credit_planning SET bedrag=600 WHERE creditsleutel='normal'`);
  expect((await db.query<{bedrag:string}>(`SELECT bedrag FROM factuur_credit_planning WHERE creditsleutel='normal'`)).rows[0].bedrag).toBe("600");
});
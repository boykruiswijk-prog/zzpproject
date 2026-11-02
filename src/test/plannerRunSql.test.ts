// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, it, expect } from "vitest";
import { readFileSync } from "node:fs";
const db = new PGlite();
beforeAll(async () => {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT current_setting('test.role',true) $$;
    CREATE TABLE factuur_planner_runs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), gestart_op timestamptz DEFAULT now(), modus text, trigger_type text, aantal_kandidaten integer, aantal_geblokkeerd integer, aantal_aangemaakt integer DEFAULT 0, bedrag numeric,status text,detail jsonb);
    SET test.role='service_role';`);
  const sql = readFileSync("drizzle/migrations/0217_factuur_planner_batches.sql", "utf8");
  await db.exec(sql.slice(0, sql.indexOf("CREATE OR REPLACE FUNCTION public.factuur_planner_vervolg")));
}, 30000);
afterAll(() => db.close());
it("records bezig before work and rejects an overlapping run", async () => {
  const first = (await db.query<{ id: string }>("select factuur_planner_start('cron:dagrun',47,0,3470) id")).rows[0];
  expect(first.id).toBeTruthy();
  expect((await db.query<{ status: string }>("select status from factuur_planner_runs where id=$1", [first.id])).rows[0].status).toBe("bezig");
  expect((await db.query<{ id: string | null }>("select factuur_planner_start('cron:dagrun',47,0,3470) id")).rows[0].id).toBeNull();
});
it("preserves an expired hard-stopped run as onderbroken and starts a new run", async () => {
  await db.exec("update factuur_planner_runs set bijgewerkt_op=now()-interval '4 minutes'");
  expect((await db.query<{ id: string }>("select factuur_planner_start('cron:dagrun',27,0,2000) id")).rows[0].id).toBeTruthy();
  expect((await db.query("select * from factuur_planner_runs where status='onderbroken'")).rows).toHaveLength(1);
  expect((await db.query("select * from factuur_planner_runs")).rows).toHaveLength(2);
});
it("human and anonymous callers cannot start a billing run", async () => {
  await db.exec("set test.role='authenticated'");
  await expect(db.query("select factuur_planner_start('handmatig:dagrun',47,0,3470)")).rejects.toThrow("geen toegang");
  expect((await db.query<{ auth: boolean; anon: boolean; service: boolean }>("select has_function_privilege('authenticated','factuur_planner_start(text,integer,integer,numeric)','EXECUTE') auth, has_function_privilege('anon','factuur_planner_start(text,integer,integer,numeric)','EXECUTE') anon, has_function_privilege('service_role','factuur_planner_start(text,integer,integer,numeric)','EXECUTE') service")).rows[0]).toEqual({ auth: false, anon: false, service: true });
});
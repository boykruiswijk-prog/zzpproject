// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, it, expect } from "vitest";

const db = new PGlite();
beforeAll(async () => {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE TYPE public.app_role AS ENUM ('supervisor','admin','verzekering','medewerker');
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT '00000000-0000-0000-0000-000000000001'::uuid$$;
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$SELECT jsonb_build_object('aal',current_setting('test.aal'))$$;
    CREATE FUNCTION public.has_role(uuid,public.app_role) RETURNS boolean LANGUAGE sql AS $$SELECT $2::text=current_setting('test.role')$$;
    SET test.aal='aal2'; SET test.role='admin';
    CREATE TABLE public.klant_contracten(id int,onderneming_id uuid,maandwaarde numeric,status text,is_test boolean,product text,cyber_ingangsdatum date,begin_datum date,eind_datum date);
    INSERT INTO public.klant_contracten VALUES
      (1,'00000000-0000-0000-0000-000000000011',100,'actief',false,'bav_avb',null,'2026-09-01',null),
      (2,'00000000-0000-0000-0000-000000000011',25,'actief',false,'cyber_clear',null,'2026-10-02',null),
      (3,'00000000-0000-0000-0000-000000000012',50,'actief',false,'other','2026-10-03','2026-10-03',null),
      (4,'00000000-0000-0000-0000-000000000013',20,'loopt_af',false,'bav_avb',null,'2026-01-01','2026-10-05'),
      (5,'00000000-0000-0000-0000-000000000014',999,'actief',true,'bav_avb',null,'2026-10-01',null),
      (6,'00000000-0000-0000-0000-000000000015',999,'vervangen',false,'bav_avb',null,'2026-10-01','2026-10-04');`);
  await db.exec(readFileSync("drizzle/migrations/0203_arr_overzicht_a22.sql", "utf8"));
}, 30000);
afterAll(() => db.close());
const overview = async () => (await db.query<{r: any}>("SELECT public.arr_overzicht() r")).rows[0].r;

it("ARR is active non-test sum(maandwaarde)*12 and matches an independent SELECT", async () => {
  const r = await overview();
  const direct = (await db.query<{v:string}>("SELECT sum(maandwaarde)*12 v FROM klant_contracten WHERE status='actief' AND is_test=false")).rows[0].v;
  expect(r.arr_totaal).toBe(2100); expect(r.arr_totaal).toBe(Number(direct));
});
it("counts distinct customers and all active contract rows", async () => {
  expect(await overview()).toMatchObject({aantal_klanten:2,aantal_contracten:3,gemiddelde_arr_per_klant:1050});
});
it("reports expiry separately without adding it to active ARR", async () => {
  expect(await overview()).toMatchObject({arr_loopt_af:240,arr_totaal:2100});
});
it("includes cyber by product or cyber start date exactly once", async () => {
  expect(await overview()).toMatchObject({arr_cyber:900,aantal_contracten_cyber:2,aandeel_cyber_pct:42.86});
});
it("returns six consecutive months and zeroes for empty months", async () => {
  const r=await overview(); expect(r.maanden).toHaveLength(6);
  const today=(await db.query<{d:string}>("SELECT to_char(now() AT TIME ZONE 'Europe/Amsterdam','YYYY-MM-01') d")).rows[0].d;
  expect(r.maanden[5].maand).toBe(today);
  expect(r.maanden[0]).toMatchObject({nieuw:0,aflopend:0,netto:0});
});
it("October flow and net since 1 October exclude test and replaced rows", async () => {
  const r=await overview();
  expect(r.vanaf).toBe('2026-10-01');
  expect(r.maanden.find((m:any)=>m.maand==='2026-10-01')).toMatchObject({nieuw:900,aflopend:240,netto:660});
  expect(r.netto_sinds_1_okt).toBe(660);
});
it("rejects non-supervisor/admin roles and requires MFA", async () => {
  await db.exec("SET test.role='verzekering'"); await expect(overview()).rejects.toThrow('Geen toegang');
  await db.exec("SET test.role='supervisor'; SET test.aal='aal1'"); await expect(overview()).rejects.toThrow('Geen toegang');
  await db.exec("SET test.aal='aal2'"); expect((await overview()).arr_totaal).toBe(2100);
  await db.exec("SET test.role='admin'");
});
it("anon and service role have no execute grant", async () => {
  const r=(await db.query<{anon:boolean;service:boolean;team:boolean}>(`SELECT has_function_privilege('anon','public.arr_overzicht()','execute') anon, has_function_privilege('service_role','public.arr_overzicht()','execute') service, has_function_privilege('authenticated','public.arr_overzicht()','execute') team`)).rows[0];
  expect(r).toEqual({anon:false,service:false,team:true});
});
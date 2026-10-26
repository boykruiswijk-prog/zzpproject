// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { controleerDashboardOpbouw, conversieAanvragen } from "../../supabase/functions/_shared/dashboardOpbouw";
import { bouwSchermPayload } from "../../supabase/functions/_shared/schermAnonimiseer";

const db = new PGlite();
const uuid = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12,"0")}`;
beforeAll(async () => {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS 'select null::uuid';
    CREATE TABLE ondernemingen(id uuid primary key,kvk text,samengevoegd_naar uuid,is_test boolean default false);
    CREATE TABLE leads(id uuid primary key,type text,status text,kvk_nummer text,created_at timestamptz,is_test boolean default false,geactiveerd_op timestamptz,converted_at timestamptz);
    CREATE TABLE bav_aanmeldingen(id uuid,lead_id uuid,kvk_nummer text,aangemeld_op timestamptz,status text,is_test boolean default false);
    CREATE TABLE klant_contracten(id uuid,onderneming_id uuid,product text,status text,is_test boolean default false,begin_datum date,bron text,created_at timestamptz);
    CREATE TABLE activiteiten_log(actie_type text,omschrijving text,lead_id uuid,is_test boolean,uitgevoerd_door uuid);
    CREATE FUNCTION tel_aanvragen_doel(date) RETURNS bigint LANGUAGE sql AS 'select count(*) from public.leads where false';`);
  const sql=readFileSync("scripts/dashboardReconciliatie.sql","utf8").split("DO $wire$")[0];
  await db.exec(sql);
  await db.exec(`CREATE OR REPLACE FUNCTION tel_aanvragen_doel(date) RETURNS bigint LANGUAGE sql AS 'select count(*) from public.tel_aanvraag_cohort($1)';`);
  for(let n=1;n<=22;n++) {
    await db.query(`INSERT INTO leads(id,type,status,kvk_nummer,created_at) VALUES($1,'verzekering_aanvraag',$2,$3,$4)`,
      [uuid(n),n<=19?'actief':n===20?'in_behandeling':n===21?'nieuw_te_beoordelen':'actief',String(90000000+n),n===22?'2026-10-01T12:00:00Z':'2026-10-22T12:00:00Z']);
  }
  for(let n=30;n<45;n++) await db.query(`INSERT INTO leads(id,type,status,created_at) VALUES($1,$2,'nieuw','2026-10-22')`,[uuid(n),n<42?'contact':'offerte-aanvraag']);
  await db.query(`INSERT INTO bav_aanmeldingen VALUES($1,null,'90000001','2026-10-22','actief',false)`,[uuid(90)]);
  await db.query(`INSERT INTO leads VALUES($1,'verzekering_aanvraag','actief','99999999','2026-10-22',true,null,null)`,[uuid(91)]);
  await db.query(`INSERT INTO bav_aanmeldingen VALUES($1,$2,'99999999','2026-10-22','actief',false)`,[uuid(92),uuid(91)]);
},30000);
afterAll(()=>db.close());
describe("Boy 26-10 sluitende tellingen",()=>{
 it("ontdubbelt losse aanmelding op KvK en sluit gekoppelde testlead uit: 21 doel, 19 klant",async()=>{
  const {rows}=await db.query<{opbouw:any}>(`select public.tel_dashboard_opbouw() opbouw`);
  expect(rows[0].opbouw.aanvragen_opbouw).toMatchObject({totaal:21,klant:19,in_behandeling:1,te_beoordelen:1,overig:0});
  expect(rows[0].opbouw.leads_opbouw).toMatchObject({totaal:37,aanvragen:22,contact:12,offerte:3});
 });
 it("conversie heeft aanvraagnoemer 21, niet leadnoemer 37",()=>{
  expect(conversieAanvragen({totaal:21,klant:19,in_behandeling:1,te_beoordelen:1,overig:0})).toBe(90.5);
 });
 it("SQL controle faalt bij niet sluitende statusopbouw",async()=>{
  await expect(db.query(`select controleer_aanvraag_opbouw($1::jsonb,21)`,[JSON.stringify({totaal:21,klant:18,in_behandeling:1,te_beoordelen:1,overig:0})])).rejects.toThrow(/sluit niet aan/);
 });
 it("dashboard en schermcontrole falen bij verschillende totaalwaarden",()=>{
  const a={totaal:21,klant:19,in_behandeling:1,te_beoordelen:1,overig:0};
  expect(()=>controleerDashboardOpbouw(a,22)).toThrow();
  expect(()=>bouwSchermPayload({aanvragen_opbouw:a,doel:{totaal:21},stroom:{verstuurd:22}})).toThrow();
  expect(bouwSchermPayload({aanvragen_opbouw:a,doel:{totaal:21},stroom:{verstuurd:21}}).aanvragen_opbouw).toEqual(a);
 });
 it("nieuw contract op bestaande KvK activeert de aanvraag één keer zonder mail",async()=>{
  await db.query(`INSERT INTO ondernemingen VALUES($1,'90000020',null,false)`,[uuid(100)]);
  await db.query(`INSERT INTO klant_contracten VALUES($1,$2,'bav_avb','actief',false,'2026-10-23','site_activatie','2026-10-23T09:16:13Z')`,[uuid(101),uuid(100)]);
  const {rows}=await db.query<{status:string;converted_at:Date}>(`select status,converted_at from leads where id=$1`,[uuid(20)]);
  expect(rows[0].status).toBe('actief'); expect(new Date(String(rows[0].converted_at)).toISOString()).toBe('2026-10-23T09:16:13.000Z');
  await db.query(`UPDATE klant_contracten SET status='actief' where id=$1`,[uuid(101)]);
  expect((await db.query<{n:number}>(`select count(*)::int n from activiteiten_log where lead_id=$1`,[uuid(20)])).rows[0].n).toBe(1);
 });
 it("samenvoeging volgt de hoofdkaart en synchroniseert een pending aanvraag",async()=>{
  await db.query(`INSERT INTO ondernemingen VALUES($1,'90000021',null,false),($2,'90000099',null,false)`,[uuid(110),uuid(111)]);
  await db.query(`INSERT INTO klant_contracten VALUES($1,$2,'bav_avb','actief',false,'2026-10-23','site_activatie','2026-10-23T10:00:00Z')`,[uuid(112),uuid(111)]);
  await db.query(`UPDATE ondernemingen SET samengevoegd_naar=$1 where id=$2`,[uuid(111),uuid(110)]);
  expect((await db.query<{status:string}>(`select status from leads where id=$1`,[uuid(21)])).rows[0].status).toBe('actief');
 });
 it("instroom telt aanvraag vóór 6 okt apart en toekomstige ingang niet als instroom",async()=>{
  await db.query(`INSERT INTO ondernemingen VALUES($1,'90000022',null,false),($2,null,null,false)`,[uuid(120),uuid(121)]);
  await db.query(`INSERT INTO klant_contracten VALUES($1,$2,'bav_avb','actief',false,'2026-10-02','site_activatie','2026-10-01'),($3,$4,'bav_avb','actief',false,'2026-10-01','afas_20261001','2026-10-01'),($5,$2,'bav_avb','actief',false,'2099-12-01','site_activatie','2026-10-01')`,[uuid(122),uuid(120),uuid(123),uuid(121),uuid(124)]);
  const {rows}=await db.query<{i:any}>(`select tel_instroom_opbouw() i`);
  expect(rows[0].i.voor_6_okt).toBe(1); expect(rows[0].i.afas_overzetting).toBe(1); expect(rows[0].i.nog_in_te_gaan).toBe(1);
 });
});
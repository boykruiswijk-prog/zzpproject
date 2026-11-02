// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
const db=new PGlite();
const id=(n:number)=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
async function search(q:string,tests=false){const r=await db.query<{r:Record<string,Array<Record<string,any>>>}>(`select zoek_universeel($1,$2) r`,[q,tests]);return r.rows[0].r;}
beforeAll(async()=>{
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE SCHEMA auth;CREATE SCHEMA extensions;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT '00000000-0000-0000-0000-000000000099'::uuid $$;
 CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$ SELECT jsonb_build_object('aal',current_setting('test.aal',true),'email','test@zpzaken.nl') $$;
 CREATE FUNCTION is_team_member(uuid) RETURNS boolean LANGUAGE sql AS $$SELECT coalesce(current_setting('test.team',true),'yes')='yes'$$;
 CREATE FUNCTION has_role(uuid,text) RETURNS boolean LANGUAGE sql AS $$SELECT true$$;
 CREATE FUNCTION is_supervisor_or_admin(uuid) RETURNS boolean LANGUAGE sql AS $$SELECT true$$;
 CREATE FUNCTION get_user_role_label(uuid) RETURNS text LANGUAGE sql AS $$SELECT 'admin'::text$$;
 CREATE FUNCTION zoek_masker_iban(v text) RETURNS text LANGUAGE sql IMMUTABLE AS $$SELECT '****'||right(regexp_replace(v,'\\s','','g'),4)$$;
 CREATE FUNCTION zoek_norm_tel(v text) RETURNS text LANGUAGE sql IMMUTABLE AS $$SELECT CASE WHEN length(d)=9 THEN d END FROM (SELECT CASE WHEN x LIKE '0031%' THEN substr(x,5) WHEN x LIKE '31%' AND length(x)=11 THEN substr(x,3) WHEN x LIKE '0%' THEN substr(x,2) ELSE x END d FROM (SELECT regexp_replace(coalesce(v,''),'\\D','','g') x) a)b$$;
 SET test.aal='aal2';SET test.team='yes';`);
 await db.exec(readFileSync('src/test/fixtures/adminZoekSchema.sql','utf8'));
 const sql=readFileSync('scripts/adminZoek.sql','utf8').replace(/CREATE EXTENSION[^;]+;/g,'').replace(/EXECUTE format\('CREATE INDEX[^\n]+?\);/g,'NULL;');
 await db.exec(sql);
 await db.exec(readFileSync('drizzle/migrations/0191_admin_zoeken_cyber_bav_koppeling.sql','utf8'));
 await db.exec(readFileSync('drizzle/migrations/0192_admin_zoeken_contract_eigen_nummer.sql','utf8'));
 await db.exec(readFileSync('drizzle/migrations/0222_admin_zoek_klant_titel.sql','utf8'));
 await db.query(`insert into ondernemingen(id,naam,afas_contactpersoon,exact_account_naam,is_test) values($1,'Digital Native Consulting B.V.','Anthony Harold Solomon','Digital Native Consulting B.V.',false)`,[id(1)]);
 await db.query(`insert into ondernemingen(id,naam,afas_contactpersoon,is_test) values($1,'Jansen Klusbedrijf','Jansen Klusbedrijf',false)`,[id(2)]);
 await db.query(`insert into ondernemingen(id,naam,is_test) values($1,'Kaart Zonder Contact B.V.',false)`,[id(3)]);
 await db.query(`insert into ondernemingen(id,naam,is_test) values($1,'Buitenlands Bedrijf B.V.',false)`,[id(4)]);
 await db.query(`insert into personen(id,voornaam,achternaam,is_test) values($1,'Karin','de Vries',false)`,[id(5)]);
 await db.query(`insert into persoon_onderneming(id,persoon_id,onderneming_id) values($1,$2,$3)`,[id(6),id(5),id(4)]);
 await db.query(`insert into leads(id,voornaam,achternaam,bedrijfsnaam,email,type,status,is_test) values($1,'Sam','Visser','Sam Visser Consulting','sam@voorbeeld.nl','contact','nieuw',false)`,[id(7)]);
},30000);
afterAll(()=>db.close());
describe('Klanttitel in de zoekresultaten',()=>{
 it('ondernemingsnaam één keer, contactpersoon apart',async()=>{
  const r=(await search('digital native')).klanten[0];
  expect(r.titel).toBe('Digital Native Consulting B.V.');
  expect(r.subtitel).toBe('Anthony Harold Solomon');
  expect((r.titel.match(/Digital Native/g)||[]).length).toBe(1);
  expect(JSON.stringify(r)).not.toContain('Digital Native Consulting B.V. Anthony Harold Solomon Digital Native');
 });
 it('eenmanszaak met gelijke naam toont de naam één keer',async()=>{
  const r=(await search('jansen')).klanten[0];
  expect(r.titel).toBe('Jansen Klusbedrijf');
  expect(r.subtitel??null).toBeNull();
 });
 it('zonder contactpersoon alleen de ondernemingsnaam',async()=>{
  const r=(await search('kaart zonder')).klanten[0];
  expect(r.titel).toBe('Kaart Zonder Contact B.V.');
  expect(r.subtitel??null).toBeNull();
 });
 it('gekoppelde persoon vult de contactpersoon aan',async()=>{
  const r=(await search('buitenlands')).klanten[0];
  expect(r.titel).toBe('Buitenlands Bedrijf B.V.');
  expect(r.subtitel).toBe('Karin de Vries');
 });
 it('andere groepen houden hun eigen titel zonder subtitel',async()=>{
  const r=(await search('sam visser')).leads[0];
  expect(r.titel).toBe('Sam Visser Sam Visser Consulting');
  expect(r.subtitel??null).toBeNull();
 });
});

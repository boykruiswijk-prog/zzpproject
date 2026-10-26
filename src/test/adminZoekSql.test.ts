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
 const sql=readFileSync('scripts/adminZoek.sql','utf8').replace(/CREATE EXTENSION[^;]+;/g,'').replace(/CREATE INDEX[^;]+;/g,'');
 await db.exec(sql);
 await db.query(`insert into aanvraag_concepten(id,voornaam,achternaam,telefoon,status,is_test) values($1,'Afgehaakt','Persoon','+31 6 12 34 56 78','open',false)`,[id(1)]);
 await db.query(`insert into leads(id,voornaam,email,type,status,is_test) values($1,'Contact','vraag@zpzaken.nl','contact','nieuw',false)`,[id(2)]);
 await db.query(`insert into ondernemingen(id,naam,kvk,iban,is_test) values($1,'Hoofdkaart','92 65 41 93','NL91 ABNA 0417 1643 00',false)`,[id(3)]);
 await db.query(`insert into ondernemingen(id,naam,samengevoegd_naar,is_test) values($1,'Oude unieke handelsnaam',$2,false)`,[id(4),id(3)]);
 await db.query(`insert into klant_contracten(id,onderneming_id,abonnement_nr,is_test) values($1,$2,'ZPBAV5193',false)`,[id(5),id(3)]);
 await db.query(`insert into aanvraag_concepten(id,voornaam,telefoon,status,is_test) values($1,'Verborgen-test','0612345678','open',true)`,[id(6)]);
},30000);
afterAll(()=>db.close());
describe('Universeel klant/prospect zoeken',()=>{
 it.each(['0612345678','06-12345678','06 12 34 56 78','+31612345678','0031612345678'])('vindt afgehaakt op %s',async q=>{expect((await search(q)).afgehaakt.map(r=>r.id)).toEqual([id(1)]);});
 it('vindt contact op gedeeltelijke email ongeacht hoofdletters',async()=>{expect((await search('VRAAG@')).leads[0].id).toBe(id(2));});
 it('vindt klantcontract op BAV-nummer',async()=>{const r=(await search('ZPBAV5193')).contracten[0];expect(r.link).toBe(`/admin/klanten/${id(3)}`);});
 it('vindt oude samengevoegde naam met hoofdkaartlink',async()=>{const r=(await search('oude unieke')).klanten[0];expect(r.id).toBe(id(3));expect(r.bron_id).toBe(id(4));expect(r.link).toBe(`/admin/klanten/${id(3)}`);});
 it('normaliseert KvK met en zonder spaties',async()=>{expect((await search('92654193')).klanten[0].id).toBe(id(3));expect((await search('92 65 41 93')).klanten[0].id).toBe(id(3));});
 it('IBAN laatste 4 is gemaskeerd en geaudit',async()=>{const r=await search('4300');expect(r.klanten[0].iban).toBe('****4300');expect(JSON.stringify(r)).not.toContain('0417164300');const a=await db.query<{details:any}>(`select details from sensitive_audit_log where actie='zoeken_iban'`);expect(a.rows.some(r=>r.details.zoekterm_gemaskeerd==='****4300' && r.details.iban_treffers>0)).toBe(true);});
 it.each(['NL91ABNA0417164300','NL91 ABNA 0417 1643 00'])('vindt volledig IBAN %s gemaskeerd',async q=>{expect((await search(q)).klanten[0].iban).toBe('****4300');});
 it('audit ook IBAN-zoekactie zonder match',async()=>{await search('9999');const a=await db.query<{details:any}>(`select details from sensitive_audit_log where details->>'zoekterm_gemaskeerd'='****9999'`);expect(a.rows[0].details.iban_treffers).toBe(0);});
 it('testrecords standaard verborgen en expliciet toonbaar',async()=>{expect((await search('verborgen-test')).afgehaakt).toBeUndefined();expect((await search('verborgen-test',true)).afgehaakt[0].id).toBe(id(6));});
 it('weigert menselijke toegang zonder MFA',async()=>{await db.exec(`SET test.aal='aal1'`);await expect(search('vraag')).rejects.toThrow('tweestapscode');await db.exec(`SET test.aal='aal2'`);});
 it('weigert niet-teamleden ook met MFA',async()=>{await db.exec(`SET test.team='no'`);await expect(search('vraag')).rejects.toThrow('Geen toegang');await db.exec(`SET test.team='yes'`);});
});

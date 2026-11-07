// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { beforeAll,afterAll,it,expect } from 'vitest';
import { readFileSync } from 'node:fs';
const db=new PGlite();
beforeAll(async()=>{
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE SCHEMA auth;
 CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT current_setting('test.role',true) $$;
 CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$ SELECT jsonb_build_object('aal',current_setting('test.aal',true)) $$;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT '11111111-1111-1111-1111-111111111111'::uuid $$;
 CREATE FUNCTION public.has_role(uuid,text) RETURNS boolean LANGUAGE sql AS $$ SELECT current_setting('test.team',true)='yes' $$;
 CREATE TABLE wijzigingsmeldingen(titel text,omschrijving text,onderdeel text,wat_moet_ellen_doen text);
 SET test.role='service_role';SET test.aal='aal2';SET test.team='yes';`);
 await db.exec(readFileSync('drizzle/migrations/0259_google_reviews_route_c.sql','utf8'));
},30000);
afterAll(()=>db.close());
it('verplicht reden, audit en sterren 1-5; menselijke MFA en geen delete-grant',async()=>{
 const args=[null,'Reviewnaam',1,'Echte review','2026-11-07','https://g.co/kgs/test',false,'Toegevoegd van Google'];
 const save='select google_reviews_bewaren($1,$2,$3,$4,$5,$6,$7,$8) id';
 await expect(db.query(save,[...args.slice(0,7),''])).rejects.toThrow('verplicht');
 await expect(db.query(save,[null,'Reviewnaam',6,...args.slice(3)])).rejects.toThrow('verplicht');
 const added=(await db.query<{id:string}>(save,args)).rows[0];expect(added.id).toBeTruthy();
 await db.query(save,[added.id,...args.slice(1,6),true,'Spam na controle']);
 expect((await db.query('select * from google_reviews_audit')).rows).toHaveLength(2);
 expect((await db.query<{result:{reviews:unknown[]}}>('select google_reviews_publiek() result')).rows[0].result.reviews).toHaveLength(0);
 await db.exec("SET test.aal='aal1'");await expect(db.query(save,args)).rejects.toThrow('Geen toegang');await db.exec("SET test.aal='aal2'");
 expect((await db.query<{allowed:boolean}>("select has_table_privilege('authenticated','google_reviews','DELETE') allowed")).rows[0].allowed).toBe(false);
});
it('meldt alleen tekort, precies één keer per week, verborgen telt als beheerd',async()=>{
 const week=(await db.query<{week:string}>("select date_trunc('week',now() AT TIME ZONE 'Europe/Amsterdam')::date::text week")).rows[0].week;
 expect((await db.query<{ok:boolean}>('select google_reviews_week_claim($1) ok',[week])).rows[0].ok).toBe(true);
 expect((await db.query<{ok:boolean}>('select google_reviews_week_claim($1) ok',[week])).rows[0].ok).toBe(false);
 await db.query('select google_reviews_score_opslaan($1,4.2,1)',[week]);expect((await db.query('select * from wijzigingsmeldingen')).rows).toHaveLength(0);
 const next='2026-11-16';await db.query('insert into google_review_week_claims(week) values($1)',[next]);
 await db.query('select google_reviews_score_opslaan($1,3.5,4)',[next]);await db.query('select google_reviews_score_opslaan($1,3.5,4)',[next]);
 const notices=(await db.query<{wat_moet_ellen_doen:string}>('select * from wijzigingsmeldingen')).rows;expect(notices).toHaveLength(1);expect(notices[0].wat_moet_ellen_doen).toBe('Er staan 3 nieuwe Google-reviews die nog niet op de site staan. Voeg ze toe in Admin, Google-reviews, ook lage scores.');
});
it('publieke scorecontrole schrijft niet met een bezoekersrol',async()=>{
 await db.exec("SET test.role='anon'");await expect(db.query("select google_reviews_score_opslaan('2026-11-16',5,20)")).rejects.toThrow('Geen toegang');
 expect((await db.query<{allowed:boolean}>("select has_table_privilege('anon','google_reviews','SELECT') allowed")).rows[0].allowed).toBe(false);
});
// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, afterAll, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
const db = new PGlite();
const id=(n:number)=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const gegevens={voornaam:'Test',achternaam:'A19',email:'a19@zpzaken.nl',telefoon:'00316 12345678',kvk:'92654193',bedrijfsnaam:'TEST A19',beroep:'Consultant',interesse:'bav_avb',bron:'netwerk',notitie:'Test zonder mail',opvolgdatum:'2026-10-30'};
async function maak(g=gegevens,toch=false,test=false) { return (await db.query<{r:any}>('select handmatige_lead_toevoegen($1::jsonb,$2,$3) r',[JSON.stringify(g),toch,test])).rows[0].r; }
async function koppel(lead:string,ond=id(20),persoon:string|null=null,bron='leads') {return db.query('select lead_klant_koppelen($1,$2::uuid,$3::uuid,$4::uuid,$5)',[bron,lead,ond,persoon,'Koppeling getest']);}
beforeAll(async()=>{
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE SCHEMA auth;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT '${id(99)}'::uuid $$;
 CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$ SELECT jsonb_build_object('aal',current_setting('test.aal',true),'email',current_setting('test.email',true)) $$;
 CREATE FUNCTION is_team_member(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT current_setting('test.team',true)='yes' $$;
 CREATE FUNCTION is_supervisor_or_admin(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT current_setting('test.supervisor',true)='yes' $$;
 CREATE TYPE lead_status AS ENUM('nieuw','klant','actief','gepauzeerd','opgezegd');CREATE TYPE lead_bron AS ENUM('telefoon','email','netwerk','partner','beurs','overig');
 CREATE FUNCTION zoek_norm_tel(v text) RETURNS text LANGUAGE sql AS $$SELECT CASE WHEN length(d)=9 THEN d END FROM (SELECT CASE WHEN x LIKE '0031%' THEN substr(x,5) WHEN x LIKE '31%' AND length(x)=11 THEN substr(x,3) WHEN x LIKE '0%' THEN substr(x,2) ELSE x END d FROM (SELECT regexp_replace(coalesce(v,''),'\D','','g') x) a)b$$;
 CREATE FUNCTION zoek_norm_compact(v text) RETURNS text LANGUAGE sql AS $$ SELECT regexp_replace(lower(coalesce(v,'')), '[^a-z0-9]', '', 'g') $$;
 SET test.aal='aal2';SET test.team='yes';SET test.supervisor='yes';SET test.email='boy.kruiswijk@zpzaken.nl';`);
 await db.exec(readFileSync('src/test/fixtures/adminZoekSchema.sql','utf8'));
 await db.exec(`ALTER TABLE ondernemingen ADD PRIMARY KEY(id);ALTER TABLE personen ADD PRIMARY KEY(id);ALTER TABLE personen ALTER id SET DEFAULT gen_random_uuid();ALTER TABLE leads ALTER id SET DEFAULT gen_random_uuid();ALTER TABLE leads ALTER status SET DEFAULT 'nieuw';ALTER TABLE leads ALTER created_at SET DEFAULT now();ALTER TABLE leads ADD COLUMN bericht text;CREATE TABLE activiteiten_log(actie_type text,omschrijving text,uitgevoerd_door uuid,lead_id uuid,is_test boolean);CREATE TABLE persoon_bron_koppeling(id uuid); CREATE VIEW admin_zoek_bronnen AS SELECT id,'leads'::text bron,concat_ws(' ',voornaam,achternaam,bedrijfsnaam) titel,NULL::uuid onderneming_id,id lead_id,'/admin/leads/'::text route,is_test,email,ARRAY[telefoon] telefoons,ARRAY[kvk_nummer] nummers FROM leads UNION ALL SELECT id,'ondernemingen',naam,id,NULL::uuid,'/admin/klanten/',is_test,factuur_email,ARRAY[]::text[],ARRAY[kvk] FROM ondernemingen;
 CREATE FUNCTION onderneming_hoofdkaart(uuid) RETURNS uuid LANGUAGE sql AS $$SELECT coalesce((SELECT samengevoegd_naar FROM ondernemingen WHERE id=$1),$1)$$;
 CREATE FUNCTION koppel_bronrecord_aan_persoon() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN
  -- Velden per bron
  RAISE EXCEPTION 'Legacy manual customer creation must not run'; RETURN NEW; END$$;
 CREATE TRIGGER trg_leads_koppel_persoon AFTER INSERT ON leads FOR EACH ROW EXECUTE FUNCTION koppel_bronrecord_aan_persoon();
 CREATE FUNCTION tel_aanvragen_doel(date) RETURNS bigint LANGUAGE sql AS $$SELECT count(*) FROM leads WHERE type='verzekering_aanvraag' AND NOT coalesce(is_test,false)$$;
 CREATE FUNCTION tel_aanvraag_cohort(date) RETURNS TABLE(statusgroep text) LANGUAGE sql AS $$SELECT 'te_beoordelen'::text FROM leads WHERE type='verzekering_aanvraag' AND NOT coalesce(is_test,false)$$;
 CREATE FUNCTION controleer_aanvraag_opbouw(jsonb,bigint) RETURNS void LANGUAGE plpgsql AS $$BEGIN IF ($1->>'totaal')::bigint <> $2 THEN RAISE EXCEPTION 'mismatch'; END IF; END$$;`);
 const base=readFileSync('drizzle/migrations/0179_dashboard_aanvragen_reconciliatie.sql','utf8');
 await db.exec(base.slice(base.indexOf('CREATE OR REPLACE FUNCTION public.tel_dashboard_opbouw()'),base.indexOf('CREATE OR REPLACE FUNCTION public.tel_instroom_opbouw')) .split('REVOKE ALL ON FUNCTION public.tel_dashboard_opbouw')[0]);
 await db.exec(readFileSync('drizzle/migrations/0194_a19_leads_koppeling.sql','utf8'));
 await db.exec(`INSERT INTO ondernemingen(id,naam,is_test) VALUES('${id(20)}','Klant',false),('${id(21)}','TEST Klant',true);INSERT INTO ondernemingen(id,naam,samengevoegd_naar,is_test) VALUES('${id(22)}','Oude kaart','${id(20)}',false);`);
},30000);
afterAll(()=>db.close());
it('aanmaken eigen type, maker, genormaliseerde telefoon, opvolgdatum en log zonder klantkaart',async()=>{
 const r=await maak(); const l=(await db.query<any>('select * from leads where id=$1',[r.id])).rows[0];
 expect(l.type).toBe('handmatig');expect(l.handmatige_bron).toBe('netwerk');expect(l.aangemaakt_door).toBe(id(99));expect(l.telefoon).toBe('0612345678');expect(String(l.vlag_datum).slice(0,10)).toBe('2026-10-30');expect((await db.query('select * from activiteiten_log where lead_id=$1',[r.id])).rows.length).toBe(1);expect((await db.query('select * from ondernemingen')).rows.length).toBe(3);
});
it.each(['email','telefoon','kvk'])('dubbelcheck vindt %s en slaat niet stilzwijgend op',async veld=>{
 const g={...gegevens,email:'ander@zpzaken.nl',telefoon:'0698765432',kvk:'12345678',[veld]:gegevens[veld as keyof typeof gegevens]};
 const r=await maak(g);expect(r.id).toBeUndefined();expect(r.dubbel.length).toBe(1);
});
it('toch nieuw alleen na expliciete keuze',async()=>{expect((await maak(gegevens,true)).id).toBeTruthy();});
it('minstens één contactveld; telefoon-only werkt',async()=>{await expect(maak({...gegevens,email:'',telefoon:''})).rejects.toThrow('minstens');const r=await maak({...gegevens,email:'',telefoon:'0611112222',kvk:''});expect(r.id).toBeTruthy();});
it('handmatig telt in Leads, nooit doel/conversie; testdata uitgesloten',async()=>{
 const before=(await db.query<{r:any}>('select tel_dashboard_opbouw() r')).rows[0].r;
 await maak({...gegevens,email:'a19test@zpzaken.nl',telefoon:'',kvk:''},false,true);
 const after=(await db.query<{r:any}>('select tel_dashboard_opbouw() r')).rows[0].r;
 expect(after).toEqual(before);expect(after.leads_opbouw.totaal).toBe(3);expect(after.leads_opbouw.handmatig).toBe(3);expect(after.aanvragen_opbouw.totaal).toBe(0);
});
it('koppelen volgt samengevoegde kaart en logt status klant en tijd',async()=>{
 const r=await maak({...gegevens,email:'koppel@zpzaken.nl',telefoon:'',kvk:''});await koppel(r.id,id(22));
 const l=(await db.query<any>('select * from leads where id=$1',[r.id])).rows[0];expect(l.status).toBe('klant');expect(l.gekoppeld_onderneming_id).toBe(id(20));expect(l.gekoppeld_persoon_id).toBeTruthy();expect(l.converted_at).toBeTruthy();expect((await db.query<any>('select * from lead_klant_log where bron_id=$1',[r.id])).rows[0].actie).toBe('gekoppeld');
 await expect(koppel(r.id)).rejects.toThrow('Ontkoppel eerst');
});
it('ontkoppelen alleen Ellen/supervisor, verplicht notitie en behoudt historie',async()=>{
 const r=await maak({...gegevens,email:'ontkoppel@zpzaken.nl',telefoon:'',kvk:''});await koppel(r.id);
 await db.exec(`SET test.supervisor='no';SET test.email='team@zpzaken.nl';`);await expect(db.query('select lead_klant_ontkoppelen($1,$2,$3)',['leads',r.id,'Reden'])).rejects.toThrow('Alleen Ellen');
 await db.exec(`SET test.email='ellen.baars@zpzaken.nl';`);await expect(db.query('select lead_klant_ontkoppelen($1,$2,$3)',['leads',r.id,''])).rejects.toThrow('Notitie verplicht');
 await db.query('select lead_klant_ontkoppelen($1,$2,$3)',['leads',r.id,'Verkeerde kaart gekozen']);
 const l=(await db.query<any>('select * from leads where id=$1',[r.id])).rows[0];expect(l.status).toBe('nieuw');expect(l.gekoppeld_onderneming_id).toBeNull();expect((await db.query('select * from lead_klant_log where bron_id=$1',[r.id])).rows.length).toBe(2);await db.exec(`SET test.supervisor='yes';`);
});
it('test en echte klant niet mengen',async()=>{const r=await maak({...gegevens,email:'testmix@zpzaken.nl',telefoon:'',kvk:''},false,true);await expect(koppel(r.id)).rejects.toThrow('niet mengen');});
it('afgehaakte aanvraag koppelt zonder BAV-lead of doel te maken',async()=>{
 await db.query('insert into aanvraag_concepten(id,voornaam,achternaam,email,is_test) values($1,$2,$3,$4,false)',[id(30),'Afgehaakt','Persoon','concept@zpzaken.nl']);await koppel(id(30),id(20),null,'aanvraag_concepten');expect((await db.query<any>('select * from aanvraag_concepten where id=$1',[id(30)])).rows[0].converted_at).toBeTruthy();
});
it('weigert zonder MFA',async()=>{await db.exec(`SET test.aal='aal1'`);await expect(maak()).rejects.toThrow('tweestapscode');await db.exec(`SET test.aal='aal2'`);});

// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, afterAll, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
const db = new PGlite();
const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const change = (n: number, fields: Record<string,string>) => db.query('select crm_gegevens_wijzigen($1,null,$2::jsonb)',[id(n),JSON.stringify(fields)]);
beforeAll(async () => {
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT '${id(99)}'::uuid $$;
 CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$ SELECT jsonb_build_object('aal',current_setting('test.aal',true)) $$;
 CREATE FUNCTION is_team_member(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT current_setting('test.team',true)='yes' $$;
 CREATE FUNCTION mag_crm_beeindigen(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT is_team_member($1) $$;
 CREATE FUNCTION has_role(uuid,text) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
 CREATE FUNCTION is_supervisor_or_admin(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;
 CREATE FUNCTION get_user_role_label(uuid) RETURNS text LANGUAGE sql AS $$ SELECT 'admin' $$;
 CREATE TABLE profiles(id uuid,full_name text);
 CREATE TABLE ondernemingen(id uuid PRIMARY KEY,naam text,kvk text,rechtsvorm text,straat text,huisnummer text,postcode text,plaats text,iban text,factuur_email text,exact_relatie_code text,is_test boolean DEFAULT false,updated_at timestamptz);
 CREATE TABLE personen(id uuid PRIMARY KEY,voornaam text,achternaam text,email_weergave text,genormaliseerd_email text,telefoon text,is_test boolean DEFAULT false,updated_at timestamptz);
 CREATE TABLE crm_taken(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),soort text,onderneming_id uuid,persoon_id uuid,omschrijving text,details jsonb,status text DEFAULT 'open',aangemaakt_door uuid,aangemaakt_door_naam text,aangemaakt_op timestamptz DEFAULT now(),afgerond_door uuid,afgerond_op timestamptz,is_test boolean DEFAULT false,team text);
 CREATE TABLE sensitive_audit_log(target_table text,target_id uuid,actie text,veld text,oude_waarde text,nieuwe_waarde text,uitgevoerd_door uuid,uitgevoerd_door_rol text);
 CREATE TABLE activiteiten_log(actie_type text,omschrijving text,uitgevoerd_door uuid,uitgevoerd_door_naam text,is_test boolean);
 CREATE TABLE crm_notities(onderneming_id uuid,persoon_id uuid,soort text,tekst text,aangemaakt_door uuid,aangemaakt_door_naam text,is_test boolean,details jsonb);
 CREATE FUNCTION mijn_acties_vandaag(_toon_test boolean DEFAULT false) RETURNS jsonb LANGUAGE sql AS $$ SELECT '{}'::jsonb $$;
 CREATE FUNCTION menu_tellers() RETURNS jsonb LANGUAGE sql AS $$ SELECT '{}'::jsonb $$;
 SET test.aal='aal2'; SET test.team='yes';
 INSERT INTO ondernemingen(id,naam,is_test) VALUES('${id(1)}','TEST één',true),('${id(2)}','TEST twee',true),('${id(3)}','TEST drie',true),('${id(4)}','TEST vier',true),('${id(5)}','TEST vijf',true);`);
 await db.exec(readFileSync('src/test/fixtures/exactTakenGegevensWijzigen.sql','utf8'));
 const migration = readFileSync('drizzle/migrations/0197_exact_taken_overlap_samenvoegen.sql','utf8');
 await db.exec(migration.slice(0,migration.indexOf('DO $$')));
 // Execute the real production change to the write RPC without unrelated dashboard fixtures.
 const patch = migration.slice(migration.indexOf('DO $$'),migration.indexOf(" d:=pg_get_functiondef('public.mijn_acties_vandaag"));
 await db.exec(patch+' END $$;');
},30000);
afterAll(() => db.close());
it('overlap voegt velden samen, bewaart laatste waarden en schrijft een log zonder nieuwe taak',async () => {
 await change(1,{naam:'Nieuwe naam'});
 await change(1,{naam:'Laatste naam',straat:'Teststraat'});
 const tasks=(await db.query<any>('select * from crm_taken where onderneming_id=$1',[id(1)])).rows;
 expect(tasks).toHaveLength(1);
 expect(tasks[0].details.velden).toEqual(['naam','straat']);
 expect(tasks[0].details.laatste_waarden).toEqual({naam:'Laatste naam',straat:'Teststraat'});
 expect((await db.query("select * from activiteiten_log where actie_type='exact_taak_bijgewerkt'")).rows).toHaveLength(1);
});
it('deeloverlap werkt ook als bestaande taak niet alle nieuwe velden bevat',async()=>{
 await change(2,{straat:'Eerste straat',postcode:'1234AB'});
 await change(2,{straat:'Laatste straat',plaats:'Teststad'});
 const t=(await db.query<any>('select * from crm_taken where onderneming_id=$1',[id(2)])).rows;
 expect(t).toHaveLength(1);expect(t[0].details.velden).toEqual(['plaats','postcode','straat']);
 expect(t[0].details.laatste_waarden.straat).toBe('Laatste straat');
});
it('verschillende velden blijven afzonderlijke acties',async()=>{
 await change(3,{naam:'Andere naam'});await change(3,{plaats:'Andere plaats'});
 expect((await db.query('select * from exact_taken_open(true) where onderneming_id=$1',[id(3)])).rows).toHaveLength(2);
});
it('bestaande dubbelen blijven opgeslagen, eenmaal getoond en samen afgerond met audit per taak',async()=>{
 await db.exec(`INSERT INTO crm_taken(id,soort,onderneming_id,details,is_test) VALUES('${id(10)}','exact_aanpassen','${id(4)}','{"velden":["naam"]}',true),('${id(11)}','exact_aanpassen','${id(4)}','{"velden":["naam","straat"]}',true),('${id(12)}','exact_aanpassen','${id(4)}','{"velden":["straat","plaats"]}',true);`);
 expect((await db.query('select * from exact_taken_open(true) where onderneming_id=$1',[id(4)])).rows).toHaveLength(1);
 await db.query('select crm_taak_afronden($1)',[id(11)]);
 const t=(await db.query<any>('select * from crm_taken where onderneming_id=$1',[id(4)])).rows;
 expect(t).toHaveLength(3);expect(t.every(x=>x.status==='afgerond' && x.afgerond_op)).toBe(true);
 expect((await db.query("select * from sensitive_audit_log where target_table='crm_taken'")).rows).toHaveLength(3);
 expect((await db.query("select * from activiteiten_log where actie_type='crm_taken_afgerond'")).rows).toHaveLength(1);
});
it('afronden sluit geen andere onderneming of niet-overlappend veld af',async()=>{
 const task=(await db.query<any>('select * from crm_taken where onderneming_id=$1 and details->\'velden\' ? \'naam\'',[id(3)])).rows[0];
 await db.query('select crm_taak_afronden($1)',[task.id]);
 expect((await db.query('select * from crm_taken where onderneming_id=$1 and status=\'open\'',[id(3)])).rows).toHaveLength(1);
 expect((await db.query('select * from crm_taken where onderneming_id=$1 and status=\'open\'',[id(1)])).rows).toHaveLength(1);
});
it('testdata is verborgen en nooit samen met echte taken afgerond',async()=>{
 await change(5,{naam:'TEST gewijzigd'});
 await db.exec(`INSERT INTO crm_taken(id,soort,onderneming_id,details,is_test) VALUES('${id(13)}','exact_aanpassen','${id(5)}','{"velden":["naam"]}',false);`);
 expect((await db.query('select * from exact_taken_open(false)')).rows).toHaveLength(1);
 await db.query('select crm_taak_afronden($1)',[id(13)]);
 expect((await db.query('select * from crm_taken where onderneming_id=$1 and status=\'open\'',[id(5)])).rows).toHaveLength(1);
});
it('wijzigen en afronden vereisen MFA en behouden alle records bij weigering',async()=>{
 await db.exec("SET test.aal='aal1'");
 await expect(change(1,{naam:'Onbevoegd'})).rejects.toThrow('tweestapstoegang');
 await expect(db.query('select crm_taak_afronden($1)',[id(13)])).rejects.toThrow('tweestapstoegang');
 expect((await db.query<any>('select naam from ondernemingen where id=$1',[id(1)])).rows[0].naam).toBe('Laatste naam');
 await db.exec("SET test.aal='aal2'");
});
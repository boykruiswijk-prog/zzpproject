// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, expect, it } from "vitest";

const db = new PGlite();
beforeAll(async () => {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA cron;
    CREATE FUNCTION cron.schedule(text,text,text) RETURNS bigint LANGUAGE sql AS $$SELECT 1::bigint$$;
    CREATE TABLE aov_aanmeldingen(id uuid PRIMARY KEY, created_at timestamptz DEFAULT now(), naam text NOT NULL CONSTRAINT aov_aanmeldingen_naam_check CHECK(length(naam)>=2), email text NOT NULL CONSTRAINT aov_aanmeldingen_email_check CHECK(email LIKE '%@%'), telefoon text, user_id uuid, notitie text, behandeld_door uuid, behandeld_op timestamptz, bron text, status text, is_test boolean DEFAULT false);
    CREATE TABLE aov_doorverwijzingen(id uuid PRIMARY KEY, klik_id uuid, created_at timestamptz DEFAULT now(), user_id uuid, klant_ref text, bron text, is_test boolean DEFAULT false);`);
  await db.exec(readFileSync("drizzle/migrations/0212_aov_bewaartermijn_f9_9.sql", "utf8"));
  await db.exec(`INSERT INTO aov_aanmeldingen(id,naam,email,telefoon,user_id,notitie,bron,status,laatst_contact_op) VALUES
    ('00000000-0000-4000-8000-000000000001','Oud Contact','oud@example.nl','0612345678','00000000-0000-4000-8000-000000000099','Persoonsgegevens','/aov','polis',now()-interval '2 years 1 day'),
    ('00000000-0000-4000-8000-000000000002','Recent Contact','recent@example.nl',NULL,NULL,NULL,'/aov','nieuw',now()-interval '1 year'),
    ('00000000-0000-4000-8000-000000000003','Grens Contact','grens@example.nl',NULL,NULL,NULL,'/aov','nieuw',now()+interval '1 day'-interval '2 years');
    INSERT INTO aov_doorverwijzingen(id,klik_id,user_id,klant_ref,bron,laatst_contact_op) SELECT id,id,user_id,'klantnummer','/aov',now()-interval '3 years' FROM aov_aanmeldingen;
    SELECT aov_anonimiseer_verlopen();`);
}, 30000);
afterAll(() => db.close());
it("anonimiseert na twee jaar contactgegevens en koppelingen, behoudt telling en polisstatus", async () => {
  const r = await db.query("SELECT naam,email,telefoon,user_id,notitie,status FROM aov_aanmeldingen WHERE id='00000000-0000-4000-8000-000000000001'");
  expect(r.rows[0]).toEqual({naam:"",email:"",telefoon:null,user_id:null,notitie:null,status:"polis"});
  expect((await db.query("SELECT count(*)::int n FROM aov_aanmeldingen")).rows[0]).toEqual({n:3});
  expect((await db.query("SELECT count(*)::int n FROM aov_doorverwijzingen")).rows[0]).toEqual({n:3});
});
it("recente aanmelding beschermt ook de gekoppelde oudere doorverwijzing", async () => {
  expect((await db.query("SELECT email FROM aov_aanmeldingen WHERE id='00000000-0000-4000-8000-000000000002'")).rows[0]).toEqual({email:"recent@example.nl"});
  expect((await db.query("SELECT klant_ref FROM aov_doorverwijzingen WHERE klik_id='00000000-0000-4000-8000-000000000002'")).rows[0]).toEqual({klant_ref:"klantnummer"});
});
it("niet ouder dan twee jaar blijft behouden", async () => {
  expect((await db.query("SELECT email FROM aov_aanmeldingen WHERE id='00000000-0000-4000-8000-000000000003'")).rows[0]).toEqual({email:"grens@example.nl"});
});
it("opnieuw uitvoeren verandert geen tellingen", async () => {
  await db.exec("SELECT aov_anonimiseer_verlopen()");
  expect((await db.query("SELECT count(*)::int n FROM aov_aanmeldingen WHERE geanonimiseerd_op IS NOT NULL")).rows[0]).toEqual({n:1});
});
it("publiek en team mogen opschoontaak niet uitvoeren", async () => {
  const r = await db.query("SELECT has_function_privilege('anon','aov_anonimiseer_verlopen()','execute') a, has_function_privilege('authenticated','aov_anonimiseer_verlopen()','execute') t, has_function_privilege('service_role','aov_anonimiseer_verlopen()','execute') s");
  expect(r.rows[0]).toEqual({a:false,t:false,s:true});
});
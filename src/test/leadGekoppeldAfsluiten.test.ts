// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, expect, it } from "vitest";
const db = new PGlite();
const id = "00000000-0000-4000-8000-000000000001";
beforeAll(async () => {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth;
    GRANT USAGE ON SCHEMA auth TO authenticated;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT '${id}'::uuid$$;
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$SELECT jsonb_build_object('aal',current_setting('test.aal'))$$;
    CREATE FUNCTION is_team_member(uuid) RETURNS boolean LANGUAGE sql AS $$SELECT current_setting('test.role')='verzekering' AND auth.jwt()->>'aal'='aal2'$$;
    CREATE FUNCTION is_supervisor_or_admin(uuid) RETURNS boolean LANGUAGE sql AS $$SELECT false$$;
    SET test.role='verzekering'; SET test.aal='aal2';
    CREATE TYPE lead_status AS ENUM('nieuw','in_behandeling','klant','actief','gepauzeerd','opgezegd','afgerond','klant_geworden','geen_interesse','vraag_beantwoord','offerte_verstuurd');
    CREATE TABLE leads(id uuid PRIMARY KEY,type text,status lead_status,email text,is_test boolean,geactiveerd_op timestamptz,gekoppeld_onderneming_id uuid,gekoppeld_persoon_id uuid,converted_at timestamptz,iban text,verzekerd_bedrag numeric,gekozen_pakket text,eigen_risico numeric,exact_invoice_amount numeric);
    GRANT SELECT, UPDATE ON leads TO authenticated;
    ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
    CREATE POLICY team_select ON leads FOR SELECT TO authenticated USING(is_team_member(auth.uid()));
    CREATE POLICY team_update ON leads FOR UPDATE TO authenticated USING(is_team_member(auth.uid()));
    CREATE TABLE profiles(id uuid,full_name text);
    CREATE TABLE activiteiten_log(actie_type text,omschrijving text,uitgevoerd_door uuid,uitgevoerd_door_naam text,lead_id uuid,klant_email text,is_test boolean);
    INSERT INTO leads(id,type,status,email,is_test,gekoppeld_onderneming_id,gekoppeld_persoon_id,converted_at) VALUES('${id}','contact','klant','a23test@zpzaken.nl',true,'${id}','${id}','2026-10-29T12:00:00Z');`);
  const old = readFileSync("drizzle/migrations/0194_a19_leads_koppeling.sql", "utf8");
  await db.exec(old.slice(old.indexOf("CREATE OR REPLACE FUNCTION public.guard_a19_koppeling()"),old.indexOf("CREATE TRIGGER guard_a19_koppeling")));
  await db.exec("CREATE TRIGGER guard_a19_koppeling BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION guard_a19_koppeling()");
  const close = readFileSync("drizzle/migrations/0209_lead_status_uitkomsten_functies.sql", "utf8").split("-- Vandaag te doen:")[0];
  await db.exec(close);
  const sensitive = readFileSync("supabase/migrations/20260629113344_557818c4-0353-464d-beb2-dca48c5793d0.sql", "utf8");
  const start = sensitive.indexOf("CREATE OR REPLACE FUNCTION public.guard_lead_sensitive_changes()");
  const end = sensitive.indexOf("$$;", start) + 3;
  await db.exec(sensitive.slice(start,end));
  await db.exec("CREATE TRIGGER guard_sensitive BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION guard_lead_sensitive_changes(); SET ROLE authenticated;");
},30000);
afterAll(() => db.close());
it("reproduceert oorspronkelijke fout als verzekering bij gekoppelde contactvraag", async () => {
  await expect(db.query("SELECT lead_afsluiten($1,'vraag_beantwoord',NULL)",[id])).rejects.toThrow("Klantkoppeling alleen wijzigen");
});
it("verzekering sluit gekoppelde contactvraag af na herstel, met behoud van koppeling en converted_at", async () => {
  await db.exec("RESET ROLE");
  await db.exec(readFileSync("drizzle/migrations/0213_a23_gekoppelde_lead_uitkomst.sql", "utf8"));
  await db.exec("SET ROLE authenticated");
  await db.query("SELECT lead_afsluiten($1,'vraag_beantwoord',NULL)",[id]);
  const r = (await db.query("SELECT status,gekoppeld_onderneming_id,gekoppeld_persoon_id,converted_at::text FROM leads")).rows[0];
  expect(r).toMatchObject({status:"vraag_beantwoord",gekoppeld_onderneming_id:id,gekoppeld_persoon_id:id});
  expect(String(r.converted_at)).toContain("2026-10-29 12:00:00");
});
it("heropenen en alle drie uitkomsten behouden dezelfde koppeling", async () => {
  for (const status of ['klant_geworden','geen_interesse','vraag_beantwoord']) {
    await db.query("UPDATE leads SET status='in_behandeling' WHERE id=$1",[id]);
    await db.query("SELECT lead_afsluiten($1,$2,NULL)",[id,status]);
    expect((await db.query("SELECT status,gekoppeld_onderneming_id FROM leads")).rows[0]).toEqual({status,gekoppeld_onderneming_id:id});
  }
});
it("koppeling en converted_at blijven beschermd", async () => {
  for (const veld of ['gekoppeld_onderneming_id','gekoppeld_persoon_id','converted_at']) {
    await expect(db.exec(`UPDATE leads SET ${veld}=NULL`)).rejects.toThrow('Klantkoppeling alleen wijzigen');
  }
});
it("verzekering kan nog steeds niet opzeggen, zonder rechtenwijziging", async () => {
  await db.exec("RESET ROLE; SET zp.a19_rpc='1'");
  await expect(db.exec("SET ROLE authenticated; UPDATE leads SET status='opgezegd'")).rejects.toThrow('opzeggen of activatie terugdraaien');
  await db.exec("RESET ROLE; SET zp.a19_rpc=''; SET ROLE authenticated");
});
it("zonder tweestapscode blijft afsluiten geweigerd", async () => {
  await db.exec("SET test.aal='aal1'");
  await expect(db.query("SELECT lead_afsluiten($1,'geen_interesse',NULL)",[id])).rejects.toThrow('geen toegang');
  await db.exec("SET test.aal='aal2'");
});
it("Vandaag te doen sluit ook gemarkeerde afgesloten leads uit", async () => {
  await db.exec(`RESET ROLE;
    ALTER TABLE leads ADD COLUMN vlag text, ADD COLUMN vlag_datum date;
    UPDATE leads SET vlag='later',vlag_datum=current_date;
    CREATE FUNCTION mijn_acties_vandaag_basis(boolean) RETURNS jsonb LANGUAGE sql AS $$
      SELECT coalesce(jsonb_agg(l.id),'[]'::jsonb) FROM leads l WHERE true AND l.vlag IS NOT NULL AND l.vlag_datum IS NOT NULL AND l.vlag_datum <= vandaag
    $$;`.replace('<= vandaag','<= current_date'));
  // Production definition uses a PL/pgSQL local calendar date; keep the exact replacement target.
  await db.exec(`CREATE OR REPLACE FUNCTION mijn_acties_vandaag_basis(boolean) RETURNS jsonb LANGUAGE plpgsql AS $$
    DECLARE vandaag date := current_date; r jsonb;
    BEGIN SELECT coalesce(jsonb_agg(l.id),'[]'::jsonb) INTO r FROM leads l WHERE true AND l.vlag IS NOT NULL AND l.vlag_datum IS NOT NULL AND l.vlag_datum <= vandaag; RETURN r; END $$;`);
  await db.exec(readFileSync('drizzle/migrations/0214_a23_afgesloten_opvolging.sql','utf8'));
  for (const status of ['afgerond','klant_geworden','geen_interesse','vraag_beantwoord']) {
    await db.query('UPDATE leads SET status=$1::lead_status',[status]);
    expect((await db.query('SELECT mijn_acties_vandaag_basis(false) r')).rows[0]).toEqual({r:[]});
  }
  await db.exec("UPDATE leads SET status='in_behandeling'");
  expect((await db.query('SELECT mijn_acties_vandaag_basis(false) r')).rows[0]).toEqual({r:[id]});
});
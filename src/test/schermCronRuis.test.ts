// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const db = new PGlite();
beforeAll(async () => {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA cron;
    CREATE TABLE cron.job(jobid bigint,jobname text,schedule text);
    CREATE TABLE cron.job_run_details(runid bigint,jobid bigint,status text,start_time timestamptz,end_time timestamptz);
    CREATE TABLE machine_cron_stand(id int,laatste_runid bigint);
    INSERT INTO machine_cron_stand VALUES(1,0);
    CREATE TABLE machine_activiteit(id uuid DEFAULT gen_random_uuid(),created_at timestamptz DEFAULT now(),station text,actie text,tekst text,status text,is_test boolean DEFAULT false,gestart_op timestamptz,afgerond_op timestamptz,bron text);
    CREATE TABLE email_send_log(id uuid DEFAULT gen_random_uuid(),message_id text,status text,created_at timestamptz);
    CREATE TABLE lead_notification_log(id uuid DEFAULT gen_random_uuid(),resend_message_id text,status text,created_at timestamptz);
    CREATE FUNCTION machine_cron_station(text) RETURNS text LANGUAGE sql AS $$SELECT 'mail'::text$$;
    CREATE FUNCTION machine_cron_naam(text) RETURNS text LANGUAGE sql AS $$SELECT 'Mailwachtrij verwerkt'::text$$;`);
  const old = readFileSync('drizzle/migrations/0115_machine_meer_echte_activiteit.sql','utf8');
  await db.exec(old.slice(old.indexOf('CREATE OR REPLACE VIEW public.scherm_machine_live'),old.indexOf('CREATE OR REPLACE FUNCTION public.machine_cron_verwerken')));
  await db.exec(readFileSync('drizzle/migrations/0261_scherm_cronruis.sql','utf8'));
  await db.exec(`INSERT INTO cron.job VALUES(371,'process-email-queue','5 seconds'),(90,'wijziging-mailen-vangnet','*/15 * * * *');
    INSERT INTO cron.job_run_details SELECT g,371,'succeeded',now()-g*interval '5 seconds',now()-g*interval '5 seconds' FROM generate_series(1,180) g;
    INSERT INTO machine_activiteit(station,actie,tekst,status,bron) VALUES
      ('kwaliteit','agent_run','Hartslag: alle 9 controles in orde','klaar','hartslag'),
      ('kwaliteit','agent_run','Opvolger: 11 open, 0 nieuw gesignaleerd, 0 tweede signaal','klaar','opvolger'),
      ('kwaliteit','agent_run','Opvolger: 11 open, 1 nieuw gesignaleerd, 0 tweede signaal','klaar','opvolger'),
      ('kwaliteit','agent_run','Hartslag: 1 van 9 controles fout','fout','hartslag'),
      ('intake','lead_verzekering_aanvraag','Aanvraag binnen','klaar','lead'),
      ('mail','mail_verzonden','Mail verzonden','klaar','email_send_log');
    INSERT INTO cron.job_run_details VALUES(999,90,'succeeded',now(),now()),(1000,371,'failed',now(),now());`);
});
afterAll(() => db.close());
describe('A8: echte resultaten, geen cronruis', () => {
  it('180 lege vijfsecondenruns leveren nul schermregels, fouten blijven zichtbaar', async () => {
    expect((await db.query<{n:number}>(`SELECT count(*)::int n FROM scherm_machine_live WHERE actie='cron' AND status<>'fout'`)).rows[0].n).toBe(0);
    expect((await db.query<{n:number}>(`SELECT count(*)::int n FROM scherm_machine_live WHERE actie='cron' AND status='fout'`)).rows[0].n).toBe(1);
  });
  it('technische hartslag en lege opvolgrondes vallen weg, echt signaal en fout blijven', async () => {
    const texts=(await db.query<{tekst:string}>(`SELECT tekst FROM scherm_machine_live WHERE station='kwaliteit' ORDER BY tekst`)).rows.map(r=>r.tekst);
    expect(texts).toEqual(['Hartslag: 1 van 9 controles fout','Opvolger: 11 open, 1 nieuw gesignaleerd, 0 tweede signaal']);
  });
  it('alleen sent-bewijs telt, 2+1 mails in hetzelfde kwartier geven één regel met 3', async () => {
    await db.exec(`INSERT INTO email_send_log(message_id,status,created_at) VALUES ('a','sent',date_trunc('hour',now())-interval '1 hour'+interval '1 minute'),('b','sent',date_trunc('hour',now())-interval '1 hour'+interval '14 minutes'),('failed','failed',now()),('queued','pending',now()),('a','sent',date_trunc('hour',now())-interval '1 hour'+interval '2 minutes');
      INSERT INTO lead_notification_log(resend_message_id,status,created_at) VALUES('c','sent',date_trunc('hour',now())-interval '1 hour'+interval '5 minutes'),('a','sent',date_trunc('hour',now())-interval '1 hour'+interval '1 minute');`);
    expect((await db.query(`SELECT tekst FROM scherm_machine_live WHERE id LIKE 'mail-kwartier-%'`)).rows).toEqual([{tekst:'3 mails verstuurd'}]);
  });
  it('het volgende kwartier krijgt één eigen regel en stabiele id bij extra mail', async () => {
    await db.exec(`INSERT INTO email_send_log(message_id,status,created_at) VALUES('d','sent',date_trunc('hour',now())-interval '1 hour'+interval '15 minutes');`);
    const first=(await db.query<{id:string}>(`SELECT id FROM scherm_machine_live WHERE tekst='1 mails verstuurd'`)).rows[0];
    expect(first?.id).toMatch(/^mail-kwartier-/);
    await db.exec(`INSERT INTO email_send_log(message_id,status,created_at) VALUES('e','sent',date_trunc('hour',now())-interval '1 hour'+interval '16 minutes');`);
    expect((await db.query(`SELECT id,tekst FROM scherm_machine_live WHERE id=$1`,[first?.id])).rows).toEqual([{id:first?.id,tekst:'2 mails verstuurd'}]);
  });
  it('echte aanvraag blijft in beperkte feed, cron en mailbronrecords blijven ongewijzigd', async () => {
    expect((await db.query<{actie:string}>(`SELECT actie FROM scherm_machine_live ORDER BY created_at DESC LIMIT 40`)).rows.some(r=>r.actie==='lead_verzekering_aanvraag')).toBe(true);
    expect((await db.query<{n:number}>(`SELECT count(*)::int n FROM cron.job_run_details`)).rows[0].n).toBe(182);
    expect((await db.query(`SELECT schedule FROM cron.job WHERE jobid=371`)).rows).toEqual([{schedule:'5 seconds'}]);
    expect((await db.query<{n:number}>(`SELECT count(*)::int n FROM machine_activiteit`)).rows[0].n).toBe(6);
  });
});
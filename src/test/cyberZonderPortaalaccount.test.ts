// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { klantOntvanger } from "../../supabase/functions/_shared/klantmailSchakelaar";
import { mailCertificaat } from "../../supabase/functions/_shared/certificaatMail";

const sql = (file: string) => readFileSync(`drizzle/migrations/${file}`, "utf8");
const policy = "00000000-0000-0000-0000-000000000010";
const company = "00000000-0000-0000-0000-000000000020";
const actor = "00000000-0000-0000-0000-000000000030";
const answers = '{"a":false,"b":true,"c":true,"d":true,"e":false,"f":false}';
const aanvraag = `SELECT cyber_toevoegen_aanvragen('${policy}','${answers}','2026-10-22',true,'Besluit Boy: uitzondering Digital Native Consulting',true) AS id`;

async function setup() {
  const db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid,email text);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('test.uid',true),'')::uuid$$;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$SELECT current_setting('test.role',true)$$;
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$SELECT '{"aal":"aal2","email":"ellen.baars@zpzaken.nl"}'::jsonb$$;
    CREATE FUNCTION is_supervisor_or_admin(uuid) RETURNS boolean LANGUAGE sql AS $$SELECT current_setting('test.team',true)='true'$$;
    CREATE FUNCTION has_role(uuid,text) RETURNS boolean LANGUAGE sql AS $$SELECT current_setting('test.team',true)='true'$$;
    CREATE TABLE ondernemingen(id uuid PRIMARY KEY,is_test boolean,exact_account_id uuid,facturatie_blokkade text);
    CREATE TABLE leads(id uuid PRIMARY KEY,status text,gekozen_pakket text,email text,is_test boolean,extra_data jsonb);
    CREATE TABLE policies(id uuid PRIMARY KEY,user_id uuid,onderneming_id uuid,lead_id uuid,status text,start_date date,package_type text,is_test boolean);
    CREATE TABLE klant_contracten(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),onderneming_id uuid,product text,status text,begin_datum date,created_at timestamptz DEFAULT now(),cyclus text,is_test boolean,cyber_lead_id uuid,
      bron text,bron_rij integer,type text,itemcode text,aantal numeric,bedrag_per_periode numeric,factureren_vanaf date,gefactureerd_tm date,volgende_factuurdatum date,gefactureerd_tm_bron text,facturatie_status text,cyber_voorwaarden_versie text,cyber_ingangsdatum date,cyber_einddatum date,cyber_toevoeg_verzoek_id uuid);
    CREATE TABLE activiteiten_log(actie_type text,omschrijving text,uitgevoerd_door uuid,uitgevoerd_door_naam text,lead_id uuid,is_test boolean);
    CREATE TABLE factuur_artikel_mapping(id uuid,bevestigd boolean,exact_item_id uuid,blokkade_reden text,product text,gl_code text,btw_code text);
    CREATE TABLE cyber_activatie_config(id boolean,actief boolean,modus text);
    CREATE TABLE cyber_e4_testbewijs(verzoek_id uuid);
    CREATE FUNCTION contract_opzegging(uuid) RETURNS date LANGUAGE sql AS $$SELECT NULL::date$$;
    CREATE FUNCTION bron_rij_voor_lead(uuid) RETURNS bigint LANGUAGE sql AS $$SELECT 1::bigint$$;
    CREATE FUNCTION factuur_periode_eind(date,text) RETURNS date LANGUAGE sql AS $$SELECT ($1+interval '1 year'-interval '1 day')::date$$;
    CREATE FUNCTION factuur_mapping_voor(text) RETURNS factuur_artikel_mapping LANGUAGE sql AS $$SELECT * FROM factuur_artikel_mapping LIMIT 1$$;
    SELECT set_config('test.uid','${actor}',false),set_config('test.role','authenticated',false),set_config('test.team','true',false);
    INSERT INTO auth.users VALUES('${actor}','ellen.baars@zpzaken.nl');
    INSERT INTO ondernemingen VALUES('${company}',false,'00000000-0000-0000-0000-000000000040',NULL);
    INSERT INTO policies VALUES('${policy}',NULL,'${company}',NULL,'geldig','2026-10-22','bav_avb',false);
    INSERT INTO klant_contracten(onderneming_id,product,status,begin_datum,cyclus,is_test) VALUES('${company}','bav_avb','actief','2026-10-22','maand',false);
    INSERT INTO factuur_artikel_mapping VALUES(gen_random_uuid(),true,gen_random_uuid(),NULL,'cyber_clear','8003','0');
    INSERT INTO cyber_activatie_config VALUES(true,true,'live');`);
  const initial = sql("0156_cyber_toevoegen_verzoek_beoordeling.sql");
  await db.exec(initial.slice(0, initial.indexOf("CREATE FUNCTION public.cyber_toevoegen_mogelijk")));
  await db.exec(`ALTER TABLE cyber_toevoeg_verzoeken ADD COLUMN contract_id uuid,ADD COLUMN geactiveerd_op timestamptz,ADD COLUMN certificaat_pad text,ADD COLUMN certificaat_versie integer,ADD COLUMN document_claim uuid,ADD COLUMN document_claim_op timestamptz,ADD COLUMN document_basis_versie integer,ADD COLUMN certificaat_gecontroleerd_pad text,ADD COLUMN certificaat_gecontroleerd_op timestamptz,ADD COLUMN certificaat_gecontroleerd_door uuid,ADD COLUMN mail_status text NOT NULL DEFAULT 'wacht',ADD COLUMN mail_claim_op timestamptz,ADD COLUMN mail_poging integer NOT NULL DEFAULT 0;`);
  const possible = sql("0175_cyber_toevoegen_team_zonder_account.sql");
  await db.exec(possible.slice(0, possible.indexOf("CREATE OR REPLACE FUNCTION public.cyber_toevoegen_aanvragen")));
  const request = sql("0182_cyber_register_akkoord_herstel.sql");
  await db.exec(request.slice(request.indexOf("CREATE OR REPLACE FUNCTION public.cyber_toevoegen_aanvragen")));
  await db.exec(sql("0255_cyber_ingang_uitzondering.sql"));
  await db.exec(`INSERT INTO cyber_ingang_uitzonderingen(onderneming_id,vroegst,reden,besloten_door) VALUES('${company}','2026-10-22','Digital Native Consulting: besluit Boy 7-11','register E-aanvulling');`);
  await db.exec(sql("0165_cyber_human_approval_then_service_core.sql"));
  await db.exec(sql("0173_cyber_intern_testguard_alias.sql"));
  const claims = sql("0163_cyber_test_core_and_manual_mail_claim.sql");
  await db.exec(claims.slice(claims.indexOf("CREATE OR REPLACE FUNCTION public.cyber_toevoegen_mail_claim"),claims.indexOf("COMMENT ON FUNCTION public.facturatie_testcontract")));
  await db.exec(sql("0168_cyber_separate_certificate_mail_claim.sql"));
  await db.exec(sql("0187_cyber_e8_document_apart.sql"));
  return db;
}

describe("Cyber zonder portaalaccount: Ellens scenario, uitsluitend lokale database", () => {
  it("reproduceert NOT NULL, herstelt teamaanvraag 22-10, beoordeelt en activeert zonder BAV-wijziging", async () => {
    const db = await setup();
    try {
      await expect(db.query(aanvraag)).rejects.toThrow(/null value in column "user_id"/);
      await db.exec(sql("0260_cyber_team_zonder_portaalaccount.sql"));
      const { rows: [{ id }] } = await db.query<{id:string}>(aanvraag);
      expect((await db.query(`SELECT user_id,bron,gewenste_ingangsdatum::text FROM cyber_toevoeg_verzoeken WHERE id=$1`,[id])).rows[0]).toEqual({user_id:null,bron:"team",gewenste_ingangsdatum:"2026-10-22"});
      expect((await db.query<{status:string}>(`SELECT cyber_toevoegen_beoordelen($1,true,'Telefonisch beoordeeld door Ellen') status`,[id])).rows[0].status).toBe("akkoord_wacht_op_activatie");
      await db.exec(`SELECT set_config('test.role','service_role',false)`);
      expect((await db.query<{status:string}>(`SELECT cyber_toevoegen_activeren_intern($1,'Akkoord Ellen, afzonderlijk activeren',false) status`,[id])).rows[0].status).toBe("actief");
      const cyber = (await db.query(`SELECT cyclus,cyber_ingangsdatum::text,cyber_einddatum::text FROM klant_contracten WHERE cyber_toevoeg_verzoek_id=$1`,[id])).rows[0];
      expect(cyber).toEqual({cyclus:"maand",cyber_ingangsdatum:"2026-10-22",cyber_einddatum:"2027-10-21"});
      expect((await db.query(`SELECT count(*)::int n FROM klant_contracten WHERE product='bav_avb' AND begin_datum='2026-10-22' AND cyclus='maand'`)).rows[0]).toEqual({n:1});
      const lease = "00000000-0000-0000-0000-000000000050";
      await db.query(`UPDATE cyber_toevoeg_verzoeken SET document_claim=$2 WHERE id=$1`,[id,lease]);
      expect((await db.query<{ok:boolean}>(`SELECT cyber_aanvraag_document_klaar($1,$2,$3) ok`,[id,lease,`cyber-toevoegen/${id}-${lease}.pdf`])).rows[0].ok).toBe(true);
      expect((await db.query<{n:number|null}>(`SELECT cyber_toevoegen_mail_claim($1,false) n`,[id])).rows[0].n).toBeNull();
      expect((await db.query<{n:number}>(`SELECT cyber_toevoegen_certificaat_mail_claim($1,false) n`,[id])).rows[0].n).toBe(1);
      await db.query(`UPDATE cyber_toevoeg_verzoeken SET certificaat_mail_status='verzonden' WHERE id=$1`,[id]);
      expect((await db.query<{n:number}>(`SELECT cyber_toevoegen_mail_claim($1,false) n`,[id])).rows[0].n).toBe(1);
      expect((await db.query<{n:number|null}>(`SELECT cyber_toevoegen_mail_claim($1,false) n`,[id])).rows[0].n).toBeNull();
    } finally { await db.close(); }
  },30000);

  it("weigert klantpad zonder account, directe klantinsert met NULL en klantlezing van NULL-teamverzoek", async () => {
    const db = await setup();
    try {
      await db.exec(sql("0260_cyber_team_zonder_portaalaccount.sql"));
      await expect(db.query(aanvraag.replace(",true) AS id",",false) AS id"))).rejects.toThrow(/geen toegang of klantaccount ontbreekt/);
      const {rows:[{id}]} = await db.query<{id:string}>(aanvraag);
      await expect(db.query(`UPDATE cyber_toevoeg_verzoeken SET bron='klant' WHERE id=$1`,[id])).rejects.toThrow(/cyber_verzoek_klant_account_verplicht/);
      await db.exec(`SELECT set_config('test.team','false',false); SET ROLE authenticated;`);
      expect((await db.query(`SELECT count(*)::int n FROM cyber_toevoeg_verzoeken`)).rows[0]).toEqual({n:0});
      await db.exec(`RESET ROLE; SELECT set_config('test.team','true',false); SET ROLE authenticated;`);
      expect((await db.query(`SELECT count(*)::int n FROM cyber_toevoeg_verzoeken`)).rows[0]).toEqual({n:1});
    } finally { await db.close(); }
  },30000);

  it("de uitzondering verruimt niet de vroegste datum 22-10-2026", async () => {
    const db = await setup();
    try {
      await db.exec(sql("0260_cyber_team_zonder_portaalaccount.sql"));
      await expect(db.query(aanvraag.replace("'2026-10-22',true","'2026-10-21',true"))).rejects.toThrow(/vroegst/);
    } finally { await db.close(); }
  },30000);

  it("vindt het ondernemingscontact zonder lead/account en plant certificaatmail zonder echte verzending", async () => {
    const queries: string[] = [];
    const db = {from: (table:string) => {
      queries.push(table);
      const q = {select: () => q,eq: async () => ({data:[{personen:{voornaam:"Testcontact",email_weergave:"test@zpzaken.nl"}}]})}; return q;
    }};
    expect(await klantOntvanger(db,company,null)).toEqual({email:"test@zpzaken.nl",voornaam:"Testcontact"});
    const fetchSpy = vi.spyOn(globalThis,"fetch").mockRejectedValue(new Error("Geen netwerk toegestaan"));
    const oldDeno = (globalThis as any).Deno;
    (globalThis as any).Deno = {env:{get: () => "test-key"}};
    try {
      const result = await mailCertificaat(db,new Request("https://zpzaken.nl"),{user_id:null,lead_id:null,onderneming_id:company,pdf_url:"test.pdf",certificate_number:"TEST"},{id:actor},{dryRun:true});
      expect(result.status).toBe("zou_verzenden");
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(queries).toEqual(["persoon_onderneming","persoon_onderneming"]);
    } finally { fetchSpy.mockRestore(); (globalThis as any).Deno=oldDeno; }
  });
});
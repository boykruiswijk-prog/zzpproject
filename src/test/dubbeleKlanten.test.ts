// @vitest-environment node
// Dubbele klantkaarten (akkoord Boy 2-11): activatie hergebruikt kaart op KvK, database weigert nieuwe dubbelen,
// samenvoegen verplaatst koppelingen zonder iets te verwijderen.
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { kiesKaartOpKvk, zetInPlanner } from "../../supabase/functions/_shared/klantContractActivatie";

function nep(ondernemingen: any[]) {
  const contracten: any[] = [];
  const q = (tabel: string) => {
    const f: [string, unknown][] = [];
    const rows = () => (tabel === "ondernemingen" ? ondernemingen : []).filter((r) => f.every(([k, v]) => r[k] === v));
    const api: any = {
      select: () => api, eq: (k: string, v: unknown) => { f.push([k, v]); return api; },
      is: (k: string, v: unknown) => { f.push([k, v]); return api; },
      limit: () => ({ ...api, then: (res: any) => res({ data: rows() }) }),
      maybeSingle: async () => ({ data: rows()[0] ?? null }),
      update: (u: any) => { const a: any = { eq: (k: string, v: unknown) => { f.push([k, v]); return a; }, is: (k: string, v: unknown) => { f.push([k, v]); rows().forEach((r) => Object.assign(r, u)); return Promise.resolve({ error: null }); } }; return a; },
      insert: (row: any) => { const r = { id: "nieuw", samengevoegd_naar: null, ...row }; ondernemingen.push(r); return { select: () => ({ single: async () => ({ data: r, error: null }) }) }; },
      upsert: async (row: any) => { contracten.push(row); return { error: null }; },
    };
    return api;
  };
  return { from: q, contracten, ondernemingen };
}
const spec = { cyclus: "jaar" as const, itemcode: "100J", bedrag_per_periode: 600, periodeStart: "2026-11-03", periodeEind: "2027-11-02" };

describe("activatie met bestaand KvK maakt geen tweede onderneming", () => {
  it("bestaande kaart met hetzelfde KvK (ander of geen Exact-account) wordt hergebruikt", async () => {
    const sb = nep([{ id: "oud", kvk: "72276304", is_test: false, exact_account_id: "ander-acc", samengevoegd_naar: null, created_at: "2026-10-12" }]);
    const r = await zetInPlanner(sb, { id: "44444444-4444-4444-4444-444444444444", kvk_nummer: "72276304", is_test: false }, "acc-nieuw", spec);
    expect(r).toMatchObject({ ok: true, onderneming_id: "oud" });
    expect(sb.ondernemingen).toHaveLength(1);
    expect(sb.ondernemingen[0].exact_account_id).toBe("ander-acc");
  });
  it("samengevoegde kaart telt niet mee, de hoofdkaart wel", async () => {
    const sb = nep([
      { id: "samengevoegd", kvk: "72276304", is_test: false, exact_account_id: null, samengevoegd_naar: "hoofd", created_at: "2026-10-12" },
      { id: "hoofd", kvk: "72276304", is_test: false, exact_account_id: null, samengevoegd_naar: null, created_at: "2026-10-13" },
    ]);
    const r = await zetInPlanner(sb, { id: "55555555-5555-5555-5555-555555555555", kvk_nummer: "72276304", is_test: false }, "acc-x", spec);
    expect(r).toMatchObject({ ok: true, onderneming_id: "hoofd" });
    expect(sb.ondernemingen).toHaveLength(2);
  });
  it("kiesKaartOpKvk: eerst zelfde Exact-account, dan zonder account, dan oudste", () => {
    const rijen = [{ id: "b", exact_account_id: "x", created_at: "2026-10-02" }, { id: "a", exact_account_id: null, created_at: "2026-10-05" }, { id: "c", exact_account_id: "acc", created_at: "2026-10-09" }];
    expect(kiesKaartOpKvk(rijen, "acc")?.id).toBe("c");
    expect(kiesKaartOpKvk(rijen, "zz")?.id).toBe("a");
    expect(kiesKaartOpKvk([rijen[0]], "zz")?.id).toBe("b");
    expect(kiesKaartOpKvk([], "zz")).toBeNull();
  });
});

const db = new PGlite();
const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const tabellen = ["bav_nummer_nakijken", "klant_certificaten", "klant_mandaten", "crm_taken", "klant_contracten", "policies", "klant_service_aanvragen", "lead_klant_log", "klant_vlag_log", "klantmail_log", "prolongatie_log", "incasso_mislukt", "cyber_toevoeg_verzoeken", "nps_antwoorden", "exact_betaalconditie_import"];

beforeAll(async () => {
  await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT '${id(99)}'::uuid $$;
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$ SELECT jsonb_build_object('aal',current_setting('test.aal',true)) $$;
    CREATE FUNCTION is_supervisor_or_admin(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT current_setting('test.rol',true)='supervisor' $$;
    CREATE FUNCTION has_role(uuid, text) RETURNS boolean LANGUAGE sql AS $$ SELECT current_setting('test.rol',true)=$2 $$;
    CREATE TABLE profiles(id uuid primary key, full_name text);
    CREATE TABLE ondernemingen(id uuid primary key, naam text, kvk text, is_test boolean not null default false, created_at timestamptz default now(), samengevoegd_naar uuid, samengevoegd_op timestamptz);
    CREATE TABLE persoon_onderneming(persoon_id uuid, onderneming_id uuid, unique(persoon_id, onderneming_id));
    CREATE TABLE bav_nummer_bevestigingen(onderneming_id uuid, nummer text, unique(onderneming_id, nummer));
    CREATE TABLE crm_notities(id uuid default gen_random_uuid(), onderneming_id uuid, soort text, tekst text, aangemaakt_door uuid, aangemaakt_door_naam text, is_test boolean, details jsonb);
    CREATE TABLE sensitive_audit_log(target_table text, target_id uuid, actie text, veld text, oude_waarde text, nieuwe_waarde text, uitgevoerd_door uuid, details jsonb);
    CREATE TABLE leads(id uuid, gekoppeld_onderneming_id uuid);
    CREATE TABLE aanvraag_concepten(id uuid, gekoppeld_onderneming_id uuid);
    CREATE TABLE onderneming_opvolging(van_onderneming_id uuid, naar_onderneming_id uuid);
    CREATE TABLE omzetting_beslissingen(van_onderneming_id uuid, naar_onderneming_id uuid);
    ${tabellen.map((t) => `CREATE TABLE ${t}(id serial, onderneming_id uuid, certificaatnummer text, aanvraagdatum date, kenmerk text, bron text);`).join("\n")}
    SET test.aal='aal2'; SET test.rol='verzekering';`);
  const sql = readFileSync("drizzle/migrations/0221_dubbele_klanten_samenvoegen_functies.sql", "utf8");
  await db.exec(sql.slice(0, sql.indexOf("DO $m$")));
  await db.exec(`INSERT INTO profiles VALUES ('${id(99)}','Ellen Baars');
    INSERT INTO ondernemingen(id,naam,kvk,created_at) VALUES ('${id(1)}','InnoThermFlo B.V.','72276304','2026-10-12'),('${id(2)}','InnoThermFlo B.V.','72276304','2026-10-13');`);
});

describe("database: dubbele kaarten", () => {
  it("weigert een nieuwe echte kaart met een KvK dat al actief bestaat", async () => {
    await expect(db.exec(`INSERT INTO ondernemingen(id,naam,kvk) VALUES ('${id(3)}','Nieuw','72276304')`)).rejects.toThrow(/bestaat al een klantkaart/);
    await db.exec(`INSERT INTO ondernemingen(id,naam,kvk,is_test) VALUES ('${id(4)}','TEST','72276304',true)`);
    await db.exec(`INSERT INTO ondernemingen(id,naam,kvk) VALUES ('${id(5)}','Ander','12345678')`);
  });
  it("samenvoegen verplaatst persoon, BAV-bevestiging, notities, polis en logs; niets verwijderd", async () => {
    await db.exec(`INSERT INTO persoon_onderneming VALUES ('${id(50)}','${id(1)}');
      INSERT INTO bav_nummer_bevestigingen VALUES ('${id(1)}','ZPBAV3183');
      INSERT INTO crm_notities(onderneming_id,soort,tekst) VALUES ('${id(1)}','notitie','oud');
      INSERT INTO policies(onderneming_id) VALUES ('${id(1)}'); INSERT INTO crm_taken(onderneming_id) VALUES ('${id(1)}');
      INSERT INTO klant_contracten(onderneming_id) VALUES ('${id(2)}');`);
    const r = (await db.query<{ r: any }>(`SELECT onderneming_samenvoegen('${id(1)}','${id(2)}','test') r`)).rows[0].r;
    expect(r.verplaatst).toMatchObject({ persoon_onderneming: 1, bav_nummer_bevestigingen: 1, crm_notities: 1, policies: 1, crm_taken: 1, klant_contracten: 0 });
    const o = (await db.query<any>(`SELECT samengevoegd_naar FROM ondernemingen WHERE id='${id(1)}'`)).rows[0];
    expect(o.samengevoegd_naar).toBe(id(2));
    expect((await db.query<any>(`SELECT count(*)::int n FROM ondernemingen WHERE kvk='72276304'`)).rows[0].n).toBe(3);
    expect((await db.query<any>(`SELECT count(*)::int n FROM bav_nummer_bevestigingen WHERE onderneming_id='${id(2)}' AND nummer='ZPBAV3183'`)).rows[0].n).toBe(1);
    expect((await db.query<any>(`SELECT count(*)::int n FROM crm_notities WHERE onderneming_id='${id(2)}'`)).rows[0].n).toBe(2);
    expect((await db.query<any>(`SELECT count(*)::int n FROM sensitive_audit_log WHERE actie='klantkaart_samengevoegd'`)).rows[0].n).toBe(1);
  });
  it("na samenvoegen mag er geen tweede samenvoeging op dezelfde kaart, en zonder MFA of rol geen toegang", async () => {
    await expect(db.query(`SELECT onderneming_samenvoegen('${id(1)}','${id(2)}')`)).rejects.toThrow(/al samengevoegd/);
    await db.exec(`SET test.aal='aal1'`);
    await expect(db.query(`SELECT onderneming_samenvoegen('${id(5)}','${id(2)}')`)).rejects.toThrow(/geen toegang/);
    await db.exec(`SET test.aal='aal2'; SET test.rol='medewerker'`);
    await expect(db.query(`SELECT dubbele_klanten()`)).rejects.toThrow(/geen toegang/);
    await db.exec(`SET test.rol='verzekering'`);
  });
  it("samenvoegen over verschillende KvK-nummers wordt geweigerd", async () => {
    await expect(db.query(`SELECT onderneming_samenvoegen('${id(5)}','${id(2)}')`)).rejects.toThrow(/KvK-nummers verschillen/);
  });
});

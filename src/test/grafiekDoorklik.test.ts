// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { bucketBereik, productNaam, filterRecords, telRecords, type GrafiekRecord } from "@/lib/grafiekDoorklik";

const db = new PGlite();
const u = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;

beforeAll(async () => {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE TYPE public.app_role AS ENUM ('supervisor','admin','verzekering','medewerker','marketing');
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT '00000000-0000-0000-0000-000000000001'::uuid$$;
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$SELECT jsonb_build_object('aal',current_setting('test.aal'))$$;
    CREATE FUNCTION public.has_role(uuid,public.app_role) RETURNS boolean LANGUAGE sql AS $$SELECT $2::text=current_setting('test.role')$$;
    SET test.aal='aal2'; SET test.role='admin';
    CREATE TABLE public.profiles(id uuid, full_name text);
    INSERT INTO public.profiles VALUES ('${u(99)}','Ellen Baars');
    CREATE TABLE public.leads(id uuid, voornaam text, achternaam text, bedrijfsnaam text, email text, verzekering_type text,
      gekozen_pakket text, status text, created_at timestamptz, bron text, assigned_to uuid, is_test boolean);
    CREATE TABLE public.activiteiten_log(id uuid, lead_id uuid, actie_type text, aangemaakt_op timestamptz);
    CREATE TABLE public.ondernemingen(id uuid, naam text);
    CREATE TABLE public.klant_contracten(id uuid, onderneming_id uuid, product text, status text, maandwaarde numeric,
      begin_datum date, eind_datum date, is_test boolean);
    CREATE TABLE public.doel_rijen(sleutel uuid, dag date);
    CREATE FUNCTION public.tel_aanvragen_doel_rijen(date) RETURNS TABLE(sleutel uuid, dag date) LANGUAGE sql AS $$SELECT sleutel, dag FROM public.doel_rijen WHERE dag >= $1$$;`);
  // Leads: 22:30 UTC telt in NL als de volgende dag (tijdzonecontrole).
  await db.exec(`INSERT INTO public.leads VALUES
    ('${u(1)}','An','Jansen','An BV','an@x.nl','BAV & AVB Maandelijks',null,'actief', date_trunc('day', now()) - interval '2 days' + interval '22 hours 30 minutes','website','${u(99)}',false),
    ('${u(2)}','Bo','Smit','Bo VOF','bo@x.nl','bav_avb',null,'nieuw', now() - interval '1 day','telefoon',null,false),
    ('${u(3)}','Cas','Vos',null,'cas@x.nl','BAV & AVB Maandelijks + Cyber (proef)',null,'actief', now() - interval '1 day','website',null,false),
    ('${u(4)}','Test','Lead',null,'t@zpzaken.nl','bav_avb',null,'actief', now(),'website',null,true),
    ('${u(5)}','Dirk','Oud',null,'d@x.nl',null,null,'afgewezen', now() - interval '40 days','email',null,false);
    INSERT INTO public.activiteiten_log VALUES
    ('${u(11)}','${u(1)}','lead_geactiveerd', now() - interval '1 day'),
    ('${u(12)}','${u(3)}','lead_geactiveerd', now()),
    ('${u(13)}','${u(4)}','lead_geactiveerd', now()),
    ('${u(14)}','${u(2)}','iets_anders', now());
    INSERT INTO public.doel_rijen VALUES ('${u(1)}','2026-10-07'),('${u(2)}','2026-10-07'),('${u(3)}','2026-10-12'),('${u(5)}','2026-10-01');
    INSERT INTO public.ondernemingen VALUES ('${u(21)}','Klant A'),('${u(22)}','Klant B');
    INSERT INTO public.klant_contracten VALUES
    ('${u(31)}','${u(21)}','bav_avb','actief',50,(now() AT TIME ZONE 'Europe/Amsterdam')::date - 3,null,false),
    ('${u(32)}','${u(22)}','cyber_clear','loopt_af',10,(now() AT TIME ZONE 'Europe/Amsterdam')::date - 400,(now() AT TIME ZONE 'Europe/Amsterdam')::date - 1,false),
    ('${u(33)}','${u(22)}','bav_avb','actief',999,(now() AT TIME ZONE 'Europe/Amsterdam')::date - 2,null,true),
    ('${u(34)}','${u(22)}','bav_avb','vervangen',999,(now() AT TIME ZONE 'Europe/Amsterdam')::date - 2,null,false);`);
  await db.exec(readFileSync("drizzle/migrations/0206_grafiek_doorklik_a23.sql", "utf8"));
}, 30000);
afterAll(() => db.close());

const grafiek = async (g: string, t = false) =>
  (await db.query<{ r: { sleutel: string; waarde: number }[] }>("SELECT public.admin_grafiek($1,$2) r", [g, t])).rows[0].r;
const records = async (g: string, s: string | null, van: string | null = null, tot: string | null = null, t = false) =>
  (await db.query<{ r: GrafiekRecord[] }>("SELECT public.admin_grafiek_records($1,$2,$3::date,$4::date,$5) r", [g, s, van, tot, t])).rows[0].r;

describe("lijstlengte = grafiekwaarde, per grafiek", () => {
  for (const g of ["leads_dag", "leads_status", "leads_verzekering", "activaties_maand", "aanvragen"]) {
    it(`${g}: elk element heeft exact zoveel regels als zijn waarde`, async () => {
      const punten = await grafiek(g);
      expect(punten.length).toBeGreaterThan(0);
      for (const p of punten) expect((await records(g, p.sleutel)).length).toBe(Number(p.waarde));
    });
  }
  for (const g of ["arr_nieuw", "arr_aflopend", "arr_netto"]) {
    it(`${g}: som van ARR in de lijst is exact de staafwaarde`, async () => {
      const punten = await grafiek(g);
      expect(punten.length).toBeGreaterThan(0);
      for (const p of punten) {
        const som = (await records(g, p.sleutel)).reduce((s, r) => s + Number(r.bedrag), 0);
        expect(Math.round(som * 100) / 100).toBe(Number(p.waarde));
      }
    });
  }
  it("aanvragen per week/periode en cumulatief: bereik telt gelijk aan de som van de dagen", async () => {
    expect((await records("aanvragen", null, "2026-10-06", "2026-10-12")).length).toBe(3);
    expect((await records("aanvragen", null, null, "2026-10-07")).length).toBe(2);
  });
});

describe("zelfde filters als de grafiek", () => {
  it("testdata telt nooit mee, ook niet in activaties", async () => {
    const st = await grafiek("leads_status");
    expect(st.find((p) => p.sleutel === "actief")?.waarde).toBe(2);
    expect((await grafiek("activaties_maand")).reduce((s, p) => s + Number(p.waarde), 0)).toBe(2);
    expect((await grafiek("arr_nieuw")).reduce((s, p) => s + Number(p.waarde), 0)).toBe(600);
  });
  it("leads per dag gebruikt Europe/Amsterdam en alleen de laatste 14 dagen", async () => {
    const r = await records("leads_dag", null, null, "2999-01-01");
    expect(r.map((x) => x.id)).not.toContain(u(5));
    const an = r.find((x) => x.id === u(1))!;
    const nl = (await db.query<{ d: string }>(`SELECT to_char((created_at AT TIME ZONE 'Europe/Amsterdam')::date,'YYYY-MM-DD') d FROM leads WHERE id='${u(1)}'`)).rows[0].d;
    expect(an.sleutel).toBe(nl);
    expect(an.behandelaar).toBe("Ellen Baars");
    expect(an.link).toBe(`/admin/leads/${u(1)}`);
  });
  it("leads per verzekering laat leads zonder verzekering weg", async () => {
    expect((await grafiek("leads_verzekering")).reduce((s, p) => s + Number(p.waarde), 0)).toBe(3);
  });
});

describe("toegang", () => {
  it("vereist tweestapscode en een teamrol admin, supervisor of verzekering", async () => {
    await db.exec("SET test.aal='aal1'"); await expect(grafiek("leads_status")).rejects.toThrow("Geen toegang");
    await db.exec("SET test.aal='aal2'; SET test.role='medewerker'"); await expect(grafiek("leads_status")).rejects.toThrow("Geen toegang");
    await db.exec("SET test.role='verzekering'"); expect((await grafiek("leads_status")).length).toBeGreaterThan(0);
  });
  it("verzekering ziet geen ARR en kan testdata niet aanzetten", async () => {
    await expect(grafiek("arr_nieuw")).rejects.toThrow("Geen toegang tot ARR");
    expect((await grafiek("leads_status", true)).find((p) => p.sleutel === "actief")?.waarde).toBe(2);
    await db.exec("SET test.role='admin'");
    expect((await grafiek("leads_status", true)).find((p) => p.sleutel === "actief")?.waarde).toBe(3);
  });
  it("bronfunctie is niet rechtstreeks aanroepbaar en anon heeft geen recht", async () => {
    const r = (await db.query<{ a: boolean; b: boolean; c: boolean }>(`SELECT
      has_function_privilege('authenticated','public.admin_grafiek_bron(text,boolean)','EXECUTE') a,
      has_function_privilege('anon','public.admin_grafiek(text,boolean)','EXECUTE') b,
      has_function_privilege('authenticated','public.admin_grafiek_records(text,text,date,date,boolean)','EXECUTE') c`)).rows[0];
    expect(r).toEqual({ a: false, b: false, c: true });
  });
});

describe("hulpfuncties", () => {
  it("ruwe productcode krijgt een nette naam, lange namen blijven volledig", () => {
    expect(productNaam("bav_avb")).toBe("BAV & AVB");
    expect(productNaam("BAV & AVB Maandelijks + Cyber (proef)")).toBe("BAV & AVB Maandelijks + Cyber (proef)");
    expect(productNaam(null)).toBe("Onbekend");
  });
  it("bucketbereik voor dag, week (ma t/m zo) en maand, begrensd op periodestart", () => {
    expect(bucketBereik("2026-10-14", "dag")).toEqual({ van: "2026-10-14", tot: "2026-10-14" });
    expect(bucketBereik("2026-10-14", "week")).toEqual({ van: "2026-10-12", tot: "2026-10-18" });
    expect(bucketBereik("2026-10-05", "week", "2026-10-06")).toEqual({ van: "2026-10-06", tot: "2026-10-11" });
    expect(bucketBereik("2026-12-03", "maand")).toEqual({ van: "2026-12-01", tot: "2026-12-31" });
  });
  it("TS-spiegel: filter en telling geven per element dezelfde lengte", () => {
    const rs = [{ sleutel: "a", dag: "2026-10-01" }, { sleutel: "a", dag: "2026-10-02" }, { sleutel: "b", dag: "2026-10-02" }] as GrafiekRecord[];
    for (const p of telRecords(rs, "leads_status")) expect(filterRecords(rs, { sleutel: p.sleutel })).toHaveLength(p.waarde);
  });
});

describe("grafieken gebruiken de beveiligde functie", () => {
  const charts = readFileSync("src/components/admin/DashboardCharts.tsx", "utf8");
  const kpi = readFileSync("src/components/admin/SupervisorKpiPanel.tsx", "utf8");
  const inzicht = readFileSync("src/pages/admin/Inzicht.tsx", "utf8");
  const lijst = readFileSync("src/components/admin/GrafiekLijst.tsx", "utf8");
  it("dashboardgrafieken lezen geen tabellen rechtstreeks", () => {
    expect(charts).toContain('"admin_grafiek"'); expect(charts).not.toMatch(/\.from\(/);
    expect(kpi).toContain('_grafiek: "activaties_maand"');
    expect(lijst).toContain('"admin_grafiek_records"'); expect(lijst).not.toMatch(/\.from\(/);
  });
  it("elke grafiek opent het zijpaneel", () => {
    for (const g of ["leads_dag", "leads_status", "leads_verzekering"]) expect(charts).toContain(`grafiek: "${g}"`);
    expect(inzicht).toContain('grafiek: "aanvragen"'); expect(inzicht).toContain('"arr_netto"');
    expect(lijst).toContain("Klik voor de lijst");
  });
});

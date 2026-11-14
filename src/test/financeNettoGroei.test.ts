// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { bouwSchermPayload } from "../../supabase/functions/_shared/schermAnonimiseer";

const dir = "drizzle/migrations";
const sql = readFileSync(`${dir}/${readdirSync(dir).find((f) => f.includes("financieel_overzicht_netto_groei"))}`, "utf8");
const groei = sql.slice(sql.indexOf("FUNCTION public.tel_netto_groei"), sql.indexOf("DO $do$"));

describe("exact-finance-sync alleen lezen", () => {
  const fn = readFileSync("supabase/functions/exact-finance-sync/index.ts", "utf8");
  it("alleen GET, met plafond", () => {
    expect(fn).not.toMatch(/method:\s*"(POST|PUT|DELETE|PATCH)"/);
    expect(fn).toContain('method: "GET"');
    expect(fn).toContain("MAX_CALLS");
    for (const e of ["salesinvoice/SalesInvoices", "read/financial/ReceivablesList", "cashflow/Receivables"]) expect(fn).toContain(e);
  });
  it("aansluiting kent alle zeven soorten en is alleen supervisor/admin", () => {
    for (const s of ["planning_niet_in_exact", "exact_niet_in_planning", "bedrag_afwijking", "betaald_niet_afgeletterd", "vervallen_open", "creditnota_zonder_factuur", "relatie_niet_gekoppeld"]) expect(sql).toContain(`'${s}'`);
    expect(sql).toMatch(/finance_aansluiting[\s\S]*is_supervisor_or_admin/);
    expect(sql).not.toMatch(/INSERT INTO public\.(incasso_mislukt|crm_taken)/);
  });
});

describe("netto groei (alleen aantallen)", () => {
  it("tel_netto_groei bevat geen bedragkolommen of namen", () => {
    expect(groei).not.toMatch(/bedrag|naam|amount|korting/i);
  });
  it("dashboard en scherm gebruiken dezelfde functie", () => {
    expect(sql).toContain("pg_get_functiondef('public.dashboard_tellers(boolean)'::regprocedure)");
    expect(sql).toContain("pg_get_functiondef('public.scherm_data()'::regprocedure)");
    expect(sql.match(/public\.tel_netto_groei\(date ''2026-10-06''/g)?.length).toBe(2);
    expect(readFileSync("src/components/admin/DashboardStats.tsx", "utf8")).toContain("netto_groei");
  });
  it("scherm-payload geeft geen euro- of naamvelden voor dit paneel", () => {
    const p = bouwSchermPayload({ netto_groei: { cumulatief: { instroom: 5, beeindigingen: 2, netto_groei: 3, opzegpercentage: 0.3, bedrag: 999, klant: "Geheim BV" },
      weken: [{ instroom: 1, beeindigingen: 0, netto_groei: 1, opzegpercentage: 0, naam: "X" }] } });
    const s = JSON.stringify(p.netto_groei);
    expect(s).not.toMatch(/bedrag|klant|naam|Geheim|€|999/);
    expect(p.netto_groei?.cumulatief).toEqual({ instroom: 5, beeindigingen: 2, netto_groei: 3, opzegpercentage: 0.3 });
  });
  it("/tv heeft geen redirect en het paneel staat in de carrousel", () => {
    const r = readFileSync("public/_redirects", "utf8");
    expect(r).not.toMatch(/^\/tv\b/m);
    const scherm = readFileSync("src/pages/Scherm.tsx", "utf8");
    expect(scherm).toMatch(/const PANELEN = \[[^\]]*PaneelNettoGroei/);
    const paneel = scherm.slice(scherm.indexOf("function PaneelNettoGroei"), scherm.indexOf("function PaneelService"));
    expect(paneel).toContain('data-testid="paneel-netto-groei"');
    expect(paneel).not.toMatch(/euro|€|naam/i);
    const weekomzet = scherm.slice(scherm.indexOf("function Weekomzet"), scherm.indexOf("function runTijd"));
    expect(weekomzet).toContain("euro.format(w.bedrag)");
    expect(weekomzet).toContain("euro.format(w.vorige_bedrag)");
    const buitenWeekomzet = scherm.replace(weekomzet, "");
    expect(buitenWeekomzet).not.toMatch(/euro\.format|€|currency:\s*["'](?!EUR)[A-Z]+["']/);
    const p = bouwSchermPayload({ groei: { klanten: 2, contracten: 3, naam: "Geheim BV", bedrag: 999 }, weekomzet: { bedrag: 123, naam: "Geheim BV", klant: "Klant X" } });
    expect(JSON.stringify([p.groei, p.netto_groei, p.weekomzet])).not.toMatch(/Geheim BV|Klant X|"naam"|"klant"/);
  });
});

describe("A7-aanvulling 2: netto groei vanaf 1 okt", () => {
  const m = readFileSync(`${dir}/${readdirSync(dir).find((f) => f.includes("netto_groei_vanaf_1_okt"))}`, "utf8");
  it("default _vanaf is 2026-10-01 en aanroepen gebruiken de default", () => {
    expect(m).toContain("_vanaf date DEFAULT date '2026-10-01'");
    expect(m).toContain("tel_netto_groei(_toon_test => _toon_test)");
    expect(m).toContain("tel_netto_groei(_toon_test => false)");
    expect(m).toMatch(/GRANT EXECUTE ON FUNCTION public\.tel_netto_groei\(date,boolean\) TO authenticated, service_role/);
    expect(m).not.toMatch(/DELETE|TRUNCATE|DROP/);
  });
  it("startdatum blijft 1 oktober en schermgroei volgt de admin-klanttelling (besluit 13-11 A6)", async () => {
    const c = await import("../lib/nettoGroei");
    expect(c.NETTO_GROEI_VANAF).toBe("2026-10-01");
    expect(c.NETTO_GROEI_LABEL).toBe("Sinds 1 okt (start platform)");
    const scherm = readFileSync("src/pages/Scherm.tsx", "utf8");
    const paneel = scherm.slice(scherm.indexOf("function PaneelNettoGroei"), scherm.indexOf("function PaneelService"));
    expect(paneel).toContain("const g = d.groei;");
    expect(paneel).toContain('blok("Sinds 1 oktober", g.sinds');
    expect(paneel).toContain('blok("Deze week", g.week');
    const telling = readFileSync("drizzle/migrations/0287_een_telling_admin_tv_1311.sql", "utf8");
    expect(telling).toContain("ks jsonb := public.tel_klanten_stand(date '2026-10-01', false)");
    expect(telling).toContain("'klanten', public.tel_klanten(false), 'contracten', public.tel_contracten(false)");
    expect(telling).toContain("public.tel_klanten_stand(_vanaf, _toon_test)");
    expect(readFileSync("src/components/admin/DashboardStats.tsx", "utf8")).toContain("NETTO_GROEI_LABEL");
    expect(bouwSchermPayload({ netto_groei: { cumulatief: { instroom: 1 } } }).netto_groei?.vanaf).toBe("2026-10-01");
    expect(readFileSync("src/pages/Scherm.tsx", "utf8")).not.toContain("Sinds 6 okt");
  });
});

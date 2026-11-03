// @vitest-environment node
// Spoed 3-11: factuurplanner-lus stopt zonder voortgang, max 1 dagstandmail, alarm alleen bij tokenfout.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { moetVervolgPlannen, vervolgMagStarten, magDagstandMailen, startNlDagIso, PLANNER_VERVOLG_MAX_PER_DAG } from "../../supabase/functions/_shared/plannerBatch";
import { isExactTokenFout, buildPlannerFoutMail, buildAlarmMail } from "../../supabase/functions/_shared/exactAlarm";

const basis = { aangemaakt: 0, statussenBijgewerkt: 0, creditsAangemaakt: 0, resterendWerk: true, vervolgRunsVandaag: 0 };

describe("vervolgrun factuurplanner", () => {
  it("plant niet opnieuw zonder voortgang (situatie 3-11: 326 geblokkeerd, 0 verwerkt)", () => {
    expect(moetVervolgPlannen(basis)).toBe(false);
  });
  it("plant wel opnieuw na aangemaakte concepten of bijgewerkte statussen", () => {
    expect(moetVervolgPlannen({ ...basis, aangemaakt: 1 })).toBe(true);
    expect(moetVervolgPlannen({ ...basis, statussenBijgewerkt: 3 })).toBe(true);
  });
  it("stopt als er geen werk meer is", () => {
    expect(moetVervolgPlannen({ ...basis, aangemaakt: 5, resterendWerk: false })).toBe(false);
  });
  it("harde grens van 12 vervolgruns per dag", () => {
    expect(PLANNER_VERVOLG_MAX_PER_DAG).toBe(12);
    expect(moetVervolgPlannen({ ...basis, aangemaakt: 5, vervolgRunsVandaag: 12 })).toBe(false);
    expect(vervolgMagStarten(12, null).ok).toBe(false);
  });
  it("minimaal 15 minuten tussen runs", () => {
    const nu = Date.parse("2026-11-03T07:00:00Z");
    expect(vervolgMagStarten(1, nu - 3 * 60_000, nu).ok).toBe(false);
    expect(vervolgMagStarten(1, nu - 15 * 60_000, nu).ok).toBe(true);
  });
  it("cron-taak draait elke 15 minuten, niet elke 3", () => {
    const sql = readFileSync("drizzle/migrations/0228_factuur_planner_vervolg_15min.sql", "utf8");
    expect(sql).toContain("'*/15 * * * *'");
    expect(sql).not.toContain("*/3");
  });
});

describe("dagstandmail Roxy", () => {
  it("maximaal één per dag, alleen na de laatste run", () => {
    expect(magDagstandMailen(true, false)).toBe(false);
    expect(magDagstandMailen(false, false)).toBe(true);
    expect(magDagstandMailen(false, true)).toBe(false);
  });
  it("dagbegin volgt Nederlandse tijd", () => {
    expect(startNlDagIso("2026-11-03")).toBe("2026-11-02T23:00:00.000Z");
    expect(startNlDagIso("2026-07-01")).toBe("2026-06-30T22:00:00.000Z");
  });
});

describe("alarm alleen bij echte tokenfout", () => {
  it("429 op de statuscontrole (run 06:15 UTC) is geen tokenfout", () => {
    expect(isExactTokenFout(["statuscontrole: statuscontrole HTTP 429"])).toBe(false);
    expect(isExactTokenFout(["POST onzeker HTTP 503"])).toBe(false);
  });
  it("invalid_grant en 401 na refresh zijn tokenfouten", () => {
    expect(isExactTokenFout(["Refresh mislukt (400): invalid_grant"])).toBe(true);
    expect(isExactTokenFout(["Refresh mislukt (401) — verbind Exact opnieuw"])).toBe(true);
    expect(isExactTokenFout(["statuscontrole HTTP 401"])).toBe(true);
  });
  it("plannermelding noemt de echte oorzaak en zegt niet 'koppel opnieuw'", () => {
    const m = buildPlannerFoutMail(["HTTP 400 ongeldige regel"], "factuur-planner");
    expect(m.html).toContain("HTTP 400 ongeldige regel");
    expect(m.subject).not.toMatch(/Exact-koppeling werkt niet/);
    expect(m.html).not.toMatch(/Koppel opnieuw/i);
    expect(buildAlarmMail("x", "y").html).toMatch(/Koppel opnieuw/);
  });
  it("planner gebruikt het tokenalarm alleen via isExactTokenFout en vangt 429 op de statuscontrole als tijdelijk", () => {
    const src = readFileSync("supabase/functions/factuur-planner/index.ts", "utf8");
    expect(src).toContain("if (isExactTokenFout(fouten)) await sendExactAlarm(");
    expect(src).toContain('throw new ExactTijdelijkError(r.status, "statuscontrole")');
    expect(src).not.toMatch(/if \(fouten\.length\) await sendExactAlarm/);
  });
});

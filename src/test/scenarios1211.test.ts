// Scenariotests in TypeScript (besluit Boy 12-11-2026 12:16). Namen gelijk aan test_scenario(); zie docs/scenariotests.md.
// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { maatwerkVlag, heeftMaatwerkVlag, MAATWERK_LABEL } from "@/lib/maatwerk";
import { kiesCreditRoute, ontbrekendCreditMelding } from "../../supabase/functions/_shared/creditOpzegging";
import { factuurLabel } from "@/lib/ingangsdatumWijzigen";
import { datumsFout, datumsMelding } from "../../supabase/functions/_shared/rechtsvormwijziging";

const NU = "2026-11-12T10:00:00Z";

describe("maatwerk_bouw", () => {
  it("vlag en label bij Bouw & techniek", () => {
    const v = maatwerkVlag("Bouw & techniek");
    expect(v).toEqual({ maatwerk_check: true, maatwerk_sectoren: ["Bouw & techniek"] });
    expect(heeftMaatwerkVlag(v)).toBe(true);
    expect(MAATWERK_LABEL).toBe("Maatwerk: contact opnemen");
  });
});
describe("maatwerk_zorg", () => {
  it("vlag bij Zorg", () => expect(heeftMaatwerkVlag(maatwerkVlag("Zorg"))).toBe(true));
});
describe("maatwerk_techniek", () => {
  it("techniek valt onder Bouw & techniek", () => expect(maatwerkVlag("bouw")?.maatwerk_sectoren).toEqual(["Bouw & techniek"]));
});
describe("maatwerk_overig", () => {
  it("geen vlag bij een andere sector", () => {
    expect(maatwerkVlag("ICT")).toBeNull();
    expect(heeftMaatwerkVlag({})).toBe(false);
  });
});
describe("credit_afas_los", () => {
  it("AFAS-credit zonder origineel factuurnummer wordt een losse creditnota", () =>
    expect(kiesCreditRoute({ bron: "oud_systeem", bedrag_handmatig: true, exact_account_id: "acc", _item: "item", origineel_factuurnummer: null })).toEqual({ route: "los" }));
});
describe("credit_ontbreekt_relatie", () => {
  it("ontbrekende relatie blokkeert met één melding, nooit handmatig_afgehandeld", () => {
    const k = kiesCreditRoute({ bron: "correctie", exact_account_id: null, _item: "item" });
    expect(k).toEqual({ route: "ontbreekt", ontbreekt: ["Exact-relatie"] });
    const m = ontbrekendCreditMelding({ creditsleutel: "ZPC-TEST0001" }, ["Exact-relatie"]);
    expect(m.titel).toBe("Creditnota ZPC-TEST0001 kan niet automatisch");
    const planner = readFileSync("supabase/functions/factuur-planner/index.ts", "utf8");
    const blok = planner.slice(planner.indexOf('if (keuze.route === "ontbreekt")'), planner.indexOf('const oud = keuze.route === "oud"'));
    expect(blok).toContain('status: "geblokkeerd"');
    expect(blok).toContain("if (!count)");
    expect(blok).not.toContain("handmatig_afgehandeld");
  });
});
describe("label_nog_niet_gefactureerd", () => {
  it("label tot er echt gefactureerd is", () => {
    expect(factuurLabel({ begin_datum: "2026-12-01", gefactureerd_tm: null }, false)).toBe("Nog niet gefactureerd (start 01-12-2026)");
    expect(factuurLabel({ begin_datum: "2026-12-01", gefactureerd_tm: "2026-12-31" }, true)).toBe("Gefactureerd t/m 31-12-2026");
  });
});
describe("rechtsvorm_gat", () => {
  it("waarschuwing, niet geblokkeerd", () => {
    expect(datumsFout("2026-11-20", "2026-12-01", NU)).toBeNull();
    expect(datumsMelding("2026-11-20", "2026-12-01")?.soort).toBe("gat");
  });
});
describe("scenario-runner", () => {
  it("alleen service_role mag test_scenario uitvoeren", () => {
    const sql = readFileSync("drizzle/migrations/0273_test_scenario_runner_fix.sql", "utf8");
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.test_scenario(text) FROM PUBLIC, anon, authenticated");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.test_scenario(text) TO service_role");
  });
});
describe("testaanvraag_geen_ads_conversie", () => {
  it("Google Ads-conversie alleen voor echte aanvragen", () =>
    expect(readFileSync("src/lib/tracking.ts", "utf8")).toContain('if (!isTest && adsSendTo(GOOGLE_ADS_CONVERSIE.split("/")[1] ?? "") === GOOGLE_ADS_CONVERSIE)'));
  it("polis-lifecycle stuurt testleads geen klantmail", () =>
    expect(readFileSync("supabase/functions/polis-lifecycle/index.ts", "utf8")).toContain('lead.is_test === true && doel === "klant"'));
});

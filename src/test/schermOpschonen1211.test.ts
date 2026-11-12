// @vitest-environment node
// Besluit Boy 12-11-2026 12:29: tv-scherm opschonen.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { berekenWeekomzet, weekomzetWeergave, verschilPct, weekCumulatief, weekStand, maandagVan } from "../../supabase/functions/_shared/weekomzet";
import { isEchteGebeurtenis } from "../../supabase/functions/_shared/schermEcht";
import { schoonGroei, metIntakeAanvragen, korteReden, bouwSchermPayload, ROBOTFUNCTIE } from "../../supabase/functions/_shared/schermAnonimiseer";
import { nettoRegel, aiTeamVolgorde } from "@/components/scherm/schermTeksten";

const sql = readFileSync("drizzle/migrations/0269_scherm_opschonen_1211.sql", "utf8");
// Donderdag 12-11-2026 12:30 Amsterdam (11:30 UTC, wintertijd).
const nu = new Date("2026-11-12T11:30:00Z");

describe("Weekomzet en vergelijking", () => {
  const rij = (moment: string, pakket = "jaarlijks", kanaal = "") => ({ pakket, tarief_type: "standaard", moment, kanaal });
  it("telt maandag 00:00 tot nu en vergelijkt met maandag tot dezelfde weekdag en tijd vorige week", () => {
    const w = berekenWeekomzet([
      rij("2026-11-08T23:00:00Z"), // maandag 9-11 00:00 Amsterdam: deze week
      rij("2026-11-12T11:00:00Z", "maandelijks"), // vandaag 12:00: deze week
      rij("2026-11-08T22:59:00Z"), // zondag 23:59: valt buiten beide perioden
      rij("2026-11-05T11:00:00Z", "jaarlijks", "betaald"), // vorige donderdag 12:00: vorige week
      rij("2026-11-05T11:45:00Z"), // vorige donderdag 12:45: na het tijdstip van nu, telt niet
    ], nu);
    expect(w.week_van).toBe("2026-11-09");
    expect(w.aantal).toBe(2);
    expect(w.vorige_aantal).toBe(1);
    expect(w.via_advertenties).toBe(0);
    expect(w.vorige_via_advertenties).toBe(1);
    expect(w.bedrag).toBeGreaterThan(w.vorige_bedrag);
    expect(w.verschil_pct).toBe(verschilPct(w.bedrag, w.vorige_bedrag));
  });
  it("verschil in procenten, null bij 0 vorige week", () => {
    expect(verschilPct(1500, 1000)).toBe(50);
    expect(verschilPct(500, 1000)).toBe(-50);
    expect(verschilPct(500, 0)).toBeNull();
  });
  it("maandag in zomertijd en na middernacht", () => {
    expect(maandagVan(new Date("2026-03-29T22:30:00Z"))).toBe("2026-03-30");
    expect(maandagVan(new Date("2026-11-15T22:59:00Z"))).toBe("2026-11-09");
    expect(maandagVan(new Date("2026-11-15T23:00:00Z"))).toBe("2026-11-16");
  });
  it("weergave valt terug op 0 in een nieuwe week", () => {
    const w = berekenWeekomzet([rij("2026-11-10T10:00:00Z")], nu);
    expect(weekomzetWeergave(w, nu).aantal).toBe(1);
    expect(weekomzetWeergave(w, new Date("2026-11-15T23:00:30Z"))).toEqual({ bedrag: 0, aantal: 0, vorige_bedrag: 0, verschil_pct: null });
  });
  it("blijft het enige bedrag: SQL gebruikt dezelfde cohort als de dagomzet (is_test en dubbele KvK uitgesloten)", () => {
    const f = sql.slice(sql.indexOf("FUNCTION public.scherm_weekomzet_rijen"));
    expect(f).toContain("tel_aanvraag_cohort_tot(date '2026-10-06'");
    expect(f).toContain("GRANT EXECUTE ON FUNCTION public.scherm_weekomzet_rijen() TO service_role");
  });
});

describe("Zichtbaarheid week op week", () => {
  it("Google Ads klikken uit de cumulatieve stand", () => {
    const reeks = [["2026-11-01", 356], ["2026-11-04", 384], ["2026-11-08", 462], ["2026-11-11", 551]].map(([dag, waarde]) => ({ dag: dag as string, waarde: waarde as number }));
    expect(weekCumulatief(reeks)).toEqual({ deze: 89, vorige: 28 });
  });
  it("momentopname: laatste stand tegen een week eerder", () => {
    expect(weekStand([{ dag: "2026-11-12", waarde: 22.9 }, { dag: "2026-11-05", waarde: 20.9 }])).toEqual({ deze: 22.9, vorige: 20.9 });
  });
});

describe("Alleen echte bedrijfsgebeurtenissen", () => {
  it("aanvraag, certificaat, factuur gemaakt, opzegging en serviceverzoek tellen", () => {
    expect(isEchteGebeurtenis("lead_verzekering_aanvraag", "Nieuwe aanvraag", "klaar")).toBe(true);
    expect(isEchteGebeurtenis("certificaat", "Certificaat verwerkt", "klaar")).toBe(true);
    expect(isEchteGebeurtenis("planner_run", "Factuurplanner draaide: 4 concepten, 13 geblokkeerd", "klaar")).toBe(true);
    expect(isEchteGebeurtenis("contract_status", "Contract opgezegd", "klaar")).toBe(true);
    expect(isEchteGebeurtenis("serviceverzoek", "Serviceverzoek binnen", "klaar")).toBe(true);
  });
  it("sitebezoeken, mails, wijzigingen, Exact, spamfilter, indexnow en agent-runs tellen niet", () => {
    for (const a of ["site_bezoek", "mail", "mail_verzonden", "wijziging", "exact_sync", "spamfilter", "indexnow", "agent_run", "agent_stap", "cron", "kvk_check"]) {
      expect(isEchteGebeurtenis(a, "Platform verbeterd door het team", "klaar")).toBe(false);
    }
    expect(isEchteGebeurtenis("planner_run", "Factuurplanner draaide: 0 concepten, 326 geblokkeerd", "bezig")).toBe(false);
    expect(isEchteGebeurtenis("certificaat", "Certificaat vraagt aandacht", "fout")).toBe(false);
  });
  it("SQL en TypeScript hanteren dezelfde lijst", () => {
    const f = sql.slice(0, sql.indexOf("REVOKE ALL ON FUNCTION public.scherm_echte_gebeurtenis"));
    for (const a of ["lead_verzekering_aanvraag", "certificaat", "serviceverzoek", "planner_run", "contract_status"]) expect(f).toContain(`'${a}'`);
    expect(f).toContain("^Factuurplanner draaide: [1-9][0-9]* concepten");
    expect(sql).toContain("public.scherm_echte_gebeurtenis(m.actie, m.tekst, m.status) AND coalesce(m.afgerond_op, m.created_at) >= v_dagstart");
  });
  it("Aanvraag-intake in de workers-strook telt alleen echte aanvragen", () => {
    const w = { gepland: [], op_afroep: [{ naam: "Aanvraag-intake", ritme: null, laatste: null, status: "klaar" as const, vandaag: 120, week: 721 }] };
    const uit = metIntakeAanvragen(w, { vandaag: 1, week: 9, laatste: "2026-11-12T10:00:00Z" })!;
    expect(uit.op_afroep[0].week).toBe(9);
    expect(uit.op_afroep[0].vandaag).toBe(1);
    expect(sql).toContain("m.actie = 'lead_verzekering_aanvraag' AND m.created_at > now() - interval '7 days'");
  });
});

describe("Klant- en contracttelling", () => {
  const g = { klanten: 861, contracten: 1114, bav_avb: 808, cyber: 76, lidmaatschap: 230, overig: 0,
    sinds: { begin: 834, nieuw: 43, gestopt: 16, nu: 861 }, week: { begin: 856, nieuw: 5, gestopt: 0, nu: 861 } };
  it("begin + nieuw - gestopt = nu = klanten in Groei", () => {
    const uit = schoonGroei(g)!;
    expect(uit.sinds!.netto).toBe(27);
    expect(uit.sinds!.begin + uit.sinds!.nieuw - uit.sinds!.gestopt).toBe(uit.klanten);
    expect(() => schoonGroei({ ...g, sinds: { ...g.sinds, nu: 860 } })).toThrow();
  });
  it("factureerbaar: lopend, ingegaan, niet beëindigd, niet gepauzeerd, geen test, wel een prijs", () => {
    const f = sql.slice(sql.indexOf("FUNCTION public.scherm_factureerbaar_op"), sql.indexOf("REVOKE ALL ON FUNCTION public.scherm_factureerbaar_op"));
    for (const regel of ["c.status IN ('actief', 'loopt_af')", "c.begin_datum <= _d", "c.eind_datum IS NULL OR c.eind_datum >= _d", "coalesce(c.bedrag_per_periode, 0) > 0", "NOT coalesce(c.is_test, false)", "'gepauzeerd'"]) expect(f).toContain(regel);
  });
  it("nettoregel in het gevraagde formaat", () => {
    expect(nettoRegel("Sinds 1 oktober", { nieuw: 47, gestopt: 17, netto: 30 })).toBe("Sinds 1 oktober: +47 nieuw, -17 gestopt = +30 netto");
    expect(nettoRegel("Deze week", { nieuw: 0, gestopt: 2, netto: -2 })).toBe("Deze week: 0 nieuw, -2 gestopt = -2 netto");
  });
});

describe("Mediaan afhandeltijd", () => {
  it("mediaan, verzoeken langer dan 14 dagen niet meegeteld", () => {
    const f = sql.slice(sql.indexOf("'service_afhandeltijd_uur'"));
    expect(f).toContain("percentile_cont(0.5)");
    expect(f).toContain("behandeld_op - created_at <= interval '14 days'");
    expect(bouwSchermPayload({ schoon: { service_afhandeltijd_uur: 30.4 }, service: { afhandeltijd_uur: 144.5 } }).service.afhandeltijd_uur).toBe(30.4);
  });
});

describe("AI-team rustig", () => {
  it("vaste functie van maximaal 4 woorden, fouten bovenaan met korte reden", () => {
    for (const f of Object.values(ROBOTFUNCTIE)) expect(f.split(" ").length).toBeLessThanOrEqual(4);
    expect(aiTeamVolgorde([{ status: "klaar", n: 1 }, { status: "fout", n: 2 }]).map((a) => a.n)).toEqual([2, 1]);
    expect(korteReden("Rapportage-agent: zoekcijfers niet bereikbaar")).toBe("Rapportage-agent");
    expect(korteReden("")).toBe("laatste run mislukt");
  });
});

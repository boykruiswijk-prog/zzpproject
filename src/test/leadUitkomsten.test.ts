import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  LEAD_STATUS_LABELS, LEAD_STATUS_TITELS, LEAD_STATUS_COLORS, LEAD_UITKOMSTEN, AFGESLOTEN_LEAD_STATUSSEN, statusLabel,
} from "@/lib/statusLabels";
import { leadStatusKeuzes, leadStatusOpties } from "@/components/admin/LeadAfronden";
import { filterOpTab } from "@/lib/leadVlag";

const enumSql = readFileSync("drizzle/migrations/0208_lead_status_uitkomsten_enum.sql", "utf8");
const fnSql = readFileSync("drizzle/migrations/0209_lead_status_uitkomsten_functies.sql", "utf8");

describe("A23-aanvulling 3: leaduitkomsten", () => {
  it.each([
    ['verzekering_aanvraag',['nieuw_te_beoordelen','in_behandeling','afgewezen','geen_interesse','vraag_beantwoord']],
    ['offerte-aanvraag',['nieuw','in_behandeling','offerte_verstuurd','klant_geworden','geen_interesse','vraag_beantwoord']],
    ['contact',['nieuw','in_behandeling','klant_geworden','geen_interesse','vraag_beantwoord']],
    ['handmatig',['nieuw','in_behandeling','klant_geworden','geen_interesse','vraag_beantwoord']],
  ])('A23-4 exacte keuzes voor %s', (type, keuzes) => {
    expect(leadStatusOpties({id:'test',type:type as string,status:'nieuw'})).toEqual(keuzes);
  });
  it.each(AFGESLOTEN_LEAD_STATUSSEN)('afgesloten %s zichtbaar in Alle en Toon afgesloten, niet standaard', status => {
    const rows = [{status,vlag:null}];
    expect(filterOpTab(rows,'te_doen','2026-10-29')).toEqual([]);
    expect(filterOpTab(rows,'alle','2026-10-29')).toEqual(rows);
    expect(filterOpTab(rows,'te_doen','2026-10-29',true)).toEqual(rows);
  });
  it.each(['afspraak_gepland','klant','gepauzeerd','afgerond','opgezegd','actief','offerte_verstuurd'])('oude %s zichtbaar maar niet kiesbaar voor contact', status => {
    const lead = {id:'test',type:'contact',status};
    expect(leadStatusKeuzes(lead).map(([s]) => s)).toContain(status);
    expect(leadStatusOpties(lead)).not.toContain(status);
  });
  it("enum krijgt drie waarden erbij en afgerond blijft bestaan", () => {
    for (const v of ["klant_geworden", "geen_interesse", "vraag_beantwoord"]) expect(enumSql).toContain(`ADD VALUE IF NOT EXISTS '${v}'`);
    expect(enumSql).not.toMatch(/DROP|RENAME|UPDATE/i);
    expect(LEAD_STATUS_LABELS.afgerond).toBe("Afgerond (uitkomst onbekend)");
  });
  it("labels, uitleg en kleuren", () => {
    expect(statusLabel("klant_geworden")).toBe("Klant geworden");
    expect(statusLabel("geen_interesse")).toBe("Geen interesse");
    expect(statusLabel("vraag_beantwoord")).toBe("Vraag beantwoord");
    expect(LEAD_STATUS_TITELS.klant_geworden).toBe("Lead is klant geworden; bij een verzekeringsaanvraag loopt dit via activeren (Polis actief)");
    expect(LEAD_STATUS_TITELS.geen_interesse).toBe("Lead heeft afgezien of reageert niet meer");
    expect(LEAD_STATUS_TITELS.vraag_beantwoord).toBe("Contactvraag zonder verkoopkans, vraag is beantwoord");
    expect(LEAD_STATUS_LABELS.actief).toBe("Polis actief");
    expect(LEAD_STATUS_COLORS.klant_geworden).toContain("green");
    expect(LEAD_STATUS_COLORS.geen_interesse).toContain("gray");
    expect(LEAD_STATUS_COLORS.vraag_beantwoord).toContain("slate");
  });
  it("keuzelijst biedt afgerond niet meer aan, wel de drie uitkomsten", () => {
    const k = leadStatusKeuzes({ id: "x", type: "contact", status: "in_behandeling" }).map(([v]) => v);
    expect(k).not.toContain("afgerond");
    for (const u of LEAD_UITKOMSTEN) expect(k).toContain(u);
  });
  it("bestaande afgeronde lead blijft afgerond tonen en kan naar een uitkomst", () => {
    const k = leadStatusKeuzes({ id: "x", type: "contact", status: "afgerond" }).map(([v]) => v);
    expect(k).toContain("afgerond");
    for (const u of LEAD_UITKOMSTEN) expect(k).toContain(u);
  });
  it("aanvraag met polis kan niet worden afgesloten met een uitkomst", () => {
    const k = leadStatusKeuzes({ id: "x", type: "verzekering_aanvraag", status: "actief", geactiveerd_op: "2026-10-01" }).map(([v]) => v);
    for (const u of LEAD_UITKOMSTEN) expect(k).not.toContain(u);
  });
  it("tellers: afgerond blijft overal meetellen, uitkomsten tellen als afgesloten", () => {
    expect(AFGESLOTEN_LEAD_STATUSSEN).toEqual(["afgerond", "klant_geworden", "geen_interesse", "vraag_beantwoord"]);
    expect(fnSql).toContain("''afgerond'',''klant_geworden'',''geen_interesse'',''vraag_beantwoord''");
    expect(fnSql).not.toMatch(/UPDATE public\.leads SET status = 'afgerond'/);
    expect(readFileSync("src/hooks/useLeads.ts", "utf8")).toContain("(afgerond,klant_geworden,geen_interesse,vraag_beantwoord)");
  });
  it("geen wijziging aan activatie: Polis actief is geen uitkomst", () => {
    expect(LEAD_UITKOMSTEN as readonly string[]).not.toContain("actief");
    expect(fnSql).not.toMatch(/geactiveerd_op\s*=/);
  });
});

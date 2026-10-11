// @vitest-environment node
import { describe, it, expect } from "vitest";
import { bouwSchermPayload, schoonTekst, schoonMarketing } from "../../supabase/functions/_shared/schermAnonimiseer";

const ruw = {
  activiteit: [
    { id: "1", station: "intake", tekst: "Nieuwe aanvraag van jan.jansen@voorbeeld.nl, 0612345678", status: "klaar", tijd: "2026-10-11T06:00:00Z" },
    { id: "2", station: "service", tekst: "Jansen Holding B.V. KVK 12345678 NL91ABNA0417164300 1234 AB € 55,00", status: "fout", tijd: "x" },
    { id: "3", station: "onbekend", tekst: "Gewone tekst", status: "raar", tijd: "x", email: "geheim@x.nl", naam: "Piet" },
  ],
  stations: { intake: { vandaag: 3, laatste_status: "klaar", klant: "Piet" } },
  doel: { totaal: 20, resterende_dagen: 82, tempo_14d: 1.5, per_dag: [], per_week: [] },
  klantbasis: { actieve_klanten: 300, omzet: 99999 },
  kennisbank: { laatste: ["Artikel over BTW"] },
  marketing: { google_ads: { dag: "2026-10-10", data: { impressions: 1000, clicks: 50, conversions: 4, cost: 2250, cpa: 99 } } },
};

describe("scherm-data anonimisering", () => {
  const out = JSON.stringify(bouwSchermPayload(ruw));
  it("bevat geen namen, e-mail, telefoon, KVK, IBAN, postcode of bedragen", () => {
    for (const verboden of ["jan.jansen", "@", "0612345678", "12345678", "NL91ABNA", "1234 AB", "€", "Piet", "Holding", "geheim", "99999"]) {
      expect(out).not.toContain(verboden);
    }
  });
  it("maakt ads-budget procentueel en laat kosten per aanvraag weg", () => {
    const m = schoonMarketing(ruw.marketing);
    expect(m.google_ads?.budget_pct).toBeNull();
    expect(schoonMarketing({ google_ads: { data: { cost: 2250, periode: 'maand_tot_datum', budget_scope: 'totaal_advertenties' } } }).google_ads?.budget_pct).toBe(10);
    expect(JSON.stringify(m)).not.toContain("cpa");
    expect(JSON.stringify(m)).not.toContain("2250");
    expect(m.search_console).toBeNull();
  });
  it("berekent tempo en prognose", () => {
    const p = bouwSchermPayload(ruw);
    expect(p.doel.benodigd_per_dag).toBeCloseTo(2.2, 1);
    expect(p.doel.prognose).toBe(143);
    expect(p.activiteit[2].station).toBe("kwaliteit");
  });
  it("schoonTekst kort in tot 90 tekens", () => {
    expect(schoonTekst("a".repeat(200)).length).toBe(90);
  });
  it('toont de echte activiteitstekst, valt alleen terug als de filter iets weghaalt', () => {
    const p = bouwSchermPayload({
      activiteit: [
        { id: 'a', station: 'assistent', tekst: 'Oude assistentgesprekken opgeschoond', tijd: '2026-10-11T05:17:00Z' },
        { id: 'b', station: 'mail', tekst: 'Reviewverzoeken klaargezet', tijd: '2026-10-11T09:15:00Z' },
        { id: 'c', station: 'kwaliteit', tekst: 'Kwaliteitsagent heeft de site en het platform gecontroleerd', tijd: 'x' },
        { id: 'd', station: 'service', tekst: 'Verzoek van piet@x.nl', tijd: 'x' },
      ],
      kennisbank: { laatste: [] },
      processen: [{ station: 'mail', actie: 'Klant Geheim', n: 2 }],
      tijdlijn: [{ station: 'mail', minuut: 300, n: 2, naam: 'Klant Geheim' }, { station: 'intake', minuut: 1600, n: 1 }],
    });
    expect(p.activiteit.map(a => a.tekst)).toEqual([
      'Oude assistentgesprekken opgeschoond', 'Reviewverzoeken klaargezet',
      'Kwaliteitsagent heeft de site en het platform gecontroleerd', 'Serviceverzoek binnen, wordt opgepakt',
    ]);
    expect(JSON.stringify(p)).not.toMatch(/Geheim|piet@/);
    expect(p.tijdlijn).toHaveLength(1);
  });
  it('uses only real BAV lead insertions for breaking moments', () => {
    const p = bouwSchermPayload({ activiteit: [
      { id: 'a', station: 'intake', actie: 'bav_aanmelding', tijd: '2026-10-11T09:00:00Z' },
      { id: 'b', station: 'intake', actie: 'lead_verzekering_aanvraag', tekst: 'Consultant uit Utrecht', tijd: '2026-10-11T09:01:00Z' },
      { id: 'c', station: 'intake', is_test: true },
    ] });
    expect(p.activiteit).toHaveLength(2);
    expect(p.activiteit[0].echte_aanvraag).toBe(false);
    expect(p.activiteit[1]).toMatchObject({ echte_aanvraag: true, beroepsgroep: 'Consultant', provincie: 'Utrecht' });
  });
  it('never fabricates missing funnel counts or exposes spend', () => {
    const p = bouwSchermPayload({ stroom: { gestart: 12, verstuurd: 8, email: 'secret', omzet: 99999 }, marketing: { microsoft_ads: { data: { cost: 2250, budget_pct: 10 } } } });
    expect(p.stroom.sessies).toBeNull();
    expect(p.stroom.actief).toBeNull();
    expect(p.marketing.microsoft_ads?.budget_pct).toBe(10);
    expect(JSON.stringify(p)).not.toMatch(/99999|secret|2250/);
  });
  it('ai_team: lege rij, onbekende status, lange tekst en e-mail', () => {
    expect(bouwSchermPayload({}).ai_team).toEqual([]);
    expect(bouwSchermPayload({ marketing: { ai_team: { dag: '2026-10-11', data: {} } } }).ai_team).toEqual([]);
    const agents = Array.from({ length: 12 }, (_, i) => ({ id: String(i), naam: `Agent ${i}`, taak: 'x'.repeat(100), laatste_run: i ? '2026-10-11T16:53:51Z' : 'nooit', status: i === 1 ? 'raar' : i === 2 ? 'fout' : 'gepland', resultaat: i === 3 ? 'Mail naar jan@voorbeeld.nl gestuurd' : null }));
    const t = bouwSchermPayload({ marketing: { ai_team: { dag: '2026-10-11', data: { agents } } } }).ai_team;
    expect(t).toHaveLength(10);
    expect(t[0].laatste_run).toBeNull();
    expect(t[1].status).toBe('klaar');
    expect(t[2].status).toBe('fout');
    expect(t[1].taak.length).toBe(70);
    expect(t[3].resultaat).not.toContain('@');
    expect(t[3].resultaat).not.toContain('jan');
    expect(t[4].resultaat).toBeNull();
    expect(JSON.stringify(t)).not.toContain('"id"');
  });
  it('kennisbank contenttellingen: null als ze ontbreken', () => {
    expect(bouwSchermPayload({}).kennisbank.content_nieuw).toBeNull();
    expect(bouwSchermPayload({ kennisbank: { content_nieuw: 6, content_verbeterd: 9 } }).kennisbank).toMatchObject({ content_nieuw: 6, content_verbeterd: 9 });
  });
});

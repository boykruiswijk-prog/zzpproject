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
    expect(m.google_ads?.budget_pct).toBe(10);
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
});

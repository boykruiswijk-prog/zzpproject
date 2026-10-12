// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn() } }));
import { bouwSchermPayload, groepeerBezoeken, ACTIES } from "../../supabase/functions/_shared/schermAnonimiseer";
import { categorieVoorPad, isBot } from "@/lib/siteBezoek";
import { toestandLabel } from "@/components/scherm/schermModel";

const nieuweActies = ['formulier_start','formulier_stap','formulier_af','chat_bericht','artikel_verbeterd','indexnow','contract_status','contract_nieuw','portal_uitnodiging','spamfilter','mail_verzonden','dba_check','screening','collectief','site_bezoek'];

describe("live-scherm: nieuwe acties", () => {
  it("laat alle nieuwe acties door de witte lijst", () => {
    for (const a of nieuweActies) expect(ACTIES).toContain(a);
    const p = bouwSchermPayload({ activiteit: nieuweActies.map((actie, i) => ({ id: String(i), station: 'intake', actie, tekst: 'Vaste tekst', tijd: `2026-10-12T10:${String(i).padStart(2, '0')}:00Z` })) });
    expect(p.activiteit.map(a => a.actie)).toEqual(nieuweActies);
    expect(bouwSchermPayload({ activiteit: [{ id: 'x', station: 'intake', actie: 'iets_geheims', tekst: 'a' }] }).activiteit[0].actie).toBe('overig');
  });
  it("privacyfilter: vrije klanttekst in een nieuwe actie wordt neutraal", () => {
    const p = bouwSchermPayload({ activiteit: [
      { id: '1', station: 'mail', actie: 'mail_verzonden', tekst: 'Mail naar piet@bedrijf.nl', tijd: '2026-10-12T10:00:00Z' },
      { id: '2', station: 'acceptatie', actie: 'dba_check', tekst: 'Jansen Holding B.V. KVK 12345678', tijd: '2026-10-12T10:01:00Z' },
      { id: '3', station: 'facturatie', actie: 'contract_status', tekst: 'Contract € 55,00 NL91ABNA0417164300', tijd: '2026-10-12T10:02:00Z' },
      { id: '4', station: 'kennisbank', actie: 'artikel_verbeterd', tekst: 'Kennisbankartikel bijgewerkt: BTW voor zzp', tijd: '2026-10-12T10:03:00Z' },
    ] });
    expect(JSON.stringify(p)).not.toMatch(/piet|@|Jansen|12345678|€|NL91/);
    expect(p.activiteit[3].tekst).toBe('Kennisbankartikel bijgewerkt: BTW voor zzp');
  });
  it("groepeert opeenvolgende identieke sitebezoeken binnen 1 minuut", () => {
    const b = (id: string, tijd: string, tekst = 'Bezoeker leest een kennisbankartikel') => ({ id, actie: 'site_bezoek', tekst, tijd });
    const g = groepeerBezoeken([
      b('1', '2026-10-12T10:00:50Z'), b('2', '2026-10-12T10:00:30Z'), b('3', '2026-10-12T10:00:00Z'),
      b('4', '2026-10-12T09:50:00Z'),
      b('5', '2026-10-12T09:49:50Z', 'Bezoeker bekijkt de homepage'),
      { id: '6', actie: 'cron', tekst: 'Mailwachtrij verwerkt', tijd: '2026-10-12T09:49:45Z' },
    ]);
    expect(g.map(x => x.tekst)).toEqual(['3 bezoekers lezen een kennisbankartikel', 'Bezoeker leest een kennisbankartikel', 'Bezoeker bekijkt de homepage', 'Mailwachtrij verwerkt']);
    expect(g[0].aantal).toBe(3);
  });
  it("nu op de site en lopende agenttimer", () => {
    const p = bouwSchermPayload({ nu_op_site: 4, werkstand: { kwaliteit: { lopend: true, agent_bezig_sinds: '2026-10-12T10:00:00Z', lopende_tekst: 'Controle' } } }, new Date('2026-10-12T10:03:30Z'));
    expect(p.nu_op_site).toBe(4);
    expect(bouwSchermPayload({}).nu_op_site).toBeNull();
    expect(toestandLabel(p.stations.kwaliteit, Date.parse('2026-10-12T10:03:30Z'))).toBe('aan het werk: bezig sinds 3 min');
    expect(p.stations.intake.agent_bezig_sinds).toBeNull();
  });
});

describe("anonieme sitebezoeken", () => {
  it("koppelt paden aan vaste categorieen", () => {
    expect(categorieVoorPad('/')).toBe('home');
    expect(categorieVoorPad('/en')).toBe('home');
    expect(categorieVoorPad('/verzekeringen')).toBe('verzekeringen');
    expect(categorieVoorPad('/offerte')).toBe('offerte');
    expect(categorieVoorPad('/starters')).toBe('starters');
    expect(categorieVoorPad('/zzp-verzekering-ict')).toBe('beroep');
    expect(categorieVoorPad('/kennisbank/btw-zzp')).toBe('kennisbank');
    expect(categorieVoorPad('/kennisbank/belastingen')).toBeNull();
    expect(categorieVoorPad('/collectieve-inkoop')).toBe('collectief');
    expect(categorieVoorPad('/contact')).toBe('contact');
  });
  it("telt nooit beheer, scherm of portaal", () => {
    for (const p of ['/admin', '/admin/leads', '/tv', '/scherm', '/portal', '/portal/login', '/mijn-zp/polis', '/onbekend']) expect(categorieVoorPad(p)).toBeNull();
  });
  it("herkent bots en headless browsers", () => {
    expect(isBot({ webdriver: true, userAgent: 'Mozilla/5.0' })).toBe(true);
    expect(isBot({ webdriver: false, userAgent: 'Googlebot/2.1' })).toBe(true);
    expect(isBot({ webdriver: false, userAgent: 'HeadlessChrome/120' })).toBe(true);
    expect(isBot({ webdriver: false, userAgent: 'Chrome-Lighthouse' })).toBe(true);
    expect(isBot({ webdriver: false, userAgent: 'Mozilla/5.0 (Macintosh) Safari/605' })).toBe(false);
  });
});

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { AI_TEAM, ROBOTNAMEN, bouwSchermPayload } from '../../supabase/functions/_shared/schermAnonimiseer';

const verwacht = { ads: 'Turbo', conversies: 'Echo', kwaliteit: 'Loep', content: 'Pen', markt: 'Radar', rapportage: 'Teller',
  beveiliging: 'Slot', scherm: 'Pixel', dagstatus: 'Kompas', botcoach: 'Coach', concurrentie: 'Scout', updates: 'Patch' };

describe('A29 robotnamen op /tv', () => {
  it('mapping is compleet voor alle 12 ids', () => {
    expect(ROBOTNAMEN).toMatchObject(verwacht);
    expect(AI_TEAM).toHaveLength(16);
    for (const a of AI_TEAM) expect(ROBOTNAMEN[a.id]).toBeTruthy();
  });
  it('naam komt altijd uit de mapping, ook als de feed iets anders stuurt; aanbevelingen gefilterd', () => {
    const agents = [
      { id: 'ads', naam: 'Iets anders', robotnaam: 'Fout', status: 'klaar', laatste_run: '2026-11-05T05:00:00Z' },
      { id: 'aanbevelingen', naam: 'Aanbevelingencontrole', status: 'klaar', laatste_run: '2026-11-05T05:00:00Z' },
      { naam: 'Aanbevelingencontrole Google Ads (maandag)', status: 'klaar' },
      { id: 'onbekend', naam: 'Nieuwe functie', taak: 'x', status: 'klaar' },
    ];
    const t = bouwSchermPayload({ marketing: { ai_team: { dag: '2026-11-05', data: { agents } } } }).ai_team;
    expect(t).toHaveLength(17);
    expect(t[0]).toMatchObject({ robotnaam: 'Turbo', naam: 'Ads-bewaking' });
    expect(t.some(a => /aanbeveling/i.test(a.naam))).toBe(false);
    expect(t[16]).toMatchObject({ robotnaam: null, naam: 'Nieuwe functie' });
  });
  it('botcoach staat erin en krijgt status uit machine_activiteit', () => {
    const zonder = bouwSchermPayload({ marketing: { ai_team: { dag: '2026-11-05', data: { agents: [] } } } }).ai_team;
    expect(zonder.find(a => a.robotnaam === 'Coach')).toMatchObject({ naam: 'Botcoach', taak: 'Daagt elke ochtend alle robots uit', status: 'gepland' });
    const met = bouwSchermPayload({ marketing: { ai_team: { dag: '2026-11-05', data: { agents: [] } } },
      versheid: { agent_laatst: [{ sleutel: 'botcoach beoordeelt de ai-agents', tijd: '2026-11-05T10:23:00Z' }] } }).ai_team;
    expect(met.find(a => a.robotnaam === 'Coach')).toMatchObject({ status: 'klaar', laatste_run: '2026-11-05T10:23:00.000Z' });
  });
  it('geen mensennamen in de namen', () => {
    const mensen = /\b(Ellen|Boy|Roxy|Martijn|Baars|Kruiswijk)\b/;
    for (const a of AI_TEAM) expect(`${ROBOTNAMEN[a.id]} ${a.naam} ${a.taak}`).not.toMatch(mensen);
  });
  it('scherm toont robotnaam groot met functie klein eronder', () => {
    const src = readFileSync('src/pages/Scherm.tsx', 'utf8');
    const p = src.slice(src.indexOf('function PaneelAiTeam'), src.indexOf('const workerKleur'));
    expect(p).toContain('a.robotnaam ?');
    expect(p.indexOf('>{a.robotnaam}<')).toBeLessThan(p.indexOf('>{a.naam}<'));
  });
});

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { bouwSchermPayload } from '../../supabase/functions/_shared/schermAnonimiseer';

const ids = ['ads','conversies','kwaliteit','content','markt','rapportage','beveiliging','scherm','dagstatus','aanbevelingen','concurrentie','updates'];
const voorbeeld = ids.map((id, i) => ({ id, naam: `Agent ${id}`, taak: `taak ${id}`, status: 'klaar', resultaat: `resultaat ${i}`, laatste_run: '2026-11-05T05:00:00Z' }));

describe('AI-team met 12 agents op /tv', () => {
  it('toont alle 12 agents in de opgegeven volgorde, met de nieuwe namen en taken', () => {
    const t = bouwSchermPayload({ marketing: { ai_team: { dag: '2026-11-05', data: { agents: voorbeeld } } } }).ai_team;
    expect(t).toHaveLength(12);
    expect(t[10]).toMatchObject({ naam: 'Concurrentiemonitor', taak: 'Scant dagelijks de markt en de concurrentie', status: 'klaar' });
    expect(t[11]).toMatchObject({ naam: 'Updatebewaker', taak: 'Houdt alle software dagelijks up-to-date', status: 'klaar' });
  });
  it('kapt niet af bij 10 of 12: onbekende extra agents komen er ook bij', () => {
    const extra = [...voorbeeld, { id: 'nieuw1', naam: 'Nieuwe agent', taak: 'iets', status: 'klaar', laatste_run: '2026-11-05T05:00:00Z' }];
    const t = bouwSchermPayload({ marketing: { ai_team: { dag: '2026-11-05', data: { agents: extra } } } }).ai_team;
    expect(t).toHaveLength(13);
    expect(t[12].naam).toBe('Nieuwe agent');
  });
  it('schermweergave heeft geen vaste limiet of teller van 10 en kleurt per status, niet per id', () => {
    const src = readFileSync('src/pages/Scherm.tsx', 'utf8');
    const paneel = src.slice(src.indexOf('function PaneelAiTeam'), src.indexOf('const workerKleur'));
    expect(paneel).not.toMatch(/slice\(0,\s*10\)/);
    expect(paneel).not.toMatch(/van 10/);
    expect(paneel).toContain('team.map(');
    expect(paneel).not.toMatch(/a\.id/);
  });
});

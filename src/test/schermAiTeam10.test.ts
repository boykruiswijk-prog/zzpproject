import { describe, it, expect } from 'vitest';
import { AI_TEAM, koppelTaak, bouwSchermPayload } from '../../supabase/functions/_shared/schermAnonimiseer';

describe('vaste lijst AI-team', () => {
  it('heeft precies deze 10 ids', () => {
    expect(AI_TEAM.map(a => a.id)).toEqual(['ads','conversies','kwaliteit','content','markt','rapportage','beveiliging','scherm','dagstatus','aanbevelingen']);
  });
  it('koppelt aanbevelingen en dagstatus vóór de Ads-regel', () => {
    expect(koppelTaak('Aanbevelingencontrole Google Ads (maandag)')).toBe('aanbevelingen');
    expect(koppelTaak('Dagstatus ZP Zaken 08:12')).toBe('dagstatus');
    expect(koppelTaak('Google Ads bewaking')).toBe('ads');
  });
  it('toont nieuwe agents zonder run als gepland en telt 2 extra geplande workers', () => {
    const p = bouwSchermPayload({ workers: { gepland: Array.from({ length: 9 }, (_, i) => ({ naam: `Taak ${i}`, status: 'klaar' })) },
      marketing: { ai_team: { dag: '2026-10-12', data: { agents: [{ id: 'ads', naam: 'Ads-bewaking', status: 'klaar', laatste_run: '2026-10-12T05:00:00Z' }] } } } });
    expect(p.ai_team).toHaveLength(10);
    expect(p.ai_team[0].status).toBe('klaar');
    expect(p.ai_team.find(a => a.naam === 'Dagstatus')?.status).toBe('gepland');
    expect(p.ai_team.find(a => a.naam === 'Aanbevelingencontrole')?.status).toBe('gepland');
    expect(p.workers?.gepland).toHaveLength(11);
  });
});

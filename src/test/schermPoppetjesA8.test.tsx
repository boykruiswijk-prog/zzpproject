// A8-correctie 2 'Teamfoto': 16 grote figuren, naam als echte tekst op het shirt, functie en resultaat eronder.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { render } from '@testing-library/react';
import { AI_TEAM, ROBOTNAMEN, bouwSchermPayload } from '../../supabase/functions/_shared/schermAnonimiseer';
import MachineScene, { TEAM_GROEPEN, TEAM_RIJEN, MACHINE_AFDELINGEN, resultaatKort } from '@/components/scherm/MachineScene';

const agents = AI_TEAM.map(a => ({ id: a.id, resultaat: `Resultaat ${a.id} van jan@voorbeeld.nl 0612345678 NL91ABNA0417164300 € 55,00 extra lange tekst`, status: 'klaar', laatste_run: '2026-11-05T08:00:00Z' }));
const team = bouwSchermPayload({ marketing: { ai_team: { dag: '2026-11-05', data: { agents } } } }).ai_team;

describe('A8-correctie 2 teamfoto', () => {
  it('16 figuren, elk met naam op het shirt (echte tekst), functie en resultaat', () => {
    const { container } = render(<MachineScene stations={{}} totaalVandaag={3} kennisregels={5} pulsen={[]} focus={null} actief robots={team} />);
    const figuren = [...container.querySelectorAll('[data-robot]')];
    expect(figuren).toHaveLength(16);
    expect(figuren.map(f => f.getAttribute('data-robot')).sort()).toEqual(Object.values(ROBOTNAMEN).sort());
    for (const f of figuren) {
      const naam = f.getAttribute('data-robot')!;
      expect(f.querySelector('svg text[data-testid="shirt-naam"]')?.textContent).toBe(naam);
      expect(f.querySelector('.poppetje-functie')?.textContent).toBeTruthy();
      expect(f.querySelector('[data-testid="poppetje-resultaat"]')?.textContent).toBeTruthy();
    }
  });
  it('groepen met eigen shirtkleur, twee rijen van acht', () => {
    expect(TEAM_GROEPEN.flatMap(g => g.robots).sort()).toEqual(Object.values(ROBOTNAMEN).sort());
    expect(TEAM_GROEPEN.find(g => g.id === 'regie')!.robots).toEqual(['Coach', 'Kompas', 'Teller']);
    for (const rij of TEAM_RIJEN) expect(rij.reduce((n, id) => n + TEAM_GROEPEN.find(g => g.id === id)!.robots.length, 0)).toBe(8);
    const css = readFileSync('src/index.css', 'utf8');
    for (const g of TEAM_GROEPEN) expect(css).toContain(`--s-team-${g.id}:`);
  });
  it('resultaat zonder persoonsgegevens of bedragen, ingekort op twee regels', () => {
    const json = JSON.stringify(team);
    for (const v of ['jan@', '@', '0612345678', 'NL91', '€']) expect(json).not.toContain(v);
    const k = resultaatKort('a'.repeat(120));
    expect(k).toHaveLength(90); expect(k.endsWith('\u2026')).toBe(true);
    expect(resultaatKort('kort')).toBe('kort');
  });
  it('machine-afdelingen en brein in een smalle strook, Microsoft Ads niet meer op het scherm', () => {
    expect([...MACHINE_AFDELINGEN]).toEqual(['intake', 'acceptatie', 'certificaten', 'facturatie', 'exact', 'assistent', 'mail', 'service']);
    const { container } = render(<MachineScene stations={{}} totaalVandaag={3} kennisregels={5} pulsen={[]} focus={null} actief robots={team} />);
    expect(container.querySelectorAll('[data-testid="scene-labels"] [data-station]')).toHaveLength(8);
    expect(container.querySelector('[data-hoek="brein"]')?.textContent).toContain('3 vandaag');
    expect(readFileSync('src/pages/Scherm.tsx', 'utf8')).not.toContain('naam="Microsoft Ads"');
  });
});

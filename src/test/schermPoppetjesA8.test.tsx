// A8-correctie 'Scherm werktuin': poppetjes zijn het hoofdbeeld, elk met naam, functie en resultaat.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { AI_TEAM, ROBOTNAMEN, WERKPLEK, bouwSchermPayload } from '../../supabase/functions/_shared/schermAnonimiseer';
import { POPPETJE_PLEK, AFDELING_TAG, MACHINE_AFDELINGEN, resultaatKort } from '@/components/scherm/MachineScene';

const agents = AI_TEAM.map(a => ({ id: a.id, resultaat: `Resultaat ${a.id} van jan@voorbeeld.nl 0612345678 NL91ABNA0417164300 € 55,00 extra lange tekst`, status: 'klaar', laatste_run: '2026-11-05T08:00:00Z' }));
const team = bouwSchermPayload({ marketing: { ai_team: { dag: '2026-11-05', data: { agents } } } }).ai_team;

describe('A8-correctie poppetjes', () => {
  it('16 poppetjes, elk een vaste plek, naam, functie en resultaat', () => {
    const vast = team.filter(r => r.robotnaam);
    expect(vast).toHaveLength(16);
    expect(Object.keys(POPPETJE_PLEK).sort()).toEqual(Object.values(ROBOTNAMEN).sort());
    for (const r of vast) { expect(POPPETJE_PLEK[r.robotnaam!]).toBeDefined(); expect(r.naam).toBeTruthy(); expect(r.resultaat).toBeTruthy(); }
    expect(new Set(Object.values(POPPETJE_PLEK).map(p => p.join(','))).size).toBe(16);
  });
  it('resultaat zonder persoonsgegevens of bedragen, ingekort op 40 tekens met ellips', () => {
    const json = JSON.stringify(team);
    for (const v of ['jan@', '@', '0612345678', 'NL91', '€']) expect(json).not.toContain(v);
    const k = resultaatKort('a'.repeat(60));
    expect(k).toHaveLength(40); expect(k.endsWith('\u2026')).toBe(true);
    expect(resultaatKort('kort')).toBe('kort');
  });
  it('groepering per afdeling zoals besloten; machine-afdelingen als klein label', () => {
    expect(AFDELING_TAG.intake.robot).toBe('Echo'); expect(WERKPLEK.opvolger).toBe('intake');
    expect(AFDELING_TAG.onderhoud.robot).toBe('Slot'); expect(AFDELING_TAG.markt.robot).toBe('Radar');
    expect([...MACHINE_AFDELINGEN].sort()).toEqual(['acceptatie', 'assistent', 'certificaten', 'exact', 'facturatie', 'mail', 'service']);
    const src = readFileSync('src/components/scherm/MachineScene.tsx', 'utf8');
    expect(src).not.toContain('werktuin-rooster');
    expect(src).toContain('data-robot={r.robotnaam}');
  });
});

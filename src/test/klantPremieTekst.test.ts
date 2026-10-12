import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { starterPremieKlanttekst, klantVeiligeTekst } from '../../supabase/functions/_shared/premieTekst';

describe('premietekst klantbevestiging', () => {
  it('klanttekst bevat geen interne controle', () => {
    const t = starterPremieKlanttekst(495, 600, '2027-10-11');
    expect(t).toBe('€495 per jaar startertarief tot en met 11-10-2027, daarna €600 per jaar');
    expect(t).not.toMatch(/controleren/i);
  });
  it('vangnet haalt interne opmerking na puntkomma weg', () => {
    const oud = '€495 startertarief t/m 2027-10-11, daarna €600; KVK-startdatum 2026-10-12 controleren';
    expect(klantVeiligeTekst(oud)).toBe('€495 startertarief t/m 2027-10-11, daarna €600');
    expect(klantVeiligeTekst('a; intern: x; b')).toBe('a; b');
  });
  it('klantmail gebruikt vangnet, interne mail houdt Controle', () => {
    const nl = readFileSync('supabase/functions/send-lead-notification/index.ts', 'utf8');
    expect(nl.match(/klantVeiligeTekst\(/g)?.length).toBe(2);
    expect(nl).toMatch(/"premie", "dekking", "controle"/);
    expect(nl).not.toMatch(/SHOW_KEYS[^\n]*"controle"/);
    const wiz = readFileSync('supabase/functions/process-bav-wizard/index.ts', 'utf8');
    expect(wiz).toMatch(/controle: `KVK-startdatum \$\{formatDateNL\(kvkStart\)\} controleren`/);
    expect(wiz).not.toMatch(/premie:[^\n]*controleren/);
  });
});

// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { starterPremieKlanttekst, klantVeiligeTekst } from '../../supabase/functions/_shared/premieTekst';
import { aanvraagPremie } from '../../supabase/functions/_shared/cyber';

describe('premietekst klantbevestiging', () => {
  it('klanttekst bevat geen interne controle', () => {
    const t = starterPremieKlanttekst(495, 600, '2027-10-11', 'jaarlijks');
    expect(t).toBe('€495 per jaar startertarief tot en met 11-10-2027, daarna €600 per jaar');
    expect(t).not.toMatch(/controleren/i);
  });
  it.each([
    ['maandelijks', '€45 per maand startertarief tot en met 14-10-2027, daarna €55 per maand'],
    ['jaarlijks', '€495 per jaar startertarief tot en met 14-10-2027, daarna €600 per jaar'],
    ['maandelijks-cyber', '€72,50 per maand startertarief tot en met 14-10-2027, daarna €82,50 per maand'],
    ['jaarlijks-cyber', '€745 per jaar startertarief tot en met 14-10-2027, daarna €850 per jaar'],
  ])('gebruikt de juiste betaalperiode voor %s', (pakketId, verwacht) => {
    const starter = aanvraagPremie(pakketId, true);
    const standaard = aanvraagPremie(pakketId, false);
    expect(starterPremieKlanttekst(starter.totaal, standaard.totaal, '2027-10-14', starter.maand ? 'maandelijks' : 'jaarlijks')).toBe(verwacht);
  });
  it('behoudt de tekst zonder einddatum', () => {
    expect(starterPremieKlanttekst(45, 55, null, 'maandelijks')).toBe('€45 per maand startertarief, daarna €55 per maand');
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
    expect(wiz).toContain('starterPremieKlanttekst(premium, pakket.prijs, starterTotDatum, pakket.betaalwijze)');
    expect(wiz).toMatch(/controle: `KVK-startdatum \$\{formatDateNL\(kvkStart\)\} controleren`/);
    expect(wiz).not.toMatch(/premie:[^\n]*controleren/);
  });
});

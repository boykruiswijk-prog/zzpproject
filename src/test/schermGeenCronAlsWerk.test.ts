import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { anonimiseer } from '../../supabase/functions/_shared/schermAnonimiseer';

describe('scherm telt controlerondes niet als werk', () => {
  it('privacyfilter laat cron-processen weg', () => {
    const p = anonimiseer({ processen: [{ station: 'mail', actie: 'cron', status: 'ok', n: 97 }, { station: 'mail', actie: 'mail', status: 'ok', n: 23 }] } as never);
    expect(p.processen.reduce((n, e) => n + e.n, 0)).toBe(23);
  });
  it('migratie sluit cron uit bij stations en processen', () => {
    const m = readFileSync('drizzle/migrations/0118_scherm_tellers_zonder_cron.sql', 'utf8');
    expect(m).toContain("m.actie IS DISTINCT FROM ''cron''");
    expect(m).toContain("actie IS DISTINCT FROM ''cron'' AND (created_at");
  });
});

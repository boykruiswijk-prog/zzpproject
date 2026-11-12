import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Besluit Boy 12-11-2026 13:53 (vervangt A7): Klant = actief + factuur via lead of factuurplanner op het contract, niet gecrediteerd bij opzegging.
const dir = join(process.cwd(), 'drizzle/migrations');
const laatste = readdirSync(dir).filter(f => f.endsWith('.sql')).sort()
  .filter(f => /FUNCTION public\.scherm_stromen\(\)/.test(readFileSync(join(dir, f), 'utf8'))).pop()!;
const sql = readFileSync(join(dir, laatste), 'utf8').replace(/\s+/g, ' ');

describe('scherm_stromen klant-definitie (12-11 13:53)', () => {
  it('telt facturen via lead en via de factuurplanner op het contract', () => {
    expect(sql).toContain("a.exact_invoice_id IS NOT NULL AND a.exact_invoice_verwijderd_op IS NULL");
    expect(sql).toContain("f.klant_contract_id = ANY(a.contracten) AND f.status NOT IN ('geannuleerd','fout','vervangen')");
    expect(sql).toContain("WHEN r.gefactureerd AND NOT r.gecrediteerd THEN 'klant'");
  });
  it('koppelt lead aan contract via polis, gekoppelde klant of afleiding', () => {
    expect(sql).toContain('public.policy_onderneming_afleiden(c.id)');
    expect(sql).toContain("kc.product='bav_avb'");
  });
  it('niet-gestarte polissen apart en sluitende opbouw', () => {
    expect(sql).toContain("WHEN r.start > (now() AT TIME ZONE 'Europe/Amsterdam')::date THEN 'nog_niet_gestart'");
    expect(sql).toContain("'actief',(SELECT count(*) FROM reis_s)");
    expect(sql).toContain("'nog_niet_gefactureerd',(SELECT count(*) FROM reis_s WHERE stand NOT IN ('klant','nog_niet_gestart'))");
  });
  it('aanvraag tot polis: mediaan, laatste 30 dagen, geen test', () => {
    expect(sql).toContain("l.geactiveerd_op >= now() - interval '30 days'");
    expect(sql).toContain("NOT coalesce(l.is_test,false) AND l.geactiveerd_op IS NOT NULL");
  });
});

import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Register A7: stap Klant in de stroom = actief + Exact-factuur, niet verwijderd, niet gecrediteerd bij opzegging.
const dir = join(process.cwd(), 'drizzle/migrations');
const laatste = readdirSync(dir).filter(f => f.endsWith('.sql')).sort()
  .filter(f => /FUNCTION public\.scherm_stromen\(\)/.test(readFileSync(join(dir, f), 'utf8'))).pop()!;
const sql = readFileSync(join(dir, laatste), 'utf8').replace(/\s+/g, ' ');
const klant = sql.slice(sql.indexOf("'klant',"), sql.indexOf("'tijdlijn'"));

describe('scherm_stromen klant-definitie (A7)', () => {
  it('laatste definitie gebruikt de A7-voorwaarden', () => {
    expect(klant).toContain("geactiveerd_op IS NOT NULL OR status::text IN ('actief','klant')");
    expect(klant).toContain('exact_invoice_id IS NOT NULL');
    expect(klant).toContain('exact_invoice_verwijderd_op IS NULL');
    expect(klant).toContain('exact_credit_invoice_id_opzeg IS NULL');
  });
  it('telt niet meer op converted_at of alleen status klant', () => {
    expect(klant).not.toContain('converted_at');
    expect(klant).not.toMatch(/status::text\s*=\s*'klant'/);
  });
});

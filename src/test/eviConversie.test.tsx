// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { EVI_PAGINA_PUBLIEK, EVI_PAGINA_PAD } from '../config/eviPagina';
import { zetEviJaarruimte, dagenTotEindeJaar } from '../lib/eviJaarruimte';
import { berekenJaarruimte } from '../lib/pensioenRekenhulp';

const verzonden: any[] = [];
vi.mock('@/lib/antiSpam', () => ({
  useFormGuard: () => ({ honeypotProps: {} }),
  submitPublicForm: vi.fn(async (tabel: string, rij: any) => { verzonden.push({ tabel, rij }); return { id: rij.id }; }),
  PublicFormError: class extends Error {},
}));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: vi.fn(() => Promise.resolve({})) } } }));
const track = vi.fn();
vi.mock('@/lib/tracking', () => ({ trackEviInteresseVerstuurd: () => track() }));
import { EviInteresseFormulier } from '../components/pensioen/EviInteresseFormulier';

describe('Evi-pagina blijft verborgen', () => {
  it('vlag staat uit', () => expect(EVI_PAGINA_PUBLIEK).toBe(false));
  it('niet in sitemap of llms', () => {
    for (const p of ['public/sitemap.xml', 'public/llms.txt', 'public/llms-full.txt']) expect(fs.readFileSync(p, 'utf8')).not.toContain(EVI_PAGINA_PAD);
  });
});

describe('deadline', () => {
  it('telt kalenderdagen tot 31 december in NL-tijd', () => {
    expect(dagenTotEindeJaar(new Date('2026-10-19T10:00:00Z'))).toBe(73);
    expect(dagenTotEindeJaar(new Date('2026-12-31T22:30:00Z'))).toBe(0);
    expect(dagenTotEindeJaar(new Date('2027-01-05T10:00:00Z'))).toBe(0);
  });
});

describe('rekenhulp naar formulier (droog, geen mail)', () => {
  beforeEach(() => { verzonden.length = 0; sessionStorage.clear(); track.mockClear(); });
  it('berekend bedrag komt in het veld en in de opgeslagen aanvraag', async () => {
    render(<EviInteresseFormulier />);
    const bedrag = berekenJaarruimte({ winst: 60000 }).jaarruimte;
    expect(bedrag).toBe(12248);
    act(() => zetEviJaarruimte(bedrag));
    expect((screen.getByLabelText(/Je jaarruimte 2026/) as HTMLInputElement).value).toBe('12248');
    fireEvent.change(screen.getByLabelText('Voornaam *'), { target: { value: 'Test' } });
    fireEvent.change(screen.getByLabelText('Achternaam *'), { target: { value: 'Persoon' } });
    fireEvent.change(screen.getByLabelText('E-mail *'), { target: { value: 'test@zpzaken.nl' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /Stuur mij informatie over Evi/ }));
    await waitFor(() => expect(verzonden).toHaveLength(1));
    const rij = verzonden[0].rij;
    expect(verzonden[0].tabel).toBe('leads');
    expect(rij.extra_data.formulier_naam).toBe('Interesse pensioen via Evi');
    expect(rij.extra_data.jaarruimte_berekend).toBe(12248);
    expect(rij.telefoon).toBeUndefined();
    expect(JSON.stringify(rij.extra_data.formulier)).toContain('Berekende jaarruimte 2026');
    await screen.findByText('Wat gebeurt er nu?');
    expect(track).toHaveBeenCalledTimes(1);
  });
});

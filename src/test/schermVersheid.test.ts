import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { bouwSchermPayload, markeerVerouderd, agentLaatst, STATIONS } from '../../supabase/functions/_shared/schermAnonimiseer';
import { buildKenmerk, nieuweVersieBeschikbaar, startVersieControle, VERSIE_INTERVAL_MS } from '@/lib/versieControle';

describe('scherm-payload bevat alle velden die de pagina gebruikt', () => {
  const p = bouwSchermPayload({});
  it('topvelden', () => {
    for (const k of ['gegenereerd_op', 'verouderd_sinds', 'bijgewerkt', 'activiteit', 'nu_op_site', 'stroom', 'tijdlijn', 'processen', 'stations',
      'gebeurtenissen_vandaag', 'doel', 'klantbasis', 'service', 'gezondheid', 'kennisbank', 'ai_team', 'workers', 'marketing']) expect(p).toHaveProperty(k);
  });
  it('stationvelden incl. duur_vandaag_min', () => {
    for (const s of STATIONS) for (const k of ['vandaag', 'toestand', 'laatst_actief_op', 'lopende_tekst', 'duur_vandaag_min']) expect(p.stations[s]).toHaveProperty(k);
  });
  it('elk veld dat Scherm.tsx leest bestaat in de payload', () => {
    const bron = readFileSync('src/pages/Scherm.tsx', 'utf8');
    const velden = new Set([...bron.matchAll(/\b(?:data|d)\.([a-z_]+)/g)].map(m => m[1]).filter(v => !['map', 'filter', 'length', 'n', 'dag', 'maand', 'session'].includes(v)));
    for (const v of velden) expect(p, v).toHaveProperty(v);
  });
  it('nu_op_site zonder bron is null (wordt gemeten), geen nep-0', () => {
    expect(p.nu_op_site).toBeNull();
    expect(p.marketing.microsoft_ads).toBeNull();
  });
  it('werkstand wint van scherm_data bij dezelfde sleutel (activiteit)', () => {
    const tijd = new Date().toISOString();
    const r = { ...{ activiteit: [{ id: 'oud', station: 'mail', actie: 'mail', tekst: 'x', tijd }] }, ...{ activiteit: [{ id: 'nieuw', station: 'mail', actie: 'mail', tekst: 'x', tijd }] } };
    expect(bouwSchermPayload(r).activiteit[0].id).toBe('nieuw');
  });
});

describe('AI-team gebruikt recentere machine-activiteit', () => {
  it('agent_stap van vandaag gaat voor oude snapshot-run', () => {
    const p = bouwSchermPayload({
      marketing: { ai_team: { data: { agents: [{ id: 'kwaliteit', laatste_run: '2026-10-12T05:40:00Z', status: 'klaar' }] } } },
      versheid: { agent_laatst: [{ sleutel: 'kwaliteitsagent', tijd: '2026-10-13T05:52:00Z' }, { sleutel: 'contentagent', tijd: '2026-10-13T05:19:00Z' }], snapshot_op: { ai_team: '2026-10-13T05:09:00Z' } },
    });
    expect(p.ai_team.find(a => a.naam === 'Kwaliteitscontrole')?.laatste_run).toBe('2026-10-13T05:52:00.000Z');
    expect(p.ai_team.find(a => a.naam === 'Contentmachine')?.status).toBe('klaar');
    expect(p.bijgewerkt.ai_team).toBe('2026-10-13T05:09:00.000Z');
  });
  it('generieke "ai-agent" koppelt aan niemand', () => {
    expect(agentLaatst([{ sleutel: 'ai-agent', tijd: '2026-10-13T05:00:00Z' }])).toEqual({});
  });
});

describe('stale wordt zichtbaar', () => {
  it('markeerVerouderd zet verouderd_sinds', () => {
    const body = JSON.stringify(bouwSchermPayload({}));
    const uit = JSON.parse(markeerVerouderd(body, Date.parse('2026-10-13T05:00:00Z')));
    expect(uit.verouderd_sinds).toBe('2026-10-13T05:00:00.000Z');
  });
  it('edge function gebruikt markeerVerouderd en X-Cache stale; pagina toont dan oranje', () => {
    const f = readFileSync('supabase/functions/scherm-data/index.ts', 'utf8');
    expect(f).toMatch(/markeerVerouderd\(cache\.body, cache\.op\), 200, \{ "X-Cache": "stale" \}/);
    expect(f).toMatch(/if \(werkFout\) throw/);
    const s = readFileSync('src/pages/Scherm.tsx', 'utf8');
    expect(s).toMatch(/&& !data\?\.verouderd_sinds/);
  });
});

describe('versiecontrole herlaadt', () => {
  const html = (h: string) => `<html><head><script type="module" crossorigin src="/assets/index-${h}.js"></script><link rel="stylesheet" href="/assets/index-${h}.css"></head></html>`;
  const fetcher = (h: () => string) => (async () => ({ ok: true, text: async () => html(h()) })) as unknown as typeof fetch;
  it('kenmerk en vergelijking', async () => {
    expect(buildKenmerk(html('a1'))).toContain('/assets/index-a1.js');
    expect(await nieuweVersieBeschikbaar(buildKenmerk(html('a1')), fetcher(() => 'a1'))).toBe(false);
    expect(await nieuweVersieBeschikbaar(buildKenmerk(html('a1')), fetcher(() => 'b2'))).toBe(true);
  });
  it('herlaadt na 10 minuten bij nieuwe build, niet bij gelijke', async () => {
    vi.useFakeTimers();
    let h = 'a1';
    const herlaad = vi.fn();
    const stop = startVersieControle(herlaad, fetcher(() => h));
    await vi.advanceTimersByTimeAsync(VERSIE_INTERVAL_MS);
    expect(herlaad).not.toHaveBeenCalled();
    h = 'b2';
    await vi.advanceTimersByTimeAsync(VERSIE_INTERVAL_MS);
    expect(herlaad).toHaveBeenCalledTimes(1);
    stop(); vi.useRealTimers();
  });
});

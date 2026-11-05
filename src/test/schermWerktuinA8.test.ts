import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { AI_TEAM, ROBOTNAMEN, WERKPLEK, bouwSchermPayload, agentBezig } from '../../supabase/functions/_shared/schermAnonimiseer';
import { volgendeRun } from '../../supabase/functions/_shared/cronVolgende';

const PLAATSEN = ['intake','acceptatie','certificaten','facturatie','exact','kennisbank','ads','kwaliteit','assistent','mail','service','brein','onderhoud','markt'];

describe('A8-aanvulling werktuin prominent', () => {
  it('elke robot uit ROBOTNAMEN heeft een plek in de werktuin', () => {
    for (const a of AI_TEAM) expect(PLAATSEN).toContain(WERKPLEK[a.id]);
    const src = readFileSync('src/components/scherm/MachineScene.tsx', 'utf8');
    for (const p of PLAATSEN) expect(src).toMatch(new RegExp(`\\b${p}: \\[`));
    const team = bouwSchermPayload({ marketing: { ai_team: { dag: '2026-11-05', data: { agents: [] } } } }).ai_team;
    expect(team.filter(r => r.werkplek).map(r => r.robotnaam).sort()).toEqual(Object.values(ROBOTNAMEN).sort());
    expect(WERKPLEK).toMatchObject({ ads: 'ads', kwaliteit: 'kwaliteit', content: 'kennisbank', conversies: 'intake', opvolger: 'intake', botcoach: 'brein', dagstatus: 'brein', updates: 'onderhoud', beveiliging: 'onderhoud', hartslag: 'onderhoud', concurrentie: 'markt', markt: 'markt', bronnen: 'markt', bing: 'markt' });
  });
  it('bezig met korte tekst uit machine_activiteit, zonder persoonsgegevens', () => {
    const nu = new Date('2026-11-05T11:00:00Z');
    const b = agentBezig([
      { status: 'bezig', tijd: '2026-11-05T10:58:00Z', tekst: 'Lasso: 3 items nagelopen' },
      { status: 'bezig', tijd: '2026-11-05T10:58:00Z', tekst: 'Contentagent mailt jan@voorbeeld.nl' },
      { status: 'bezig', tijd: '2026-11-05T10:30:00Z', tekst: 'Hartslag: oud' },
      { status: 'bezig', tijd: '2026-11-05T10:59:00Z', tekst: 'Turbo test', is_test: true },
    ], nu);
    expect(b.opvolger).toBe('Lasso: 3 items nagelopen');
    expect(b.content).not.toContain('@');
    expect(b.hartslag).toBeUndefined();
    expect(b.ads).toBeUndefined();
    const t = bouwSchermPayload({ marketing: { ai_team: { dag: '2026-11-05', data: { agents: [] } } }, activiteit: [{ id: 1, station: 'kwaliteit', status: 'bezig', tijd: '2026-11-05T10:58:00Z', tekst: 'Lasso: 3 items nagelopen' }] }, nu).ai_team;
    expect(t.find(r => r.robotnaam === 'Lasso')).toMatchObject({ status: 'bezig', nu_tekst: 'Lasso: 3 items nagelopen' });
    expect(JSON.stringify(t)).not.toMatch(/@|€|"id"/);
  });
  it('eerstvolgende run uit het cron-schema (UTC)', () => {
    const na = new Date('2026-11-05T10:07:00Z');
    expect(volgendeRun('*/15 * * * *', na)).toBe('2026-11-05T10:15:00.000Z');
    expect(volgendeRun('15 5-18 * * 1-5', na)).toBe('2026-11-05T10:15:00.000Z');
    expect(volgendeRun('0 9 * * *', na)).toBe('2026-11-06T09:00:00.000Z');
    expect(volgendeRun('onzin', na)).toBeNull();
  });
  it('werktuin is het hoofdbeeld; workers alleen als samenvatting; leesbare lettergroottes', () => {
    const src = readFileSync('src/pages/Scherm.tsx', 'utf8');
    expect(src).toContain('w-[1290px]');
    expect(src).toContain('w-[630px]');
    expect(src).toContain('robots={data.ai_team}');
    const w = src.slice(src.indexOf('function PaneelWorkers'), src.indexOf('function PaneelStroom'));
    expect(w).not.toContain('.map((a, i)');
    const css = readFileSync('src/index.css', 'utf8');
    expect(css).toMatch(/\.werktuin-rooster \.scene-labeltitel strong \{ font-size: 28px/);
    expect(css).toMatch(/\.werktuin-rooster \.scherm-station \.st-regel \{ font-size: 20px/);
  });
});

import type { SchermPayload } from '../../../supabase/functions/_shared/schermAnonimiseer';

export const STATION_LABELS: Record<string, string> = {
  intake: 'Aanvraag-intake', acceptatie: 'Acceptatie en KVK', certificaten: 'Certificaten',
  facturatie: 'Facturatie', exact: 'Exact-koppeling', kennisbank: 'Kennisbank en content',
  ads: 'Ads-monitor', kwaliteit: 'Kwaliteitscontrole', assistent: 'Zeker-assistent', mail: 'Mail', service: 'Klantservice',
};
export const STATION_IDS = Object.keys(STATION_LABELS);
export type Puls = SchermPayload['activiteit'][number];
export const stationToken = (id: string) => `var(--s-${['rood', 'blauw', 'groen', 'oranje'][Math.max(0, STATION_IDS.indexOf(id)) % 4]})`;
export function vandaagActiviteit(d: SchermPayload) {
  const dag = (t: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(new Date(t));
  return d.activiteit.filter(a => Number.isFinite(Date.parse(a.tijd)) && dag(a.tijd) === dag(d.gegenereerd_op));
}
export type Toestand = 'aan_het_werk' | 'stand_by' | 'rust' | 'storing';
export type StationStand = { vandaag: number; skills?: number; laatste_status: string | null; toestand?: Toestand; laatst_actief_op?: string | null; lopende_tekst?: string | null; duur_vandaag_min?: number; agent_bezig_sinds?: string | null };
const hhmm = (iso: string) => new Intl.DateTimeFormat('nl-NL', { timeZone: 'Europe/Amsterdam', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
const dagHhmm = (iso: string) => `${new Intl.DateTimeFormat('nl-NL', { timeZone: 'Europe/Amsterdam', weekday: 'short' }).format(new Date(iso)).replace(/\./g, '')} ${hhmm(iso)}`;
/** Label onder de werkplek, per toestand. */
export function toestandLabel(s: StationStand | undefined, nu = Date.now()): string {
  const sinds = s?.toestand === 'aan_het_werk' && s.agent_bezig_sinds ? Date.parse(s.agent_bezig_sinds) : NaN;
  if (Number.isFinite(sinds)) return `aan het werk: bezig sinds ${Math.max(1, Math.floor((nu - sinds) / 60000))} min`;
  const t = s?.laatst_actief_op && Number.isFinite(Date.parse(s.laatst_actief_op)) ? s.laatst_actief_op : null;
  switch (s?.toestand) {
    case 'aan_het_werk': return `aan het werk: ${s.lopende_tekst ?? 'bezig'}`;
    case 'stand_by': return t ? `stand-by, laatst actief ${hhmm(t)}` : 'stand-by';
    case 'storing': return 'aandacht nodig';
    default: return t ? `rust, laatst actief ${dagHhmm(t)}` : 'rust';
  }
}
/** Ticker: werkperiode van een externe agent als "hh:mm-hh:mm (n min)". */
export function periodeTekst(a: { gestart_op?: string | null; afgerond_op?: string | null; agent?: boolean }): string | null {
  if (!a.agent || !a.gestart_op || !a.afgerond_op) return null;
  const van = Date.parse(a.gestart_op), tot = Date.parse(a.afgerond_op);
  if (!Number.isFinite(van) || !Number.isFinite(tot) || tot < van) return null;
  return `${hhmm(a.gestart_op)}-${hhmm(a.afgerond_op)} (${Math.max(1, Math.round((tot - van) / 60000))} min)`;
}

/** A8-aanvulling: compacte samenvatting van alle workers (geen volledige lijst meer). Bezig = activiteit binnen 10 minuten. */
export function workersSamenvatting(w: SchermPayload['workers'], nuIso: string) {
  const alle = w ? [...w.gepland, ...w.op_afroep] : [];
  const nu = Date.parse(nuIso);
  const bezig = alle.filter(a => a.status !== 'fout' && a.laatste && nu - Date.parse(a.laatste) >= 0 && nu - Date.parse(a.laatste) < 10 * 60_000).length;
  const fout = alle.filter(a => a.status === 'fout');
  const volgende = (w?.gepland ?? []).filter(a => a.volgende && Date.parse(a.volgende) > nu)
    .sort((a, b) => Date.parse(a.volgende!) - Date.parse(b.volgende!)).slice(0, 3)
    .map(a => ({ naam: a.naam, tijd: hhmm(a.volgende!) }));
  return { totaal: alle.length, goed: alle.length - bezig - fout.length, bezig, fout: fout.map(a => a.naam), volgende };
}

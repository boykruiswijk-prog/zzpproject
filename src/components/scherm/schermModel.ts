import type { SchermPayload } from '../../../supabase/functions/_shared/schermAnonimiseer';

export const STATION_LABELS: Record<string, string> = {
  intake: 'Aanvraag-intake', acceptatie: 'Acceptatie en KVK', certificaten: 'Certificaten',
  facturatie: 'Facturatie', exact: 'Exact-koppeling', kennisbank: 'Kennisbank',
  ads: 'Ads-monitor', kwaliteit: 'Kwaliteitscontrole', assistent: 'Zeker-assistent', mail: 'Mail', service: 'Klantservice',
};
export const STATION_IDS = Object.keys(STATION_LABELS);
export type Puls = SchermPayload['activiteit'][number];
export const stationToken = (id: string) => `var(--s-${['rood', 'blauw', 'groen', 'oranje'][Math.max(0, STATION_IDS.indexOf(id)) % 4]})`;
export function vandaagActiviteit(d: SchermPayload) {
  const dag = (t: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(new Date(t));
  return d.activiteit.filter(a => Number.isFinite(Date.parse(a.tijd)) && dag(a.tijd) === dag(d.gegenereerd_op));
}
// Helpers voor pro-rata berekeningen rond pauze/hervat/opzeg + maandfacturatie.
// Pure functies — geen Exact-calls, geen DB-calls.

export const PAKKET_JAARPRIJS: Record<string, number> = {
  "maandelijks": 660,        // €55/maand × 12 (gebruikt voor pro-rata bij upgrade-pad)
  "jaarlijks": 600,
  "jaarlijks-cyber": 750,
  "jaarlijks_cyber": 750,
};

// Maandprijzen voor maandpakketten.
export const PAKKET_MAANDPRIJS: Record<string, number> = {
  "maandelijks": 55,
};

export function getJaarprijs(pakket: string | null | undefined): number {
  if (!pakket) return 600;
  return PAKKET_JAARPRIJS[pakket] ?? 600;
}

export function getMaandprijs(pakket: string | null | undefined): number {
  if (!pakket) return 0;
  return PAKKET_MAANDPRIJS[pakket] ?? 0;
}

// Maandpolis = pakket dat per maand wordt gefactureerd via maandcron.
export function isMaandPolis(pakket: string | null | undefined): boolean {
  if (!pakket) return false;
  return pakket === "maandelijks";
}

export function toDateOnly(d: string | Date): Date {
  const x = typeof d === "string" ? new Date(d) : new Date(d.getTime());
  return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()));
}

export function daysBetween(from: string | Date, to: string | Date): number {
  const a = toDateOnly(from).getTime();
  const b = toDateOnly(to).getTime();
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

// + 1 jaar - 1 dag (matcht Postgres GENERATED column).
export function calcPolisEinddatum(ingangsdatum: string | Date): string {
  const d = toDateOnly(ingangsdatum);
  const plusYear = new Date(Date.UTC(d.getUTCFullYear() + 1, d.getUTCMonth(), d.getUTCDate()));
  const minusDay = new Date(plusYear.getTime() - 24 * 60 * 60 * 1000);
  return minusDay.toISOString().slice(0, 10);
}

// Eerste/laatste dag van de maand van een gegeven datum.
export function firstOfMonth(d: string | Date): string {
  const x = toDateOnly(d);
  return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), 1)).toISOString().slice(0, 10);
}
export function lastOfMonth(d: string | Date): string {
  const x = toDateOnly(d);
  return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
}
export function daysInMonth(d: string | Date): number {
  const x = toDateOnly(d);
  return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + 1, 0)).getUTCDate();
}

// Pro-rata teruggave bij pauze.
export function calculatePauzeCredit(opts: {
  ingangsdatum: string; polis_einddatum: string;
  jaarprijs: number; pauze_datum: string;
}): { credit_bedrag: number; resterende_dagen: number; dagprijs: number; totaal_polis_dagen: number } {
  const totaalDagen = daysBetween(opts.ingangsdatum, opts.polis_einddatum) + 1;
  const dagprijs = opts.jaarprijs / totaalDagen;
  const rawResterende = daysBetween(opts.pauze_datum, opts.polis_einddatum) + 1;
  const resterende = Math.max(0, Math.min(rawResterende, totaalDagen));
  return {
    credit_bedrag: Math.round(dagprijs * resterende * 100) / 100,
    resterende_dagen: resterende,
    dagprijs: Math.round(dagprijs * 10000) / 10000,
    totaal_polis_dagen: totaalDagen,
  };
}

export function calculateHervatFactuur(opts: {
  ingangsdatum: string; polis_einddatum: string;
  jaarprijs: number; hervat_datum: string;
}): { factuur_bedrag: number; resterende_dagen: number; dagprijs: number } {
  const totaalDagen = daysBetween(opts.ingangsdatum, opts.polis_einddatum) + 1;
  const dagprijs = opts.jaarprijs / totaalDagen;
  const rawResterende = daysBetween(opts.hervat_datum, opts.polis_einddatum) + 1;
  const resterende = Math.max(0, Math.min(rawResterende, totaalDagen));
  return {
    factuur_bedrag: Math.round(dagprijs * resterende * 100) / 100,
    resterende_dagen: resterende,
    dagprijs: Math.round(dagprijs * 10000) / 10000,
  };
}

// Maandpolis pro-rata: dagprijs = maandprijs / dagen-in-die-maand.
// Berekent bedrag voor periode [vanaf_datum .. tot_datum] inclusief.
export function calcMaandProrata(opts: {
  maandprijs: number;
  vanaf_datum: string; // YYYY-MM-DD
  tot_datum: string;   // YYYY-MM-DD, dezelfde maand
}): { bedrag: number; dagen: number; dagprijs: number; periode_start: string; periode_eind: string } {
  const dim = daysInMonth(opts.vanaf_datum);
  const dagprijs = opts.maandprijs / dim;
  const dagen = Math.max(0, daysBetween(opts.vanaf_datum, opts.tot_datum) + 1);
  return {
    bedrag: Math.round(dagprijs * dagen * 100) / 100,
    dagen,
    dagprijs: Math.round(dagprijs * 10000) / 10000,
    periode_start: opts.vanaf_datum,
    periode_eind: opts.tot_datum,
  };
}

export const MAAND_NAMEN_NL = [
  "januari","februari","maart","april","mei","juni",
  "juli","augustus","september","oktober","november","december",
];

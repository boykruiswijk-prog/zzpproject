// Helpers voor pro-rata berekeningen rond pauze en hervatting van een polis.
// Hartstikke pure functies — geen Exact-calls, geen DB-calls.

export const PAKKET_JAARPRIJS: Record<string, number> = {
  "maandelijks": 660,        // €55/maand × 12, jaarfactuur
  "jaarlijks": 600,
  "jaarlijks-cyber": 750,
  "jaarlijks_cyber": 750,
};

export function getJaarprijs(pakket: string | null | undefined): number {
  if (!pakket) return 600;
  return PAKKET_JAARPRIJS[pakket] ?? 600;
}

export function toDateOnly(d: string | Date): Date {
  const x = typeof d === "string" ? new Date(d) : new Date(d.getTime());
  // Strip time component → 00:00 UTC
  return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()));
}

export function daysBetween(from: string | Date, to: string | Date): number {
  const a = toDateOnly(from).getTime();
  const b = toDateOnly(to).getTime();
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

// Berekent polis_einddatum vanuit ingangsdatum: + 1 jaar - 1 dag (matcht Postgres GENERATED column).
export function calcPolisEinddatum(ingangsdatum: string | Date): string {
  const d = toDateOnly(ingangsdatum);
  const plusYear = new Date(Date.UTC(d.getUTCFullYear() + 1, d.getUTCMonth(), d.getUTCDate()));
  const minusDay = new Date(plusYear.getTime() - 24 * 60 * 60 * 1000);
  return minusDay.toISOString().slice(0, 10);
}

// Pro-rata teruggave bij pauze: credit = dagprijs × dagen vanaf pauze t/m polis-einddatum (inclusief).
// Gecapped op de totale jaarprijs als pauze vóór polis-ingangsdatum valt.
export function calculatePauzeCredit(opts: {
  ingangsdatum: string;
  polis_einddatum: string;
  jaarprijs: number;
  pauze_datum: string; // YYYY-MM-DD
}): { credit_bedrag: number; resterende_dagen: number; dagprijs: number; totaal_polis_dagen: number } {
  const totaalDagen = daysBetween(opts.ingangsdatum, opts.polis_einddatum) + 1; // inclusief start en eind
  const dagprijs = opts.jaarprijs / totaalDagen;
  const rawResterende = daysBetween(opts.pauze_datum, opts.polis_einddatum) + 1;
  const resterende = Math.max(0, Math.min(rawResterende, totaalDagen));
  const credit = Math.round(dagprijs * resterende * 100) / 100;
  return {
    credit_bedrag: credit,
    resterende_dagen: resterende,
    dagprijs: Math.round(dagprijs * 10000) / 10000,
    totaal_polis_dagen: totaalDagen,
  };
}

// Nieuwe factuur bij hervatting: dagprijs × dagen vanaf hervat-datum t/m polis-einddatum (inclusief).
export function calculateHervatFactuur(opts: {
  ingangsdatum: string;
  polis_einddatum: string;
  jaarprijs: number;
  hervat_datum: string;
}): { factuur_bedrag: number; resterende_dagen: number; dagprijs: number } {
  const totaalDagen = daysBetween(opts.ingangsdatum, opts.polis_einddatum) + 1;
  const dagprijs = opts.jaarprijs / totaalDagen;
  const rawResterende = daysBetween(opts.hervat_datum, opts.polis_einddatum) + 1;
  const resterende = Math.max(0, Math.min(rawResterende, totaalDagen));
  const bedrag = Math.round(dagprijs * resterende * 100) / 100;
  return {
    factuur_bedrag: bedrag,
    resterende_dagen: resterende,
    dagprijs: Math.round(dagprijs * 10000) / 10000,
  };
}

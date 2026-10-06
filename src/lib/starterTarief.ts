// Startertarief BAV + AVB. Byte-gelijk aan supabase/functions/_shared/starterTarief.ts.
// Pure functies: geen netwerk, geen database.

export const STARTER = {
  maandprijs: 45,
  jaarprijs: 495,
  duurMaanden: 12,
  naMaandprijs: 55,
  naJaarprijs: 600,
} as const;

/** Verplichte AFM-tekst overal waar de startersprijs staat. */
export const STARTER_VOORWAARDE_TEKST =
  "€ 45 per maand of € 495 per jaar, inclusief kosten en assurantiebelasting, de eerste 12 maanden; daarna € 55 per maand of € 600 per jaar. Voor zzp'ers met een KVK-inschrijving jonger dan 12 maanden.";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function parse(d: string): Date | null {
  if (!ISO.test(d)) return null;
  const x = new Date(`${d}T00:00:00Z`);
  return Number.isNaN(x.getTime()) || x.toISOString().slice(0, 10) !== d ? null : x;
}

/** Datum + n maanden (kalender), dag begrensd op de laatste dag van de doelmaand. */
export function plusMaanden(d: string, n: number): string {
  const x = parse(d);
  if (!x) throw new Error("ongeldige datum");
  const y = x.getUTCFullYear(), m = x.getUTCMonth() + n, dag = x.getUTCDate();
  const laatste = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(dag, laatste))).toISOString().slice(0, 10);
}

function minDag(d: string): string {
  const x = parse(d)!;
  return new Date(x.getTime() - 86_400_000).toISOString().slice(0, 10);
}

/**
 * Starter als de KVK-inschrijving op de ingangsdatum minder dan 12 maanden oud is:
 * ingangsdatum < startdatum KVK + 12 maanden. Startdatum mag niet na de ingangsdatum liggen.
 */
export function isStarter(kvkStartdatum: string | null | undefined, ingangsdatum: string | null | undefined): boolean {
  if (!kvkStartdatum || !ingangsdatum) return false;
  const k = parse(kvkStartdatum), i = parse(ingangsdatum);
  if (!k || !i || k.getTime() > i.getTime()) return false;
  return ingangsdatum < plusMaanden(kvkStartdatum, STARTER.duurMaanden);
}

/** Laatste dag van het startertarief: ingangsdatum + 12 maanden min 1 dag. */
export function starterTot(ingangsdatum: string): string {
  return minDag(plusMaanden(ingangsdatum, STARTER.duurMaanden));
}

export type Cyclus = "maand" | "jaar";

/** Bedrag voor een factuurperiode; zelfde regel als SQL contract_bedrag_voor_periode. */
export function bedragVoorPeriode(cyclus: Cyclus, starterTotDatum: string | null, periodeStart: string): number {
  const starter = starterTotDatum !== null && periodeStart <= starterTotDatum;
  if (cyclus === "maand") return starter ? STARTER.maandprijs : STARTER.naMaandprijs;
  return starter ? STARTER.jaarprijs : STARTER.naJaarprijs;
}

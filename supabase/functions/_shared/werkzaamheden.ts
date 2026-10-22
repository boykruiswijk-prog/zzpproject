/** Shared input limit; never truncate the stored application. */
export const WERKZAAMHEDEN_MAX = 1000;
export const WERKZAAMHEDEN_TE_LANG = "Beschrijf je werkzaamheden in maximaal 1.000 tekens. Kort de tekst in voordat je verdergaat.";
export function werkzaamhedenFout(value: unknown): string | null {
  return typeof value === "string" && value.length > WERKZAAMHEDEN_MAX ? WERKZAAMHEDEN_TE_LANG : null;
}

/** Only for an external field with a hard limit, not database values. */
export function kortKoppelingTekst(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 3))}...`;
}
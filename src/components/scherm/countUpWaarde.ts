export const COUNTUP_DUUR = 1400;
/** Waarde op tijdstip `verstreken` ms; altijd binnen [van, naar] en nooit negatief. */
export function countUpWaarde(van: number, naar: number, verstreken: number, duur = COUNTUP_DUUR): number {
  const a = Math.max(0, Number.isFinite(van) ? van : 0);
  const b = Math.max(0, Number.isFinite(naar) ? naar : 0);
  if (!Number.isFinite(verstreken) || verstreken >= duur || verstreken < 0 || duur <= 0) return b;
  const t = verstreken / duur;
  const v = a + (b - a) * (1 - (1 - t) ** 3);
  return Math.min(Math.max(a, b), Math.max(Math.min(a, b), v));
}

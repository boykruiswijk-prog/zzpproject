// Pure regels voor automatische portaltoegang (geen imports; ook door vitest getest).
export const MAX_UITNODIGINGEN_PER_24U = 3;

/** Misbruikrem: maximaal 3 portaaluitnodigingen per adres per 24 uur. */
export function binnenMisbruikrem(aantalLaatste24u: number): boolean {
  return aantalLaatste24u < MAX_UITNODIGINGEN_PER_24U;
}

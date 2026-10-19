// Berekende jaarruimte van de rekenhulp doorgeven aan het interesseformulier (alleen in deze sessie, nooit naar de server tot verzenden).
const SLEUTEL = "zp_evi_jaarruimte";
export const EVI_JAARRUIMTE_EVENT = "evi-jaarruimte";

export function zetEviJaarruimte(bedrag: number) {
  const n = Number.isFinite(bedrag) ? Math.max(0, Math.round(bedrag)) : 0;
  try { sessionStorage.setItem(SLEUTEL, String(n)); } catch { /* geen opslag */ }
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(EVI_JAARRUIMTE_EVENT, { detail: n }));
}

export function leesEviJaarruimte(): number | null {
  try {
    const v = sessionStorage.getItem(SLEUTEL);
    return v === null ? null : Number(v);
  } catch { return null; }
}

/** Kalenderdagen (Europe/Amsterdam) van vandaag tot en met 31 december van het opgegeven jaar; nooit negatief. */
export function dagenTotEindeJaar(nu: Date = new Date(), jaar = 2026): number {
  const delen = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam", year: "numeric", month: "2-digit", day: "2-digit" }).format(nu).split("-").map(Number);
  const vandaag = Date.UTC(delen[0], delen[1] - 1, delen[2]);
  return Math.max(0, Math.round((Date.UTC(jaar, 11, 31) - vandaag) / 86400000));
}

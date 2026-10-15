// D7 (besluit Boy 15-10-2026): eerste factuur op de ingangsdatum.
// Byte-gelijk met src/lib/eersteFactuur.ts.
// Ligt de ingangsdatum na vandaag (Europe/Amsterdam), dan maakt activatie geen factuur in Exact;
// het contract gaat alleen in de planner en factuur-planner maakt de eerste hele periode (D1)
// op de ingangsdatum (planner claimt alleen periode_start <= vandaag, invoice_date = periode_start).
import { dagErvoor } from "./factuurPeriode";

export function eersteFactuurViaPlanner(ingang: string | null | undefined, vandaag: string): boolean {
  return !!ingang && ingang.slice(0, 10) > vandaag.slice(0, 10);
}

/** Plannervelden voor een contract waarvan de eerste periode nog gefactureerd moet worden. */
export function plannerDatumsOpIngang(ingang: string): { factureren_vanaf: string; gefactureerd_tm: string; volgende_factuurdatum: string } {
  const d = ingang.slice(0, 10);
  return { factureren_vanaf: d, gefactureerd_tm: dagErvoor(d), volgende_factuurdatum: d };
}

const nl = (d: string) => { const [y, m, dd] = d.slice(0, 10).split("-"); return `${dd}-${m}-${y}`; };
export const eersteFactuurLogTekst = (ingang: string) => `Eerste factuur gepland op ingangsdatum ${nl(ingang)} (D7)`;

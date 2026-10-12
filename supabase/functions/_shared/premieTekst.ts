// Klantveilige premieteksten. Interne controle-opmerkingen nooit in deze tekst.
import { formatDateNL } from "./dateFormat.ts";

const bedrag = (n: number) => new Intl.NumberFormat("nl-NL", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 }).format(n);

/** "€495 per jaar startertarief tot en met 11-10-2027, daarna €600 per jaar". */
export function starterPremieKlanttekst(starterPremie: number, standaardPremie: number, totDatum: string | null): string {
  const tot = totDatum ? ` tot en met ${formatDateNL(totDatum)}` : "";
  return `€${bedrag(starterPremie)} per jaar startertarief${tot}, daarna €${bedrag(standaardPremie)} per jaar`;
}

const INTERN = /\b(controleren|controle|check|checken|intern|interne)\b/i;

/** Vangnet: haalt deel na een puntkomma met interne woorden weg uit een klanttekst. */
export function klantVeiligeTekst(waarde: unknown): string {
  const s = String(waarde ?? "");
  return s.split(";").filter((deel, i) => i === 0 ? !INTERN.test(deel) || !s.includes(";") ? true : false : !INTERN.test(deel)).map(d => d.trim()).filter(Boolean).join("; ");
}

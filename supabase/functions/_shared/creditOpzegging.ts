// Creditnota bij opzegging via het CRM. Pure functie, geen Exact- of DB-calls.
// Hergebruikt exact de naar-rato-regel van polis-lifecycle (calculatePauzeCredit):
// dagprijs = periodebedrag / dagen in de gefactureerde periode, × resterende dagen (inclusief).
import { calculatePauzeCredit } from "./polisProRata.ts";

export type GefactureerdePeriode = { periode_start: string; periode_eind: string; bedrag: number };

function dagErna(iso: string): string {
  return new Date(new Date(`${iso.slice(0, 10)}T00:00:00Z`).getTime() + 86400000).toISOString().slice(0, 10);
}

export function berekenOpzegCredit(einddatum: string, perioden: GefactureerdePeriode[]) {
  const vanaf = dagErna(einddatum);
  const regels = perioden
    .filter((p) => p.periode_eind > einddatum)
    .map((p) => {
      const start = p.periode_start > vanaf ? p.periode_start : vanaf;
      const c = calculatePauzeCredit({
        ingangsdatum: p.periode_start, polis_einddatum: p.periode_eind,
        jaarprijs: Number(p.bedrag), pauze_datum: start,
      });
      return { ...p, credit_vanaf: start, credit_bedrag: c.credit_bedrag, resterende_dagen: c.resterende_dagen, dagprijs: c.dagprijs, totaal_dagen: c.totaal_polis_dagen };
    });
  const bedrag = Math.round(regels.reduce((s, r) => s + r.credit_bedrag, 0) * 100) / 100;
  return { vanaf, bedrag, regels, regel: "per dag (calculatePauzeCredit uit polisProRata)" };
}

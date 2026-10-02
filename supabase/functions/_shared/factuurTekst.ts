// Pure helpers voor alle BAV-AVB-factuurteksten en referenties.
export type FactuurSoort = "premie" | "restitutie_pauze" | "restitutie_opzegging" | "hervat";

const MAX = 60;

export function datumKort(iso: string): string {
  const [jaar = "", maand = "", dag = ""] = iso.slice(0, 10).split("-");
  return `${dag}-${maand}-${jaar.slice(-2)}`;
}

export function periodeTekst(vanaf: string, tot: string): string {
  return `${datumKort(vanaf)} t/m ${datumKort(tot)}`;
}

export function regelOmschrijving(soort: FactuurSoort, vanaf: string, tot: string): string {
  const suffix = soort === "premie"
    ? "BAV-AVB premie"
    : soort === "restitutie_pauze"
    ? "restitutie pauze"
    : soort === "restitutie_opzegging"
    ? "restitutie opzegging"
    : "BAV-AVB hervat";
  return `${periodeTekst(vanaf, tot)} ${suffix}`.slice(0, MAX);
}

export function regelNotities(dagen: number, dagprijs: number, maandNaam?: string): string {
  const berekening = `${dagen} dagen × € ${dagprijs.toFixed(4)}`;
  return maandNaam ? `${maandNaam}: ${berekening}` : berekening;
}

export function kopOmschrijving(label: string): string {
  return label.trim().slice(0, MAX);
}

export function factuurReferentie(certificaat?: string | null, relatieCode?: string | null): string {
  return String(certificaat ?? "").trim() || String(relatieCode ?? "").trim();
}

export function maandIsAlGefactureerd(status?: string | null): boolean {
  return status === "success" || status === "pending";
}
// Exact-regelhoeveelheid/-prijs: UnitPrice altijd positief (Exact weigert negatieve
// nettoprijs); een creditnota (Type 8021) krijgt Quantity -1 zodat het bedrag negatief wordt.
export function exactRegelBedrag(type: number, bedrag: number): { Quantity: number; UnitPrice: number } {
  const prijs = Math.round(Math.abs(bedrag) * 100) / 100;
  // Creditnota (8021) krijgt Quantity 1 met positieve UnitPrice, zoals de werkende creditnota's in Exact; -1 zou een debetbedrag geven.
  return { Quantity: 1, UnitPrice: prijs };
}

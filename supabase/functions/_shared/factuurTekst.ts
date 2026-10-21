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
// Exact-regelhoeveelheid/-prijs (besluit Boy 21-10-2026): UnitPrice altijd positief;
// een creditnota (Type 8021) krijgt Quantity -aantal zodat het totaal negatief is.
// Teken van invoer wordt genormaliseerd: nooit een dubbele min.
export function exactRegelBedrag(type: number, bedrag: number, aantal = 1): { Quantity: number; UnitPrice: number } {
  const prijs = Math.round(Math.abs(Number(bedrag)) * 100) / 100;
  const n = Math.abs(Number(aantal)) || 1;
  return { Quantity: type === 8021 ? -n : n, UnitPrice: prijs };
}

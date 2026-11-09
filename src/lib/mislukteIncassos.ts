export type MisluktRij = { onderneming_id: string | null; klant: string | null; factuurnummer: string; bedrag: number; factuurdatum: string | null; vervaldatum: string | null;
  categorie: "terugboeking" | "incasso_open" | "betaalconditie_onbekend"; reden: string | null; heeft_rekening: boolean | null; heeft_machtiging: boolean | null };
export const CATEGORIE_LABEL: Record<string, string> = { terugboeking: "Teruggeboekt", incasso_open: "Incasso open, niet meer in run", betaalconditie_onbekend: "Vervallen, betaalconditie nog onbekend" };
export const jaNee = (v: boolean | null) => (v == null ? "Nog niet opgehaald" : v ? "Ja" : "Nee");

// Klantmail-teksten (D8/D9, besluit Boy 15-10-2026). Byte-gelijk met src/lib/klantmailTekst.ts.
export const KLANTMAIL_PLACEHOLDERS = [
  "voornaam", "bedrijfsnaam", "bedrag", "polisnummer", "factuurnummer", "factuurdatum",
  "vervaldatum", "betaal_voor", "opschort_datum", "verlengdatum",
] as const;
export type KlantmailData = Partial<Record<(typeof KLANTMAIL_PLACEHOLDERS)[number], string | number | null>>;

export class PlaceholderFout extends Error {}

/** Vult {placeholders}; onbekende of ontbrekende placeholder geeft een fout, er blijft nooit {..} staan. */
export function vulPlaceholders(tekst: string, data: KlantmailData): string {
  return tekst.replace(/\{([a-z_]+)\}/g, (_m, k: string) => {
    if (!(KLANTMAIL_PLACEHOLDERS as readonly string[]).includes(k)) throw new PlaceholderFout(`Onbekende placeholder {${k}}`);
    const v = (data as Record<string, unknown>)[k];
    if (v === undefined || v === null || v === "") throw new PlaceholderFout(`Geen waarde voor {${k}}`);
    return String(v);
  });
}

/** Alleen versturen als de schakelaar aan staat en Boy de tekst heeft goedgekeurd. */
export function schakelaarStaatAan(rij: { actief?: boolean | null; status?: string | null } | null | undefined): boolean {
  return !!rij && rij.actief === true && !!rij.status && rij.status !== "wacht_op_akkoord_boy";
}

export const VOORBEELD_DATA: KlantmailData = {
  voornaam: "Sanne", bedrijfsnaam: "Voorbeeld Consultancy BV", bedrag: "€ 55,00", polisnummer: "ZP-000123",
  factuurnummer: "26001234", factuurdatum: "01-11-2026", vervaldatum: "08-11-2026", betaal_voor: "15-11-2026",
  opschort_datum: "29-11-2026", verlengdatum: "01-12-2026",
};

const nl = (iso: string) => { const [y, m, d] = iso.slice(0, 10).split("-"); return `${d}-${m}-${y}`; };
export const datumNL = (iso: string | null | undefined) => (iso ? nl(iso) : "");
export const euro = (n: number | null | undefined) => (n == null ? "" : `€ ${Number(n).toFixed(2).replace(".", ",")}`);
export function plusDagen(iso: string, n: number): string {
  return new Date(new Date(`${iso.slice(0, 10)}T00:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10);
}

// Pure regels voor BAV/AVB-certificaten. Gedeeld door generate-certificate en tests.

export interface LeadVoorHoedanigheid {
  branche?: string | null;
  beroep?: string | null;
}

/** Hoedanigheid = branche (keuze "In welk vak werk je vooral?"), anders beroep, anders "Onbekend". */
export function bepaalHoedanigheid(lead: LeadVoorHoedanigheid): string {
  const b = (lead.branche ?? "").trim();
  if (b) return b;
  const r = (lead.beroep ?? "").trim();
  if (r) return r;
  return "Onbekend";
}

export type NieuwBesluit =
  | { toegestaan: true; nieuwNummer: true }
  | { toegestaan: false; code: "bestaand_certificaat"; bestaand: string };

/**
 * Een nieuw nummer wordt alleen uitgegeven als er geen geldig certificaat is,
 * of als de gebruiker expliciet bevestigt (bijv. tweede polis).
 */
export function beslisNieuwCertificaat(
  bestaande: { certificate_number: string; status?: string | null }[],
  bevestigdNieuwNummer: boolean,
): NieuwBesluit {
  const geldig = bestaande.find((p) => (p.status ?? "geldig") === "geldig");
  if (geldig && !bevestigdNieuwNummer) {
    return { toegestaan: false, code: "bestaand_certificaat", bestaand: geldig.certificate_number };
  }
  return { toegestaan: true, nieuwNummer: true };
}

export const AANPASBARE_VELDEN = ["profession", "certificate_holder", "insured_name", "start_date"] as const;
export type AanpasbaarVeld = (typeof AANPASBARE_VELDEN)[number];

/** Filtert invoer tot de vier aanpasbare velden; lege waarden worden genegeerd. */
export function schoonAanpassing(input: Record<string, unknown>): Partial<Record<AanpasbaarVeld, string>> {
  const uit: Partial<Record<AanpasbaarVeld, string>> = {};
  for (const k of AANPASBARE_VELDEN) {
    const v = input?.[k];
    if (typeof v === "string" && v.trim()) uit[k] = v.trim();
  }
  if (uit.start_date && !/^\d{4}-\d{2}-\d{2}$/.test(uit.start_date)) delete uit.start_date;
  return uit;
}

export const FOOTER_REGISTER_TEKST = "ZP Zaken is ingeschreven in het register Wft bij de AFM onder vergunningsnummer:";
export const POLISBLAD_NOTITIE =
  'Waar op het polisblad wordt vermeld "per jaar voor alle leden tezamen" wordt gerefereerd aan het verzekerd bedrag per jaar.';

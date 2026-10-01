// Certificaten per onderneming. Een certificaatnummer is NIET uniek: alleen nummer + onderneming is uniek.
export type KlantCertificaat = {
  id: string;
  onderneming_id: string;
  persoon_id: string | null;
  certificaatnummer: string;
  aanvraagdatum: string;
  pakket: string | null;
  match_type: string | null;
  koppeling_status: "bevestigd" | "voorstel" | "afgewezen";
  waarschuwing: string | null;
  bron_naam: string | null;
  bron_contact: string | null;
  is_test: boolean;
};

export const CERT_VELDEN =
  "id,onderneming_id,persoon_id,certificaatnummer,aanvraagdatum,pakket,match_type,koppeling_status,waarschuwing,bron_naam,bron_contact,is_test";

/** Actueel certificaat = laatste aanvraag die niet is afgewezen (bevestigd gaat voor bij gelijke datum). */
export function actueelCertificaat(certs: KlantCertificaat[]): KlantCertificaat | null {
  const geldig = certs.filter((c) => c.koppeling_status !== "afgewezen");
  if (!geldig.length) return null;
  return [...geldig].sort((a, b) =>
    b.aanvraagdatum.localeCompare(a.aanvraagdatum) ||
    Number(b.koppeling_status === "bevestigd") - Number(a.koppeling_status === "bevestigd"),
  )[0];
}

export function groepeerPerOnderneming(certs: KlantCertificaat[]): Map<string, KlantCertificaat[]> {
  const m = new Map<string, KlantCertificaat[]>();
  for (const c of certs) m.set(c.onderneming_id, [...(m.get(c.onderneming_id) ?? []), c]);
  return m;
}

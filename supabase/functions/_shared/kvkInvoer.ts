// KVK-invoercontrole voor het aanvraagformulier en process-bav-wizard (gedeeld; geen Deno- of browser-API's).
// Geen 11-proef: KVK-nummers hebben die sinds 2016 niet meer.

/** Oude placeholder van het KVK-veld; bezoekers typten die soms over. */
export const OUD_VOORBEELD_KVK = "12345678";
export const KVK_EIGEN_NUMMER_MELDING = "Vul je eigen KVK-nummer in (8 cijfers)";
export const KVK_PLACEHOLDER = "8 cijfers, zie je KVK-uittreksel";
export const KVK_LEEG_MELDING = "Vul je KVK-nummer in.";
export const KVK_FORMAAT_MELDING = "Je KVK-nummer bestaat uit precies 8 cijfers. Je vindt het op je KVK-uittreksel.";

/** Haalt spaties, punten en streepjes weg ("1234 5678", "1234.5678", "12-345-678" worden "12345678"). */
export function schoonKvk(raw: string | null | undefined): string {
  return (raw ?? "").replace(/[\s.\-\u2010-\u2015]/g, "");
}

/** Foutmelding in gewone taal, of null als het opgeschoonde nummer precies 8 cijfers is. */
export function kvkFoutmelding(raw: string | null | undefined): string | null {
  const k = schoonKvk(raw);
  if (!k) return KVK_LEEG_MELDING;
  if (!/^[0-9]{8}$/.test(k)) return KVK_FORMAAT_MELDING;
  return null;
}

/** 8 cijfers (na opschonen), niet het oude voorbeeldnummer en niet alle cijfers gelijk. */
export function isEigenKvk(raw: string | null | undefined): boolean {
  const k = schoonKvk(raw);
  if (!/^[0-9]{8}$/.test(k)) return false;
  if (k === OUD_VOORBEELD_KVK) return false;
  if (/^(\d)\1{7}$/.test(k)) return false;
  return true;
}

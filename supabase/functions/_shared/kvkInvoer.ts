// KVK-invoercontrole voor het aanvraagformulier en process-bav-wizard (gedeeld; geen Deno- of browser-API's).
// Geen 11-proef: KVK-nummers hebben die sinds 2016 niet meer.

/** Oude placeholder van het KVK-veld; bezoekers typten die soms over. */
export const OUD_VOORBEELD_KVK = "12345678";
export const KVK_EIGEN_NUMMER_MELDING = "Vul je eigen KVK-nummer in (8 cijfers)";
export const KVK_PLACEHOLDER = "8 cijfers, zie je KVK-uittreksel";

/** 8 cijfers, niet het oude voorbeeldnummer en niet alle cijfers gelijk. */
export function isEigenKvk(raw: string | null | undefined): boolean {
  const k = (raw ?? "").trim();
  if (!/^[0-9]{8}$/.test(k)) return false;
  if (k === OUD_VOORBEELD_KVK) return false;
  if (/^(\d)\1{7}$/.test(k)) return false;
  return true;
}

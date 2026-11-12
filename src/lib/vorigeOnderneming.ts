// Rechtsvormwijziging (besluit Boy 12-11-2026, register D-aanvulling Rechtsvormwijziging).
// Eén bron voor het optionele aanvraagveld "eerder verzekerd via een andere onderneming" en de koppelregels in admin.

export const VORIGE_VRAAG = "Ik had eerder een verzekering bij ZP Zaken via een andere onderneming";
export const LABEL_VORIGE_NAAM = "Naam vorige onderneming";
export const LABEL_VORIGE_KVK = "KvK-nummer vorige onderneming";

const kvkSchoon = (s: string) => s.replace(/\D/g, "");

/** Validatie van het optionele veld; alleen als de klant het aanvinkt. */
export function vorigeOndernemingFouten(i: { aan: boolean; naam: string; kvk: string }): { naam?: string; kvk?: string } {
  if (!i.aan) return {};
  const f: { naam?: string; kvk?: string } = {};
  if (i.naam.trim().length < 2) f.naam = "Vul de naam van je vorige onderneming in";
  if (kvkSchoon(i.kvk).length !== 8) f.kvk = "Vul het KvK-nummer van je vorige onderneming in (8 cijfers)";
  return f;
}

/** Velden voor extra_data.formulier; leeg als de klant het niet aanvinkte. */
export function vorigeOndernemingVelden(i: { aan: boolean; naam: string; kvk: string }): Array<[string, string]> {
  if (!i.aan) return [];
  return [[VORIGE_VRAAG, "Ja"], [LABEL_VORIGE_NAAM, i.naam.trim()], [LABEL_VORIGE_KVK, kvkSchoon(i.kvk)]];
}

/** Leest de opgegeven vorige onderneming uit extra_data.formulier van een lead. */
export function vorigeOndernemingUitFormulier(formulier: unknown): { naam: string; kvk: string } | null {
  if (!Array.isArray(formulier)) return null;
  const waarde = (l: string) => String((formulier.find((f: any) => f?.label === l) as any)?.waarde ?? "").trim();
  const naam = waarde(LABEL_VORIGE_NAAM); const kvk = kvkSchoon(waarde(LABEL_VORIGE_KVK));
  return naam || kvk ? { naam, kvk } : null;
}

/** Reden bij koppelen is verplicht: 10 tot 500 tekens (server hanteert dezelfde grens). */
export function koppelRedenFout(reden: string): string | null {
  const n = reden.trim().length;
  return n < 10 || n > 500 ? "Geef een reden (10 tot 500 tekens)." : null;
}

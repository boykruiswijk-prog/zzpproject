/** Herkent een opzegging die waarschijnlijk van de collectieve klant Circle8 komt (alleen een hint voor de knop). */
export type Circle8Bron = { polisnummer?: string | null; details?: { toelichting?: unknown; bedrijfsnaam?: unknown } | null };

const NAAM = /circle\s?8|circl8/i;

export function lijktCircle8(a: Circle8Bron): boolean {
  const polis = String(a.polisnummer ?? "").trim();
  if (/^zpcir/i.test(polis)) return true;
  return [polis, a.details?.toelichting, a.details?.bedrijfsnaam].some((t) => typeof t === "string" && NAAM.test(t));
}

/** Toont de Circle8-knop alleen voor een niet-verwerkte opzegging zonder zekere koppeling. */
export function toonCircle8Knop(a: { type?: string; opzegging_verwerkt_op?: string | null; koppeling_status?: string | null; onderneming_id?: string | null }): boolean {
  if (a.type && a.type !== "opzeggen") return false;
  if (a.opzegging_verwerkt_op) return false;
  return !(a.koppeling_status === "zeker" && a.onderneming_id);
}

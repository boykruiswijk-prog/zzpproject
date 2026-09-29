// ISO-landcode voor Exact (crm/Accounts.Country). Geen imports: ook getest met vitest.
const LANDEN: Record<string, string> = {
  nederland: "NL", netherlands: "NL", "the netherlands": "NL", nl: "NL",
  belgie: "BE", "belgië": "BE", belgium: "BE", belgique: "BE", be: "BE",
  duitsland: "DE", germany: "DE", deutschland: "DE", de: "DE",
  luxemburg: "LU", luxembourg: "LU", lu: "LU",
  frankrijk: "FR", france: "FR", fr: "FR",
};
export function landcodeVoor(land: string | null | undefined, postcode?: string | null): string {
  const k = String(land ?? "").trim().toLowerCase();
  if (k && LANDEN[k]) return LANDEN[k];
  const pc = String(postcode ?? "").trim().toUpperCase();
  if (/^\d{4}\s?[A-Z]{2}$/.test(pc)) return "NL";
  if (/^\d{4}$/.test(pc)) return "BE";
  return "NL";
}

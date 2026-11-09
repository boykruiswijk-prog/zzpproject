// Keuze bij "Nieuw certificaat" (besluit Boy 9-11-2026): alleen wat de klant actief heeft.
export type CertificaatKeuze = "beide" | "cyber" | "bav";
export function certificaatKeuzes(d?: { bav: boolean; cyber: boolean } | null): { waarde: CertificaatKeuze; label: string }[] {
  if (!d) return [];
  const r: { waarde: CertificaatKeuze; label: string }[] = [];
  if (d.bav && d.cyber) r.push({ waarde: "beide", label: "BAV + AVB en cyber" });
  if (d.cyber) r.push({ waarde: "cyber", label: "Alleen cyber" });
  if (d.bav) r.push({ waarde: "bav", label: "Alleen BAV + AVB" });
  return r;
}
/** Cybernummer: ZPCYB plus minimaal vier cijfers, doorlopend. */
export const cyberNummer = (n: number) => `ZPCYB${String(n).padStart(4, "0")}`;

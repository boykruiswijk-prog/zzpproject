// D7 (besluit Boy 15-10-2026): certificaat niet eerder beschikbaar dan 1 kalendermaand voor de ingangsdatum.
// Byte-gelijk met src/lib/certificaatBeschikbaar.ts.
function dagenInMaand(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Ingangsdatum min 1 kalendermaand, dag afgekapt op maandeinde (31-03 -> 28/29-02). */
export function certificaatBeschikbaarVanaf(ingang: string): string {
  const [y, m, d] = ingang.slice(0, 10).split("-").map(Number);
  const py = m === 1 ? y - 1 : y;
  const pm = m === 1 ? 12 : m - 1;
  const pd = Math.min(d, dagenInMaand(py, pm));
  return `${py}-${String(pm).padStart(2, "0")}-${String(pd).padStart(2, "0")}`;
}

export function vandaagNL(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Amsterdam" }).format(new Date());
}

/** Zonder ingangsdatum of met ingangsdatum in het verleden: nu beschikbaar. */
export function certificaatBeschikbaar(ingang: string | null | undefined, vandaag: string = vandaagNL()): boolean {
  if (!ingang) return true;
  return vandaag.slice(0, 10) >= certificaatBeschikbaarVanaf(ingang);
}

export function datumNL(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}-${m}-${y}`;
}

export function certificaatTeVroegMelding(ingang: string): string {
  return `Certificaat beschikbaar vanaf ${datumNL(certificaatBeschikbaarVanaf(ingang))} (1 maand voor de ingangsdatum)`;
}

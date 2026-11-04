// Pure regels voor review-bestaande-klanten (getest in src/test/reviewBestaandeKlanten.test.ts).
export const maskeer = (e: string) => e.replace(/^(.).*(@.*)$/, "$1***$2");

export function testNaarToegestaan(e: string): boolean {
  return /^[^@\s]+@zpzaken\.nl$/i.test(e.trim());
}

export type Body = { dryRun: boolean; ronde: 1 | 2 | 3 | 4; testNaar: string | null };

export function valideerBody(b: unknown): Body | { error: string } {
  const o = (b ?? {}) as Record<string, unknown>;
  let testNaar: string | null = null;
  if (o.test_naar !== undefined && o.test_naar !== null) {
    if (typeof o.test_naar !== "string" || !testNaarToegestaan(o.test_naar)) return { error: "test_naar alleen voor @zpzaken.nl" };
    testNaar = o.test_naar.trim().toLowerCase();
    // Voorbeeldmail: geen ronde of dry_run nodig, raakt nooit klanten of review_verzoeken.
    return { dryRun: true, ronde: ([2, 3, 4] as const).find((r) => r === o.ronde) ?? 1, testNaar };
  }
  if (typeof o.dry_run !== "boolean") return { error: "dry_run (true|false) verplicht" };
  if (o.ronde !== 1 && o.ronde !== 2 && o.ronde !== 3 && o.ronde !== 4) return { error: "ronde moet 1, 2, 3 of 4 zijn" };
  return { dryRun: o.dry_run, ronde: o.ronde, testNaar };
}

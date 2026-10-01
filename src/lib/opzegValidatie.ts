// Gedeelde opzegregels. Byte-gelijk gespiegeld in supabase/functions/_shared/opzegValidatie.ts.
export const OPZEG_TOELICHTING_MIN = 3;
export const OPZEG_TOELICHTING_MAX = 500;
export const OPZEG_MAX_DAGEN_VOORUIT = 180;

/** Datum (jjjj-mm-dd) van vandaag in Nederlandse tijd. */
export function vandaagNL(nu: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(nu);
}

export function plusDagen(iso: string, dagen: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dagen);
  return d.toISOString().slice(0, 10);
}

export function isAndersReden(reden: unknown): boolean {
  return reden === "Anders" || reden === "andere_reden";
}

export function valideerToelichting(reden: unknown, toelichting: unknown): string | null {
  if (!isAndersReden(reden)) {
    return typeof toelichting === "string" && toelichting.trim().length > OPZEG_TOELICHTING_MAX
      ? `De toelichting mag maximaal ${OPZEG_TOELICHTING_MAX} tekens zijn.` : null;
  }
  const t = typeof toelichting === "string" ? toelichting.trim() : "";
  if (t.length < OPZEG_TOELICHTING_MIN) return `Geef een toelichting van minimaal ${OPZEG_TOELICHTING_MIN} tekens.`;
  if (t.length > OPZEG_TOELICHTING_MAX) return `De toelichting mag maximaal ${OPZEG_TOELICHTING_MAX} tekens zijn.`;
  return null;
}

export function valideerOpzegdatum(datum: unknown, vandaag: string = vandaagNL()): string | null {
  if (typeof datum !== "string" || !datum) return "Kies een opzegdatum.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datum) || Number.isNaN(Date.parse(datum))) return "Kies een geldige opzegdatum.";
  if (datum < vandaag) return "De opzegdatum kan niet in het verleden liggen. De vroegste datum is vandaag.";
  if (datum > plusDagen(vandaag, OPZEG_MAX_DAGEN_VOORUIT)) return `Kies een datum binnen ${OPZEG_MAX_DAGEN_VOORUIT} dagen.`;
  return null;
}

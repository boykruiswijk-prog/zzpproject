// Nederlands telefoonnummer: accepteert 06…, +31…, 0031…, met spaties of streepjes.
// Gedeeld door frontend-formulieren en Edge Functions.

const schoon = (v: string) => v.replace(/[\s-]/g, "");

export function isNlTelefoon(v: string): boolean {
  return /^(\+31|0031|0)[1-9][0-9]{8}$/.test(schoon(v ?? ""));
}

/** Normaliseert naar 10 cijfers met voorloop-0 (bv. 0612345678); onbekend formaat blijft ongewijzigd. */
export function normaliseerNlTelefoon(v: string): string {
  const s = schoon(v ?? "");
  if (!isNlTelefoon(s)) return (v ?? "").trim();
  return s.replace(/^(\+31|0031)/, "0");
}

/** NL of internationaal nummer (+ of 00, 8 tot 15 cijfers); zelfde regel als SQL telefoon_normaliseer. */
export function normaliseerTelefoon(v: string): string | null {
  const s = (v ?? "").replace(/[\s().-]/g, "");
  if (/^(\+31|0031|0)[1-9][0-9]{8}$/.test(s)) return s.replace(/^(\+31|0031)/, "0");
  if (/^(\+|00)[1-9][0-9]{7,14}$/.test(s)) return s.replace(/^00/, "+");
  return null;
}

export function isGeldigTelefoon(v: string): boolean {
  return normaliseerTelefoon(v) !== null;
}

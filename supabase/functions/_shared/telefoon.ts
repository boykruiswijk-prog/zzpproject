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

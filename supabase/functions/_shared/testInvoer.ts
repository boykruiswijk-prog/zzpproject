// Bekende placeholderinvoer (besluit Boy 3-11): telt als testinvoer, krijgt geen herinnering of melding
// en telt niet mee. Bewust een smalle, exacte lijst zodat echte klanten nooit geraakt worden.
// Geen Deno- of browser-API's; gedeeld met vitest.

export const PLACEHOLDER_TELEFOONS = ["0612345678", "0600000000", "0123456789"] as const;
export const PLACEHOLDER_EMAILS = ["jan@bed.nl", "test@test.nl"] as const;
export const PLACEHOLDER_DOMEINEN = ["example.com", "example.org", "example.net", "example.nl", "voorbeeld.nl", "voorbeeld.com"] as const;

function normTelefoon(t: string): string {
  let d = t.replace(/[^\d+]/g, "");
  if (d.startsWith("+31")) d = "0" + d.slice(3);
  else if (d.startsWith("0031")) d = "0" + d.slice(4);
  return d;
}

export function isPlaceholderTelefoon(t: string | null | undefined): boolean {
  return !!t && (PLACEHOLDER_TELEFOONS as readonly string[]).includes(normTelefoon(t));
}

export function isPlaceholderEmail(e: string | null | undefined): boolean {
  const s = (e ?? "").trim().toLowerCase();
  if (!s.includes("@")) return false;
  if ((PLACEHOLDER_EMAILS as readonly string[]).includes(s)) return true;
  const domein = s.split("@").pop() ?? "";
  return (PLACEHOLDER_DOMEINEN as readonly string[]).includes(domein);
}

/** Testinvoer als e-mail of telefoon een bekende placeholder is. */
export function isTestInvoer(v: { email?: string | null; telefoon?: string | null }): boolean {
  return isPlaceholderEmail(v.email) || isPlaceholderTelefoon(v.telefoon);
}

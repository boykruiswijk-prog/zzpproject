// Alleen een geldig e-mailadres mag als reply_to of ontvanger worden gebruikt.
// Leeg, "-" of onvolledig geeft undefined, zodat de mail zonder reply_to gaat.
const EMAIL_RE = /^[^\s@<>(),;:"\[\]]+@[^\s@<>(),;:"\[\]]+\.[A-Za-z]{2,}$/;

export function geldigEmail(waarde: unknown): string | undefined {
  if (typeof waarde !== "string") return undefined;
  const e = waarde.trim();
  return e.length <= 254 && EMAIL_RE.test(e) ? e : undefined;
}

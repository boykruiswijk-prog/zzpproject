// Eén plek waar de paginatitel wordt opgemaakt, zodat de merknaam nooit
// dubbel in de <title> terechtkomt en de titel onder de 60 tekens blijft.

const BRAND = "ZP Zaken";
const MAX_LENGTH = 60;

/** Segmenten die als branding worden gezien en dus mogen verdwijnen. */
const BRANDING = new Set(["zp zaken", "zpzaken", "zpzaken.nl", "kennisbank"]);

function shorten(subject: string, budget: number): string {
  if (subject.length <= budget) return subject;
  const cut = subject.slice(0, budget);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 20 ? cut.slice(0, lastSpace) : cut).replace(/[\s,–-]+$/, "");
}

/**
 * Maakt van een ruwe titel één titel met precies één merknaam achteraan.
 * Bestaande branding- en Kennisbank-segmenten worden verwijderd.
 */
export function formatPageTitle(rawTitle: string): string {
  const segments = rawTitle
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
  const kept = segments.filter((s) => !BRANDING.has(s.toLowerCase()));
  const subject = (kept.length ? kept.join(" - ") : segments[0] || BRAND).trim();

  const suffix = ` | ${BRAND}`;
  if (subject === BRAND) return BRAND;
  return `${shorten(subject, MAX_LENGTH - suffix.length)}${suffix}`;
}

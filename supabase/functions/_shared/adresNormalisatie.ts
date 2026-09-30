// Pure adresnormalisatie voor publieke intakeformulieren (BAV, screening, online-aanvraag).
// Wordt vóór legBewijsVast toegepast, zodat lead, SEPA-bewijs, PDF en Exact hetzelfde adres krijgen.

const TUSSENVOEGSELS = new Set(["van", "de", "den", "der", "het", "'t", "’t", "'s", "’s", "ten", "ter", "te"]);

/** Trim + dubbele spaties samenvoegen. */
export function schoonTekst(v: string | null | undefined): string {
  return (v ?? "").replace(/\s+/g, " ").trim();
}

/** Alleen de eerste letter hoofdletter als die a–z is en het eerste woord geen tussenvoegsel is. */
export function hoofdletterStraatOfPlaats(v: string | null | undefined): string {
  const s = schoonTekst(v);
  if (!s || !/^[a-z]/.test(s)) return s;
  const eersteWoord = s.split(" ")[0];
  if (TUSSENVOEGSELS.has(eersteWoord)) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function isNederland(land: string | null | undefined): boolean {
  const l = schoonTekst(land).toLowerCase();
  return l === "" || l === "nl" || l === "nederland" || l === "the netherlands" || l === "netherlands";
}

/** NL-postcode als "1234 AB"; andere waarden alleen opgeschoond. */
export function normaliseerPostcode(v: string | null | undefined, land?: string | null): string {
  const s = schoonTekst(v);
  if (!isNederland(land)) return s;
  const m = s.replace(/\s/g, "").match(/^([1-9][0-9]{3})([a-zA-Z]{2})$/);
  return m ? `${m[1]} ${m[2].toUpperCase()}` : s;
}

export interface AdresVelden {
  straat?: string | null;
  huisnummer?: string | null;
  postcode?: string | null;
  plaats?: string | null;
  land?: string | null;
}

export function normaliseerAdres<T extends AdresVelden>(a: T): T & Required<Pick<AdresVelden, "straat" | "huisnummer" | "postcode" | "plaats">> {
  return {
    ...a,
    straat: hoofdletterStraatOfPlaats(a.straat),
    huisnummer: schoonTekst(a.huisnummer),
    postcode: normaliseerPostcode(a.postcode, a.land),
    plaats: hoofdletterStraatOfPlaats(a.plaats),
    ...(a.land !== undefined ? { land: schoonTekst(a.land) } : {}),
  } as T & Required<Pick<AdresVelden, "straat" | "huisnummer" | "postcode" | "plaats">>;
}

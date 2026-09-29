// Enige bron van waarheid voor bedrijfsgegevens van ZP Zaken B.V. binnen
// Edge Functions. Spiegel van src/config/site.ts — wijzig beide bij een update.
export const COMPANY = {
  legalName: "ZP Zaken B.V.",
  website: "zpzaken.nl",
  url: "https://zpzaken.nl",
  email: "info@zpzaken.nl",
  emailAdministratie: "administratie@zpzaken.nl",
  phoneDisplay: "020 - 457 3077",
  phoneCompact: "020-4573077",
  address: {
    streetAddress: "Tupolevlaan 41",
    postalCode: "1119 NW",
    addressLocality: "Schiphol-Rijk",
    addressCountry: "Nederland",
  },
  // SEPA Incassant-ID (Creditor Identifier). NOG LEEG: komt van de administratie.
  // Zolang leeg weigeren process-bav-wizard en process-screening-aanvraag elke
  // aanvraag met machtiging, zodat er nooit een machtiging zonder ID wordt vastgelegd.
  // Spiegel: src/config/site.ts (incassantId).
  incassantId: "NL03ZZZ621170920000",
  registrations: {
    afm: "12050636",
    kvk: "62117092",
    kifid: "300.019283",
    btw: "NL854662431B01",
    iban: "NL25 ABNA 0477 3302 23",
  },
} as const;

/** "1119 NW Schiphol-Rijk" */
export const COMPANY_CITY_LINE = `${COMPANY.address.postalCode} ${COMPANY.address.addressLocality}`;

// Toegestane basis-URL's voor links/redirects in klantmails. Andere Origins → COMPANY.url.
export const ALLOWED_APP_ORIGINS = [
  "https://zpzaken.nl",
  "https://www.zpzaken.nl",
  "https://zzpproject.lovable.app",
  "https://id-preview--2e030441-024b-4841-be4b-93d91e428fb6.lovable.app",
];
export function safeAppOrigin(origin: string | null | undefined): string {
  const o = (origin ?? "").replace(/\/$/, "");
  return ALLOWED_APP_ORIGINS.includes(o) ? o : COMPANY.url;
}

/** "Tupolevlaan 41, 1119 NW Schiphol-Rijk, Nederland" */
export const COMPANY_ADDRESS_FULL = `${COMPANY.address.streetAddress}, ${COMPANY.address.postalCode} ${COMPANY.address.addressLocality}, ${COMPANY.address.addressCountry}`;

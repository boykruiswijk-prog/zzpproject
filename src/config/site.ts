// Sitewide configuration. Enige bron van waarheid voor alle bedrijfsgegevens
// van ZP Zaken B.V. Waarden hier wijzigen werkt door in de hele frontend.
// Voor Edge Functions staat dezelfde set in supabase/functions/_shared/company.ts.
export const SITE_CONFIG = {
  name: "ZP Zaken",
  legalName: "ZP Zaken B.V.",
  url: "https://zpzaken.nl",
  logo: "https://zpzaken.nl/logo.png",
  ogImage: "https://zpzaken.nl/og-image.jpg",
  email: "info@zpzaken.nl",
  emailPrivacy: "privacy@zpzaken.nl",
  emailAdministratie: "administratie@zpzaken.nl",
  phone: "+31204573077",
  phoneDisplay: "020 - 457 3077",
  phoneTel: "0204573077",
  whatsapp: "+31652064589",
  whatsappDisplay: "06 - 5206 4589",
  whatsappUrl: "https://wa.me/31652064589",
  address: {
    streetAddress: "Tupolevlaan 41",
    postalCode: "1119 NW",
    addressLocality: "Schiphol-Rijk",
    addressCountry: "NL",
  },
  geo: { latitude: 52.2796022, longitude: 4.7514364 },
  registrations: {
    afm: "12050636",
    kvk: "62117092",
    kifid: "300.019283",
    btw: "NL854662431B01",
    iban: "NL25 ABNA 0477 3302 23",
  },
  // TODO: verifieer onderstaande social URLs voor ZP Zaken
  social: {
    linkedin: "https://www.linkedin.com/company/zp-zaken",
    instagram: "https://www.instagram.com/zp_zaken",
  },
} as const;

/** "Tupolevlaan 41, 1119 NW Schiphol-Rijk" */
export const ADDRESS_ONE_LINE = `${SITE_CONFIG.address.streetAddress}, ${SITE_CONFIG.address.postalCode} ${SITE_CONFIG.address.addressLocality}`;

/** "Tupolevlaan 41, Schiphol-Rijk" */
export const ADDRESS_SHORT = `${SITE_CONFIG.address.streetAddress}, ${SITE_CONFIG.address.addressLocality}`;

/** "1119 NW Schiphol-Rijk" */
export const ADDRESS_CITY_LINE = `${SITE_CONFIG.address.postalCode} ${SITE_CONFIG.address.addressLocality}`;

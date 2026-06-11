// Sitewide configuration. Update social URLs once verified.
export const SITE_CONFIG = {
  name: "ZP Zaken",
  legalName: "ZP Zaken B.V.",
  url: "https://zpzaken.nl",
  logo: "https://zpzaken.nl/logo.png",
  ogImage: "https://zpzaken.nl/og-image.jpg",
  email: "info@zpzaken.nl",
  phone: "+31204573077",
  phoneDisplay: "020 - 457 3077",
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
  },
  // TODO: verifieer onderstaande social URLs voor ZP Zaken
  social: {
    linkedin: "https://www.linkedin.com/company/zp-zaken",
    instagram: "https://www.instagram.com/zp_zaken",
  },
} as const;

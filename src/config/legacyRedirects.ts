// Enige bron van waarheid voor legacy (WordPress) URL-redirects.
// Gebruikt door:
//  - src/App.tsx        → client-side <Navigate> vangnet
//  - src/pages/NotFound.tsx → client-side vangnet
//  - vite.config.ts (redirectsPlugin) → public/_redirects (Netlify-formaat)
// Let op: dit bestand mag geen imports of aliassen gebruiken.

export interface LegacyRedirect {
  /** Pad zonder leading slash, zoals de oude WordPress-URL. */
  from: string;
  /** Nieuwe route, met leading slash. */
  to: string;
}

export const legacyRedirects: LegacyRedirect[] = [
  // Oude WordPress rubrieken
  { from: "belastingen", to: "/kennisbank" },
  { from: "ondernemen", to: "/kennisbank" },
  { from: "financien", to: "/kennisbank" },
  { from: "verzekeringen-info", to: "/kennisbank" },
  { from: "wet-en-regelgeving", to: "/kennisbank/wet-en-regelgeving" },
  { from: "movir", to: "/verzekeringen" },
  { from: "wijzijnaov", to: "/verzekeringen" },
  { from: "aov-via-centraalbeheer", to: "/verzekeringen" },
  { from: "sharepeople", to: "/partners" },
  { from: "eherkenning", to: "/kennisbank" },

  // Oude artikel-URL's
  { from: "verplichte-aov-voor-zzp", to: "/kennisbank/aov-arbeidsongeschiktheidsverzekering" },
  { from: "nieuwe-regels-zzp", to: "/kennisbank/nieuwe-regels-zzp-2025" },
  { from: "zelfstandigenwet-voor-zzp-ers", to: "/kennisbank/zelfstandigenwet-voor-zzp-ers" },
  {
    from: "vbar-wet-verduidelijking-beoordeling-arbeidsrelaties-en-rechtsvermoeden",
    to: "/kennisbank/vbar-wet-verduidelijking-arbeidsrelaties",
  },
  { from: "kleineondernemersregeling-kor", to: "/kennisbank/wijziging-kleineondernemersregeling-kor-2025" },
  { from: "wet-deregulering-beoordeling-arbeidsrelaties-dba", to: "/kennisbank/wet-dba-alles-wat-je-moet-weten" },
  { from: "hoeveel-opdrachtgevers-zzp", to: "/kennisbank" },
  { from: "alles-over-een-zzp-factuur", to: "/kennisbank" },
  { from: "inschrijven-bij-de-kamer-van-koophandel", to: "/kennisbank" },
  { from: "zzp-administratie-en-boekhouding", to: "/diensten" },
  { from: "hoe-bereken-ik-bijtelling-als-zzper", to: "/kennisbank" },
  { from: "is-eten-en-drinken-aftrekbaar-als-zzp-er", to: "/kennisbank" },
  { from: "hoe-zit-het-met-reiskosten-als-zzp-er", to: "/kennisbank" },
  { from: "uurtarief-berekenen-zzper", to: "/kennisbank" },
  {
    from: "hoeveel-kan-je-als-zzp-er-verdienen-zonder-belasting-te-moeten-betalen",
    to: "/kennisbank",
  },

  // Oude webshop-resten
  { from: "winkel", to: "/" },
  { from: "shop", to: "/" },
  { from: "product", to: "/" },
  { from: "mijn-account", to: "/" },
  { from: "my-account", to: "/" },

  // Bestaande zpzaken.nl URL's → nieuwe routes
  // Live WordPress-URL heeft een koppelteken tussen "bedrijfs" en
  // "aansprakelijkheidsverzekering"; beide varianten opgenomen.
  { from: "beroeps-en-bedrijfs-aansprakelijkheidsverzekering-zzp-avb-bav", to: "/verzekeringen" },
  { from: "beroeps-en-bedrijfsaansprakelijkheidsverzekering-zzp-avb-bav", to: "/verzekeringen" },
  // LET OP — wijziging staat klaar, mag pas actief worden bij publicatie van het
  // kennisbankartikel "bijdrage-zorgverzekeringswet-zzp" (staat nu op concept).
  // Zodra het artikel gepubliceerd is: onderstaande regel vervangen door
  //   { from: "bijdrage-zorgverzekeringswet-zzp", to: "/kennisbank/bijdrage-zorgverzekeringswet-zzp" },
  // Nu bewust nog naar /zorgverzekering, omdat dit bestand ook het statische
  // public/_redirects genereert en een redirect naar een concept een 404 zou geven.
  { from: "bijdrage-zorgverzekeringswet-zzp", to: "/zorgverzekering" },
  { from: "zzp-zorgverzekering", to: "/zorgverzekering" },
  { from: "mentale-gezondheidstest-mirro", to: "/mentale-gezondheid" },
  { from: "help-andere-zzpers", to: "/contact" },
  { from: "go/algemene-voorwaarden-zp", to: "/algemene-voorwaarden" },
  { from: "go/privacy-statement", to: "/cookies" },
  { from: "zpzakenaov-movir", to: "/aov" },
  { from: "arbeidsongeschiktheidsverzekering-aov-zzp", to: "/aov" },
  { from: "alles-over-verzekeringen-voor-zzpers", to: "/verzekeringen" },
  { from: "een-aov-bij-movir-aanvragen", to: "/aov" },
  { from: "contact-zpzaken", to: "/contact" },
  { from: "neem-gerust-contact-op", to: "/contact" },

  // Gangbare WordPress URL-patronen
  { from: "bav-verzekering", to: "/verzekeringen" },
  { from: "avb-verzekering", to: "/verzekeringen" },
  { from: "bav-avb", to: "/verzekeringen" },
  { from: "zzp-verzekering", to: "/verzekeringen" },
  { from: "zzp-verzekeringen", to: "/verzekeringen" },
  { from: "verzekering-zzp", to: "/verzekeringen" },
  { from: "aov-zzp", to: "/aov" },
  { from: "zzp-aov", to: "/aov" },
  { from: "pensioen-zzp", to: "/pensioen" },
  { from: "zzp-pensioen", to: "/pensioen" },
  { from: "zorgverzekering-zzp", to: "/zorgverzekering" },
  { from: "gratis-advies", to: "/contact" },
  { from: "adviesgesprek", to: "/contact" },
  { from: "aanvragen", to: "/verzekeringen" },
  { from: "afsluiten", to: "/verzekeringen" },
  { from: "blog", to: "/kennisbank" },
  { from: "nieuws", to: "/kennisbank" },
  { from: "artikel", to: "/kennisbank" },
  { from: "over", to: "/over-ons" },
  { from: "team", to: "/over-ons" },
  { from: "wie-zijn-wij", to: "/over-ons" },
  { from: "privacy", to: "/cookies" },
  { from: "privacyverklaring", to: "/cookies" },
  { from: "voorwaarden", to: "/algemene-voorwaarden" },
  { from: "disclaimer", to: "/faq" },

  // Dubbele kennispagina: /kennis en /kennisbank deden hetzelfde
  { from: "kennis", to: "/kennisbank" },
];

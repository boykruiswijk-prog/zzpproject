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
  { from: "hoeveel-opdrachtgevers-zzp", to: "/kennisbank/wet-en-regelgeving" },
  { from: "alles-over-een-zzp-factuur", to: "/kennisbank/financien" },
  { from: "inschrijven-bij-de-kamer-van-koophandel", to: "/kennisbank" },
  { from: "zzp-administratie-en-boekhouding", to: "/kennisbank/financien" },
  { from: "hoe-bereken-ik-bijtelling-als-zzper", to: "/kennisbank/belastingen" },
  { from: "is-eten-en-drinken-aftrekbaar-als-zzp-er", to: "/kennisbank/belastingen" },
  { from: "hoe-zit-het-met-reiskosten-als-zzp-er", to: "/kennisbank/belastingen" },
  { from: "uurtarief-berekenen-zzper", to: "/kennisbank/financien" },
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
  // De bestemming beweegt automatisch mee met de publicatiestatus van het
  // artikel met dezelfde slug (zie resolveRedirectTarget). Zolang het artikel
  // op concept staat en niet zichtbaar is voor de anon-rol, geldt /zorgverzekering.
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
  // --- Ronde 2: rankende WordPress-URL's die nog geen redirect hadden ---
  // Voor deze slugs bestaat een kennisbankartikel. De bestemming wordt bij de
  // build bepaald door resolveRedirectTarget(): gepubliceerd → /kennisbank/<slug>,
  // concept → categoriepagina. De waarde hieronder is de handmatige terugval.
  { from: "auto-van-de-zaak-of-prive", to: "/kennisbank/belastingen" },
  { from: "zzp-of-eenmanszaak", to: "/kennisbank" },
  { from: "zzp-aftrekposten", to: "/kennisbank/belastingen" },
  { from: "zzp-er-met-een-bv-wat-zijn-de-voor-en-nadelen", to: "/kennisbank" },
  { from: "wet-toekomst-pensioenen-wtp-voor-zzp-ers", to: "/pensioen" },
  { from: "welke-verzekeringen-zzp", to: "/verzekeringen" },
  { from: "wat-kosten-verzekeringen-voor-zzp-ers", to: "/verzekeringen" },
  { from: "rijd-je-als-zzp-er-fiscaal-voordelig-met-een-youngtimer", to: "/kennisbank/belastingen" },
  { from: "voordelen-van-zzp", to: "/kennisbank" },
  { from: "hoe-combineer-je-loondienst-en-zzp", to: "/kennisbank/belastingen" },
  { from: "hoe-bereken-ik-mijn-inkomen-als-zzp-er-naast-loondienst", to: "/kennisbank/financien" },
  { from: "wat-is-de-zelfstandigenaftrek", to: "/kennisbank/belastingen" },
  { from: "cyberverzekering-zzp", to: "/verzekeringen" },
  { from: "zzp-en-belasting", to: "/kennisbank/belastingen" },
  { from: "starten-met-ondernemen-als-zzper", to: "/kennisbank" },
  { from: "wanneer-zelfstandig-ondernemer-voor-de-belastingdienst", to: "/kennisbank/belastingen" },
  { from: "ondernemingsplan", to: "/kennisbank" },
  { from: "wat-is-startersaftrek", to: "/kennisbank/belastingen" },
  { from: "wat-is-het-urencriterium", to: "/kennisbank/wet-en-regelgeving" },
  { from: "voor-en-nadelen-broodfonds-of-schenkkring", to: "/kennisbank/financien" },
  { from: "kleinschaligheidsinvesteringsaftrek-kia-voor-zzpers", to: "/kennisbank/belastingen" },
  { from: "schijnzelfstandigheid-als-zzp-er", to: "/kennisbank/wet-en-regelgeving" },
  { from: "btw-aangifte-zzp", to: "/kennisbank/belastingen" },
  { from: "hypotheek-berekenen-en-afsluiten-als-zzp-er", to: "/kennisbank/financien" },

  // Oude URL's zonder kennisbankartikel: vaste bestemming.
  { from: "moneysure-aov-alternatief", to: "/aov" },
  { from: "brightpensioen", to: "/pensioen" },
  // Geen /reviews-route in de app, daarom /contact.
  { from: "hoe-was-jouw-ervaring-met-zp-zaken", to: "/contact" },
  // Otentica is de screeningsleverancier achter /screening.
  { from: "merk/otentica", to: "/screening" },
  { from: "vacature-administrateur", to: "/over-ons" },
  { from: "verheij-groep-bv", to: "/over-ons" },
  { from: "test-2", to: "/" },
];

/**
 * Kennisbank-categoriepagina per categoriewaarde zoals die in de database
 * staat. Alleen deze vier categoriepagina's bestaan als route; alle overige
 * categorieën vallen terug op het kennisbankoverzicht.
 */
export const CATEGORY_PAGES: Record<string, string> = {
  fiscaal: "/kennisbank/belastingen",
  belastingen: "/kennisbank/belastingen",
  financien: "/kennisbank/financien",
  "financiën": "/kennisbank/financien",
  regelgeving: "/kennisbank/wet-en-regelgeving",
  wetgeving: "/kennisbank/wet-en-regelgeving",
  "wet-en-regelgeving": "/kennisbank/wet-en-regelgeving",
  ondernemen: "/kennisbank/ondernemen",
};

/** Categoriepagina voor een categoriewaarde, of /kennisbank als die niet bestaat. */
export function categoryPageFor(category?: string | null): string {
  if (!category) return "/kennisbank";
  return CATEGORY_PAGES[category.trim().toLowerCase()] || "/kennisbank";
}

export interface ArticleRedirectInfo {
  slug: string;
  category: string | null;
  is_published: boolean;
}

/**
 * Bestemming voor één legacy-URL, gegeven de artikelen uit de database.
 * - gepubliceerd artikel met dezelfde slug → /kennisbank/<slug>
 * - conceptartikel met dezelfde slug       → categoriepagina (of /kennisbank)
 * - geen artikel                           → handmatige bestemming
 */
export function resolveRedirectTarget(
  redirect: LegacyRedirect,
  articles: Map<string, ArticleRedirectInfo>,
): string {
  const article = articles.get(redirect.from);
  if (!article) return redirect.to;
  if (article.is_published) return `/kennisbank/${article.slug}`;
  return categoryPageFor(article.category);
}

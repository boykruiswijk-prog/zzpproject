// Enige bron van waarheid voor JSON-LD structured data.
// Bedrijfsgegevens komen uit SITE_CONFIG, premies uit bavPakketten.ts.
// Nooit bedrijfsgegevens of premies hardcoden in schema.

import { SITE_CONFIG } from "../config/site";
import { bavPakketten } from "../data/bavPakketten";

export const ORGANIZATION_ID = `${SITE_CONFIG.url}/#organization`;

export type JsonLd = Record<string, unknown>;

export interface BreadcrumbItem {
  name: string;
  /** Pad beginnend met "/" of volledige URL */
  url: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface ArticleSchemaInput {
  title: string;
  description: string;
  slug: string;
  datePublished: string;
  dateModified?: string | null;
  image?: string | null;
  category?: string | null;
  wordCount?: number;
}

function absolute(url: string) {
  if (/^https?:\/\//.test(url)) return url;
  return `${SITE_CONFIG.url}${url.startsWith("/") ? url : `/${url}`}`;
}

/** Prijsbereik afgeleid uit bavPakketten (nooit hardcoded). */
export function priceRange(): string {
  const prijzen = bavPakketten.map((p) => p.prijs);
  return `€${Math.min(...prijzen)} - €${Math.max(...prijzen)}`;
}

/** Publisher/author node, hergebruikt via @id zodat er één organisatie-entiteit blijft. */
export function organizationRef(): JsonLd {
  return {
    "@type": "InsuranceAgency",
    "@id": ORGANIZATION_ID,
    name: SITE_CONFIG.name,
    url: SITE_CONFIG.url,
    logo: { "@type": "ImageObject", url: SITE_CONFIG.logo },
  };
}

export function organizationSchema(extra: JsonLd = {}): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "InsuranceAgency",
    "@id": ORGANIZATION_ID,
    name: SITE_CONFIG.name,
    alternateName: SITE_CONFIG.legalName,
    legalName: SITE_CONFIG.legalName,
    url: SITE_CONFIG.url,
    logo: SITE_CONFIG.logo,
    image: SITE_CONFIG.ogImage,
    telephone: SITE_CONFIG.phone,
    email: SITE_CONFIG.email,
    vatID: SITE_CONFIG.registrations.btw,
    address: {
      "@type": "PostalAddress",
      streetAddress: SITE_CONFIG.address.streetAddress,
      postalCode: SITE_CONFIG.address.postalCode,
      addressLocality: SITE_CONFIG.address.addressLocality,
      addressCountry: SITE_CONFIG.address.addressCountry,
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: SITE_CONFIG.geo.latitude,
      longitude: SITE_CONFIG.geo.longitude,
    },
    sameAs: Object.values(SITE_CONFIG.social),
    priceRange: priceRange(),
    identifier: [
      { "@type": "PropertyValue", name: "AFM vergunningsnummer", value: SITE_CONFIG.registrations.afm },
      { "@type": "PropertyValue", name: "KvK-nummer", value: SITE_CONFIG.registrations.kvk },
      { "@type": "PropertyValue", name: "Kifid-aansluitnummer", value: SITE_CONFIG.registrations.kifid },
    ],
    areaServed: { "@type": "Country", name: "Netherlands" },
    ...extra,
  };
}

export function breadcrumbSchema(items: BreadcrumbItem[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absolute(item.url),
    })),
  };
}

export function faqSchema(items: FaqItem[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

type Pakket = (typeof bavPakketten)[number];

/** Product + Offer voor één BAV-pakket. Prijs uitsluitend uit bavPakketten.ts. */
export function productSchema(pakket: Pakket): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: pakket.name,
    description: `Beroeps- en bedrijfsaansprakelijkheidsverzekering voor zzp'ers${
      pakket.dekkingen.cyber ? " inclusief cyberdekking" : ""
    }. ${pakket.prijsLabel}.`,
    brand: organizationRef(),
    offers: {
      "@type": "Offer",
      priceCurrency: "EUR",
      price: String(pakket.prijs),
      availability: "https://schema.org/InStock",
      url: `${SITE_CONFIG.url}/verzekeringen`,
      seller: organizationRef(),
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        priceCurrency: "EUR",
        price: String(pakket.prijs),
        unitText: pakket.periode,
        description: pakket.prijsLabel,
      },
    },
  };
}

export function articleSchema(article: ArticleSchemaInput): JsonLd {
  const url = `${SITE_CONFIG.url}/kennisbank/${article.slug}`;
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.description,
    ...(article.image ? { image: [absolute(article.image)] } : {}),
    datePublished: article.datePublished,
    dateModified: article.dateModified || article.datePublished,
    author: organizationRef(),
    publisher: organizationRef(),
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    ...(article.category ? { articleSection: article.category } : {}),
    ...(article.wordCount ? { wordCount: article.wordCount } : {}),
    inLanguage: "nl-NL",
  };
}

/**
 * Zichtbare naam per publieke subpagina, gelijk aan de H1/navigatielabel.
 * Wordt door SEOHead gebruikt om automatisch BreadcrumbList te plaatsen.
 * Alleen paden zonder taalprefix; "/" heeft geen breadcrumb.
 */
export const BREADCRUMB_LABELS: Record<string, string> = {
  "/diensten": "Diensten",
  "/verzekeringen": "Verzekeringen",
  "/aov": "AOV",
  "/pensioen": "Pensioen",
  "/zorgverzekering": "Zorgverzekering",
  "/mentale-gezondheid": "Mentale gezondheid",
  "/waarom-zp-zaken": "Waarom ZP Zaken",
  "/voor-wie": "Voor wie",
  "/zo-werken-wij": "Zo werken wij",
  "/kennisbank": "Kennisbank",
  "/kennisbank/wet-en-regelgeving": "Wet en regelgeving",
  "/kennisbank/ondernemen": "Ondernemen",
  "/kennisbank/belastingen": "Belastingen",
  "/kennisbank/financien": "Financiën",
  "/over-ons": "Over ons",
  "/partners": "Partners",
  "/historie": "Historie",
  "/contact": "Contact",
  "/cookies": "Privacy en cookies",
  "/faq": "Veelgestelde vragen",
  "/algemene-voorwaarden": "Algemene voorwaarden",
  "/klachtenprocedure": "Klachtenprocedure",
  "/documenten": "Documenten",
  "/documenten/slotverklaring": "Slotverklaring",
  "/documenten/dienstverleningsdocument": "Dienstverleningsdocument",
  "/documenten/gedragscode": "Gedragscode",
  "/collectieve-inkoop": "Collectieve inkoop",
  "/social-media": "Social media",
  "/creditcontrol": "CreditControl",
  "/screening": "Screening",
  "/offerte": "Offerte aanvragen",
  "/zzp-verzekering-ict": "ZZP verzekering ICT",
  "/zzp-verzekering-zorg": "ZZP verzekering zorg",
  "/zzp-verzekering-bouw": "ZZP verzekering bouw",
};

/** BreadcrumbList voor een pad, of null als het pad geen breadcrumb heeft. */
export function breadcrumbForPath(path: string): JsonLd | null {
  const label = BREADCRUMB_LABELS[path];
  if (!label) return null;
  const items: BreadcrumbItem[] = [{ name: "Home", url: "/" }];
  const parent = path.split("/").slice(0, -1).join("/");
  if (parent && BREADCRUMB_LABELS[parent]) {
    items.push({ name: BREADCRUMB_LABELS[parent], url: parent });
  }
  items.push({ name: label, url: path });
  return breadcrumbSchema(items);
}

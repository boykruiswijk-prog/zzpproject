import { Helmet } from "react-helmet-async";
import { useLocation } from "react-router-dom";

interface SEOHeadProps {
  title: string;
  description: string;
  canonical?: string;
  ogType?: string;
  ogImage?: string;
  noindex?: boolean;
  children?: React.ReactNode;
}

const BASE_URL = "https://zpzaken.nl";
const SUPPORTED_LANGS = ["en", "de", "fr"];

export function SEOHead({
  title,
  description,
  canonical,
  ogType = "website",
  ogImage = `${BASE_URL}/favicon.webp`,
  noindex = false,
  children,
}: SEOHeadProps) {
  const { pathname } = useLocation();

  // Determine canonical URL - strip language prefix for default NL
  const cleanPath = pathname.replace(/^\/(en|de|fr)(\/|$)/, "/");
  const canonicalUrl = canonical || `${BASE_URL}${cleanPath === "/" ? "/" : cleanPath.replace(/\/$/, "")}`;

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonicalUrl} />

      {noindex && <meta name="robots" content="noindex, nofollow" />}

      {/* Open Graph */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:type" content={ogType} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:locale" content="nl_NL" />
      <meta property="og:site_name" content="ZP Zaken" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {/* Hreflang alternates */}
      <link rel="alternate" hrefLang="nl" href={`${BASE_URL}${cleanPath}`} />
      {SUPPORTED_LANGS.map((lang) => (
        <link
          key={lang}
          rel="alternate"
          hrefLang={lang}
          href={`${BASE_URL}/${lang}${cleanPath === "/" ? "/" : cleanPath}`}
        />
      ))}
      <link rel="alternate" hrefLang="x-default" href={`${BASE_URL}${cleanPath}`} />

      {children}
    </Helmet>
  );
}

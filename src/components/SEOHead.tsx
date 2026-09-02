import { Helmet } from "react-helmet-async";
import { useLocation } from "react-router-dom";
import { SITE_CONFIG } from "@/config/site";
import { breadcrumbForPath } from "@/lib/schema";

interface SEOHeadProps {
  title: string;
  description: string;
  canonical?: string;
  ogType?: string;
  ogImage?: string;
  noindex?: boolean;
  children?: React.ReactNode;
}

const BASE_URL = SITE_CONFIG.url;
export const SUPPORTED_LANGS = ["en", "de", "fr"] as const;

export function SEOHead({
  title,
  description,
  canonical,
  ogType = "website",
  ogImage = SITE_CONFIG.ogImage,
  noindex = false,
  children,
}: SEOHeadProps) {
  const { pathname } = useLocation();

  // Pad zonder taalprefix, gebruikt voor de hreflang-set.
  const cleanPath = pathname.replace(/^\/(en|de|fr)(\/|$)/, "/");
  // Canonical is self-referencing: /en/verzekeringen → https://zpzaken.nl/en/verzekeringen
  const selfPath = pathname === "/" ? "/" : pathname.replace(/\/$/, "");
  const canonicalUrl = canonical || `${BASE_URL}${selfPath}`;
  const nlPath = cleanPath === "/" ? "/" : cleanPath.replace(/\/$/, "");
  // BreadcrumbList automatisch per subpagina (nooit op de homepage).
  const breadcrumb = noindex ? null : breadcrumbForPath(nlPath);

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      {/* Geen canonical op noindex-pagina's: dat geeft tegenstrijdige signalen. */}
      {!noindex && <link rel="canonical" href={canonicalUrl} />}


      {noindex && <meta name="robots" content="noindex, nofollow" />}

      {/* Open Graph */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:type" content={ogType} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:locale" content="nl_NL" />
      <meta property="og:site_name" content={SITE_CONFIG.name} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {/* Hreflang alternates — niet op noindex-pagina's (die bestaan niet per taal) */}
      {!noindex && <link rel="alternate" hrefLang="nl" href={`${BASE_URL}${nlPath}`} />}
      {!noindex &&
        SUPPORTED_LANGS.map((lang) => (
          <link
            key={lang}
            rel="alternate"
            hrefLang={lang}
            href={`${BASE_URL}/${lang}${nlPath === "/" ? "" : nlPath}`}
          />
        ))}
      {!noindex && <link rel="alternate" hrefLang="x-default" href={`${BASE_URL}${nlPath}`} />}

      {breadcrumb && (
        <script type="application/ld+json">{JSON.stringify(breadcrumb)}</script>
      )}

      {children}
    </Helmet>
  );
}

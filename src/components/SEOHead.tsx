import { Helmet } from "react-helmet-async";
import { useLocation } from "react-router-dom";
import { SITE_CONFIG } from "@/config/site";
import { breadcrumbForPath } from "@/lib/schema";
import { formatPageTitle } from "@/lib/seoTitle";

interface SEOHeadProps {
  title: string;
  description: string;
  canonical?: string;
  ogType?: string;
  ogImage?: string;
  noindex?: boolean;
  robots?: string;
  exactTitle?: boolean;
  suppressBreadcrumb?: boolean;
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
  noindex: noindexProp = false,
  robots,
  exactTitle = false,
  suppressBreadcrumb = false,
  children,
}: SEOHeadProps) {
  const { pathname } = useLocation();
  // Taalversies /en, /de, /fr worden niet geïndexeerd (alleen Nederlands).
  const noindex = noindexProp || /^\/(en|de|fr)(\/|$)/.test(pathname);
  // Eén merknaam achteraan; zie formatPageTitle.
  const pageTitle = exactTitle ? title : formatPageTitle(title);

  // Pad zonder taalprefix (voor de breadcrumb).
  const cleanPath = pathname.replace(/^\/(en|de|fr)(\/|$)/, "/");
  // Canonical is self-referencing: /en/verzekeringen → https://zpzaken.nl/en/verzekeringen
  const selfPath = pathname === "/" ? "/" : pathname.replace(/\/$/, "");
  const canonicalUrl = canonical || `${BASE_URL}${selfPath}`;
  const nlPath = cleanPath === "/" ? "/" : cleanPath.replace(/\/$/, "");
  // BreadcrumbList automatisch per subpagina (nooit op de homepage).
  const breadcrumb = noindex || suppressBreadcrumb ? null : breadcrumbForPath(nlPath);

  return (
    <Helmet>
      <title>{pageTitle}</title>
      <meta name="description" content={description} />
      {/* Geen canonical op noindex-pagina's: dat geeft tegenstrijdige signalen. */}
      {!noindex && <link rel="canonical" href={canonicalUrl} />}


      {(robots || noindex) && <meta name="robots" content={robots || "noindex, follow"} />}

      {/* Open Graph */}
      <meta property="og:title" content={pageTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:type" content={ogType} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:type" content="image/jpeg" />
      <meta property="og:image:alt" content={exactTitle ? "ZP Zaken" : "ZP Zaken – BAV & AVB voor zzp'ers"} />
      <meta property="og:locale" content="nl_NL" />
      <meta property="og:site_name" content={SITE_CONFIG.name} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={pageTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {breadcrumb && (
        <script type="application/ld+json">{JSON.stringify(breadcrumb)}</script>
      )}

      {children}
    </Helmet>
  );
}

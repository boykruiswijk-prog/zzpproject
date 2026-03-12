import { Helmet } from "react-helmet-async";

interface SEOHeadProps {
  title: string;
  description: string;
  canonical?: string;
  type?: "website" | "article";
  schema?: object;
  noindex?: boolean;
}

export function SEOHead({
  title,
  description,
  canonical,
  type = "website",
  schema,
  noindex = false,
}: SEOHeadProps) {
  const siteUrl = "https://zpzaken.nl";
  const fullCanonical = canonical ? `${siteUrl}${canonical}` : siteUrl;

  const defaultSchema = {
    "@context": "https://schema.org",
    "@type": "InsuranceAgency",
    name: "ZP Zaken",
    url: siteUrl,
    description: "ZP Zaken helpt ZZP'ers aan de juiste beroeps- en bedrijfsaansprakelijkheidsverzekering. Binnen 24 uur verzekerd.",
    address: {
      "@type": "PostalAddress",
      addressCountry: "NL",
    },
    areaServed: "NL",
    knowsAbout: [
      "Beroepsaansprakelijkheidsverzekering",
      "Bedrijfsaansprakelijkheidsverzekering",
      "ZZP verzekeringen",
      "AOV",
    ],
  };

  const activeSchema = schema ?? defaultSchema;

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={fullCanonical} />
      {noindex && <meta name="robots" content="noindex, nofollow" />}

      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={type} />
      <meta property="og:url" content={fullCanonical} />
      <meta property="og:site_name" content="ZP Zaken" />
      <meta property="og:locale" content="nl_NL" />

      <meta name="twitter:card" content="summary" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />

      <script type="application/ld+json">
        {JSON.stringify(activeSchema)}
      </script>
    </Helmet>
  );
}
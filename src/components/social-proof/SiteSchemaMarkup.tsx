import { Helmet } from "react-helmet-async";
import { SITE_CONFIG } from "@/config/site";
import { googleReviewsData } from "@/data/googleReviews";

export function SiteSchemaMarkup() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "InsuranceAgency",
    "@id": `${SITE_CONFIG.url}/#organization`,
    name: SITE_CONFIG.name,
    alternateName: SITE_CONFIG.legalName,
    url: SITE_CONFIG.url,
    logo: SITE_CONFIG.logo,
    image: SITE_CONFIG.ogImage,
    description:
      "ZP Zaken is al 10+ jaar dé onafhankelijke adviseur voor zzp'ers. BAV, AVB, AOV en meer. Persoonlijk gesprek, scherpe premies.",
    telephone: SITE_CONFIG.phone,
    email: SITE_CONFIG.email,
    address: {
      "@type": "PostalAddress",
      ...SITE_CONFIG.address,
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: SITE_CONFIG.geo.latitude,
      longitude: SITE_CONFIG.geo.longitude,
    },
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        opens: "09:00",
        closes: "18:00",
      },
    ],
    sameAs: [SITE_CONFIG.social.linkedin, SITE_CONFIG.social.instagram],
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: googleReviewsData.averageRating.toFixed(1),
      reviewCount: String(googleReviewsData.totalReviews),
      bestRating: "5",
      worstRating: "1",
    },
    review: googleReviewsData.reviews.map((r) => ({
      "@type": "Review",
      author: { "@type": "Person", name: r.name },
      reviewRating: {
        "@type": "Rating",
        ratingValue: String(r.rating),
        bestRating: "5",
      },
      reviewBody: r.text,
    })),
    areaServed: {
      "@type": "Country",
      name: "Netherlands",
    },
    knowsAbout: [
      "Bedrijfsaansprakelijkheidsverzekering",
      "Beroepsaansprakelijkheidsverzekering",
      "Arbeidsongeschiktheidsverzekering",
      "ZZP verzekeringen",
      "Wet DBA",
    ],
  };

  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(schema)}</script>
    </Helmet>
  );
}

import { Helmet } from "react-helmet-async";
import { googleReviewsData } from "@/data/googleReviews";
import { ORGANIZATION_ID } from "@/lib/schema";

export function SiteSchemaMarkup() {
  // Alle bedrijfsgegevens en het prijsbereik komen uit src/lib/schema.ts (SITE_CONFIG + bavPakketten).
  // De volledige InsuranceAgency-entiteit staat in index.html. Hier alleen een
  // verrijking van diezelfde @id-node, zodat er één entiteit per pagina blijft.
  const schema = {
    "@context": "https://schema.org",
    "@id": ORGANIZATION_ID,
    description:
      "ZP Zaken is al 10+ jaar dé onafhankelijke adviseur voor zzp'ers. BAV, AVB, AOV en meer. Persoonlijk gesprek, scherpe premies.",
    foundingDate: "2014",
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        opens: "09:00",
        closes: "18:00",
      },
    ],
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
      reviewRating: { "@type": "Rating", ratingValue: String(r.rating), bestRating: "5" },
      reviewBody: r.text,
    })),
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

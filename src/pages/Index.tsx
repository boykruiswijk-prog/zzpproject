import { LocalizedLink } from "@/components/LocalizedLink";
import { Layout } from "@/components/layout/Layout";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { ArrowRight, Shield, Clock, ThumbsUp, CheckCircle } from "lucide-react";

export default function Index() {
  return (
    <Layout>
      <SEOHead
        title="ZP Zaken | BAV & AVB Verzekering voor ZZP'ers | Binnen 24 uur"
        description="Sluit binnen 24 uur je beroeps- of bedrijfsaansprakelijkheidsverzekering af. ZP Zaken is onafhankelijk verzekeringsadviseur voor alle ZZP'ers in Nederland."
        canonical="/"
        schema={{
          "@context": "https://schema.org",
          "@type": "InsuranceAgency",
          name: "ZP Zaken",
          url: "https://zpzaken.nl",
          description: "Onafhankelijk verzekeringsadvies voor ZZP'ers. BAV en AVB binnen 24 uur.",
          address: { "@type": "PostalAddress", addressCountry: "NL" },
          areaServed: "NL",
          hasOfferCatalog: {
            "@type": "OfferCatalog",
            name: "ZZP Verzekeringen",
            itemListElement: [
              { "@type": "Offer", itemOffered: { "@type": "Service", name: "Beroepsaansprakelijkheidsverzekering ZZP" } },
              { "@type": "Offer", itemOffered: { "@type": "Service", name: "Bedrijfsaansprakelijkheidsverzekering ZZP" } },
              { "@type": "Offer", itemOffered: { "@type": "Service", name: "AOV ZZP" } },
            ],
          },
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: "4.8",
            reviewCount: "47",
          },
        }}
      />

      {/* Hero */}
      <section className="bg-gradient-to-br from-primary via-primary to-primary/90 text-primary-foreground py-16 md:py-24">
        <div className="container-wide">
          <div className="max-w-3xl">
            <h1 className="mb-6">
              Zorgeloos ZZP'en begint met de juiste ver
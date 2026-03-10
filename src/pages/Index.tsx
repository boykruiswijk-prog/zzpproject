import { SEOHead } from "@/components/SEOHead";
import { Layout } from "@/components/layout/Layout";
import { HeroSection } from "@/components/home/HeroSection";
import { BAVApplicationModule } from "@/components/home/BAVApplicationModule";
import { ServicesSection } from "@/components/home/ServicesSection";
import { ProcessSection } from "@/components/home/ProcessSection";
import { PartnersSection } from "@/components/home/PartnersSection";
import { CombiPackageSection } from "@/components/home/CombiPackageSection";
import { TeamSection } from "@/components/home/TeamSection";
import { SocialProofSection } from "@/components/home/SocialProofSection";
import { CTASection } from "@/components/home/CTASection";

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "ZP Zaken",
  "url": "https://zpzaken.nl",
  "logo": "https://zpzaken.nl/favicon.png",
  "foundingDate": "2014",
  "description": "Onafhankelijk advies voor zzp'ers op het gebied van verzekeringen, administratie, juridisch advies en screening.",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "Tupolevlaan 41",
    "addressLocality": "Schiphol-Rijk",
    "addressCountry": "NL"
  },
  "contactPoint": {
    "@type": "ContactPoint",
    "telephone": "+31-23-201-0502",
    "contactType": "customer service",
    "availableLanguage": "Dutch"
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.9",
    "bestRating": "5",
    "worstRating": "1",
    "ratingCount": "2500"
  },
  "sameAs": []
};

const Index = () => {
  return (
    <Layout>
      <SEOHead
        title="ZP Zaken | Zorgeloos ZZP'en | Goedkoopste BAV & AVB"
        description="ZP Zaken is al 10+ jaar dé onafhankelijke adviseur voor zzp'ers. BAV, AVB, AOV en meer. Persoonlijk advies, scherpe premies. Binnen 24 uur verzekerd."
        canonical="https://zpzaken.nl/"
      >
        <script type="application/ld+json">{JSON.stringify(organizationSchema)}</script>
      </SEOHead>

      {/* 1. Eerste indruk */}
      <HeroSection />

      {/* 2. Directe conversie — BAV aanvraag */}
      <BAVApplicationModule />

      {/* 3. Wat bieden we aan */}
      <ServicesSection />

      {/* 4. Hoe werkt het */}
      <ProcessSection />

      {/* 5. Vertrouwen — partners */}
      <PartnersSection />

      {/* 6. Upsell — combipakket */}
      <CombiPackageSection />

      {/* 7. Menselijk & persoonlijk — team */}
      <TeamSection />

      {/* 8. Social proof — reviews */}
      <SocialProofSection />

      {/* 9. Laatste call to action */}
      <CTASection />
    </Layout>
  );
};

export default Index;

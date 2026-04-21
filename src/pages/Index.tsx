import { SEOHead } from "@/components/SEOHead";
import { Layout } from "@/components/layout/Layout";
import { HeroSection } from "@/components/home/HeroSection";
import { BAVApplicationModule } from "@/components/home/BAVApplicationModule";
import { CombiPackageSection } from "@/components/home/CombiPackageSection";
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
    "ratingCount": "5000"
  },
  "sameAs": []
};

const Index = () => {
  return (
    <Layout>
      <SEOHead
        title="ZP Zaken | BAV & AVB Verzekering voor ZZP'ers | Vanaf €30/maand"
        description="Onafhankelijke verzekeringsadviseur voor zzp'ers. Sluit direct online een BAV+AVB combinatieverzekering af. Geen eigen risico, dagelijks opzegbaar. AFM geregistreerd."
        canonical="https://zpzaken.nl/"
      >
        <script type="application/ld+json">{JSON.stringify(organizationSchema)}</script>
      </SEOHead>
      <HeroSection />
      <BAVApplicationModule />
      <CombiPackageSection />
      <SocialProofSection />
      <CTASection />
    </Layout>
  );
};

export default Index;
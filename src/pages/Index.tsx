import { Helmet } from "react-helmet-async";
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
    "ratingCount": "2500"
  },
  "sameAs": []
};

const Index = () => {
  return (
    <Layout>
      <Helmet>
        <title>ZP Zaken - Onafhankelijk advies voor zzp'ers | Verzekeringen & Zakelijke Zekerheid</title>
        <meta name="description" content="ZP Zaken is al 10+ jaar dé onafhankelijke adviseur voor zzp'ers. BAV, AVB, AOV en meer. Persoonlijk advies, scherpe premies. Binnen 24 uur verzekerd." />
        <link rel="canonical" href="https://zpzaken.nl/" />
        <meta property="og:title" content="ZP Zaken - Onafhankelijk advies voor zzp'ers" />
        <meta property="og:description" content="Al 10+ jaar dé onafhankelijke adviseur voor zzp'ers. BAV, AVB, AOV en meer." />
        <meta property="og:url" content="https://zpzaken.nl/" />
        <meta property="og:type" content="website" />
        <script type="application/ld+json">{JSON.stringify(organizationSchema)}</script>
      </Helmet>
      <HeroSection />
      <BAVApplicationModule />
      <CombiPackageSection />
      <SocialProofSection />
      <CTASection />
    </Layout>
  );
};

export default Index;
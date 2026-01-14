import { Layout } from "@/components/layout/Layout";
import { HeroSection } from "@/components/home/HeroSection";
import { CombiPackageSection } from "@/components/home/CombiPackageSection";
import { ServicesSection } from "@/components/home/ServicesSection";
import { ProcessSection } from "@/components/home/ProcessSection";
import { PartnersSection } from "@/components/home/PartnersSection";
import { SocialProofSection } from "@/components/home/SocialProofSection";
import { CTASection } from "@/components/home/CTASection";

const Index = () => {
  return (
    <Layout>
      <HeroSection />
      <CombiPackageSection />
      <ServicesSection />
      <ProcessSection />
      <PartnersSection />
      <SocialProofSection />
      <CTASection />
    </Layout>
  );
};

export default Index;

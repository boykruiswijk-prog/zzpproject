import { Layout } from "@/components/layout/Layout";
import { HeroSection } from "@/components/home/HeroSection";
import { BAVApplicationModule } from "@/components/home/BAVApplicationModule";
import { CombiPackageSection } from "@/components/home/CombiPackageSection";
import { SocialProofSection } from "@/components/home/SocialProofSection";
import { CTASection } from "@/components/home/CTASection";

const Index = () => {
  return (
    <Layout>
      <HeroSection />
      <BAVApplicationModule />
      <CombiPackageSection />
      <SocialProofSection />
      <CTASection />
    </Layout>
  );
};

export default Index;

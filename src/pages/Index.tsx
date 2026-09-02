import { seoRoute } from "@/config/seoRoutes";
import { SEOHead } from "@/components/SEOHead";
import { Layout } from "@/components/layout/Layout";
import { HeroSection } from "@/components/home/HeroSection";
import { HiscoxTrustStrip } from "@/components/home/HiscoxTrustStrip";
import { BAVApplicationModule } from "@/components/home/BAVApplicationModule";
import { CombiPackageSection } from "@/components/home/CombiPackageSection";
import { GoogleReviewsSection } from "@/components/social-proof/GoogleReviewsSection";
import { EllenAdvisorSection } from "@/components/home/EllenAdvisorSection";
import { CTASection } from "@/components/home/CTASection";

const SEO = seoRoute("/");

const Index = () => {
  return (
    <Layout>
      <SEOHead
        title={SEO.title}
        description={SEO.description}
      />
      <HeroSection />
      <HiscoxTrustStrip />
      <BAVApplicationModule />
      <CombiPackageSection />
      <EllenAdvisorSection />
      <GoogleReviewsSection />
      <CTASection />
    </Layout>
  );
};

export default Index;
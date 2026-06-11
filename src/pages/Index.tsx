import { SEOHead } from "@/components/SEOHead";
import { Layout } from "@/components/layout/Layout";
import { HeroSection } from "@/components/home/HeroSection";
import { HiscoxTrustStrip } from "@/components/home/HiscoxTrustStrip";
import { BAVApplicationModule } from "@/components/home/BAVApplicationModule";
import { CombiPackageSection } from "@/components/home/CombiPackageSection";
import { GoogleReviewsSection } from "@/components/social-proof/GoogleReviewsSection";
import { EllenAdvisorSection } from "@/components/home/EllenAdvisorSection";
import { CTASection } from "@/components/home/CTASection";

const Index = () => {
  return (
    <Layout>
      <SEOHead
        title="ZP Zaken | BAV & AVB Verzekering voor ZZP'ers | Vanaf €55/maand"
        description="Onafhankelijke verzekeringsadviseur voor zzp'ers. Sluit direct online een BAV+AVB combinatieverzekering af. Geen eigen risico, dagelijks opzegbaar. AFM geregistreerd."
        canonical="https://zpzaken.nl/"
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
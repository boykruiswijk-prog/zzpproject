import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Phone, Calendar, ArrowRight } from "lucide-react";
import { AnimatedSection, StaggerContainer, StaggerItem } from "@/components/ui/animated-section";
import { LocalizedLink } from "@/components/LocalizedLink";
import { StepsProcess } from "@/components/shared/StepsProcess";
import { MiniSocialProof } from "@/components/shared/MiniSocialProof";
import { trackCTA, trackPhone } from "@/lib/tracking";
import teamBoyCalling from "@/assets/team-boy-calling.jpg";

export function CTASection() {
  const { t } = useTranslation();

  return (
    <section className="relative section-padding overflow-hidden">
      <div className="absolute inset-0 z-0">
        <img src={teamBoyCalling} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-primary/95 via-primary/90 to-primary/85" />
      </div>

      <div className="container-wide relative z-10">
        <AnimatedSection className="max-w-2xl mx-auto text-center text-primary-foreground">
          <AnimatedSection delay={0.1}>
            <h2 className="mb-4 text-primary-foreground">{t("home.ctaTitle")}</h2>
          </AnimatedSection>
          <AnimatedSection delay={0.2}>
            <p className="text-primary-foreground/85 text-lg mb-8 max-w-xl mx-auto">
              {t("home.ctaSubtitle")}
            </p>
          </AnimatedSection>

          <AnimatedSection delay={0.3} className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
            <Button 
              size="xl" 
              className="bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg hover:scale-105 transition-transform duration-200"
              asChild
              onClick={() => trackCTA("cta_plan_gesprek")}
            >
              <LocalizedLink to="/contact">
                <Calendar className="h-5 w-5" />
                {t("home.planGesprek")}
                <ArrowRight className="h-5 w-5" />
              </LocalizedLink>
            </Button>
            <span className="text-primary-foreground/60 hidden sm:block">{t("home.of")}</span>
            <a 
              href="tel:0232010502" 
              className="inline-flex items-center gap-2 text-primary-foreground hover:text-primary-foreground transition-all font-medium border border-primary-foreground/40 rounded-lg px-4 py-2 hover:bg-primary-foreground/10 hover:scale-105 duration-200"
              onClick={() => trackPhone()}
            >
              <Phone className="h-4 w-4" />
              023 - 201 0502
            </a>
          </AnimatedSection>

          <AnimatedSection delay={0.35} className="mb-8">
            <MiniSocialProof variant="dark" className="justify-center" />
          </AnimatedSection>

          <StaggerContainer className="flex flex-wrap items-center justify-center gap-6 text-primary-foreground/70 text-sm mb-8" staggerDelay={0.1}>
            {[t("home.gratisVrijblijvend"), t("home.binnen24uur"), t("home.marktleider")].map((text) => (
              <StaggerItem key={text}>
                <span>✓ {text}</span>
              </StaggerItem>
            ))}
          </StaggerContainer>

          <AnimatedSection delay={0.5}>
            <StepsProcess variant="dark" />
          </AnimatedSection>
        </AnimatedSection>
      </div>
    </section>
  );
}

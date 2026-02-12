import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { CheckCircle, Shield, UserCheck, Headphones, Heart, ArrowRight } from "lucide-react";
import { AnimatedSection, StaggerContainer, StaggerItem } from "@/components/ui/animated-section";

export function CombiPackageSection() {
  const { t } = useTranslation();

  const benefits = [
    { icon: Shield, title: t("home.verzekeringen"), description: t("home.verzekeringenDesc") },
    { icon: UserCheck, title: t("home.screeningTitle"), description: t("home.screeningDesc") },
    { icon: Headphones, title: t("home.persoonlijkAdvies"), description: t("home.persoonlijkAdviesDesc") },
    { icon: Heart, title: t("home.menselijkeMaat"), description: t("home.menselijkeMaatDesc") },
  ];

  return (
    <section className="section-padding bg-background">
      <div className="container-wide">
        <AnimatedSection className="text-center max-w-xl mx-auto mb-10">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">
            {t("home.allUnderOneRoof")} <span className="text-accent">{t("home.allUnderOneRoofAccent")}</span>
          </h2>
          <p className="text-muted-foreground">{t("home.allUnderOneRoofDesc")}</p>
        </AnimatedSection>

        <StaggerContainer className="flex flex-wrap justify-center gap-8 md:gap-12 mb-10" staggerDelay={0.15}>
          {benefits.map((benefit) => (
            <StaggerItem key={benefit.title}>
              <div className="flex flex-col items-center text-center max-w-[140px] group">
                <div className="h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center mb-3 group-hover:scale-110 group-hover:bg-accent/20 transition-all duration-300">
                  <benefit.icon className="h-5 w-5 text-accent" />
                </div>
                <h3 className="font-medium text-sm mb-1">{benefit.title}</h3>
                <p className="text-xs text-muted-foreground">{benefit.description}</p>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>

        <AnimatedSection delay={0.3} className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground mb-8">
          {[t("home.betrouwbarePartners"), t("home.speciaalVoorZzp"), t("home.transparanteTarieven")].map((text) => (
            <span key={text} className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-accent" />
              {text}
            </span>
          ))}
        </AnimatedSection>

        <AnimatedSection delay={0.4} className="text-center">
          <Button variant="outline" size="lg" asChild className="hover:scale-105 transition-transform duration-200">
            <Link to="/diensten">
              {t("home.bekijkAlleDiensten")}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </AnimatedSection>
      </div>
    </section>
  );
}

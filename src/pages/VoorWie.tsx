import { LocalizedLink } from "@/components/LocalizedLink";
import { SEOHead } from "@/components/SEOHead";
import { useTranslation } from "react-i18next";
import { Layout } from "@/components/layout/Layout";
import { PageHero } from "@/components/layout/PageHero";
import { Button } from "@/components/ui/button";
import { ArrowRight, Monitor, Palette, Wrench, Stethoscope, Briefcase, Rocket, Users, Shield, CheckCircle } from "lucide-react";
import teamWalking from "@/assets/team-walking.jpg";
import teamCheers from "@/assets/team-cheers.jpg";

const audienceIcons = [Rocket, Briefcase, Monitor, Palette, Wrench, Stethoscope];
const audienceKeys = ["starters", "experienced", "ict", "creative", "construction", "healthcare"] as const;

export default function VoorWie() {
  const { t } = useTranslation();

  const audiences = audienceKeys.map((key, i) => ({
    icon: audienceIcons[i],
    title: t(`audiences.${key}`),
    description: t(`audiences.${key}Desc`),
    needs: t(`audiences.${key}Needs`, { returnObjects: true }) as string[],
  }));

  return (
    <Layout>
      <SEOHead
        title={`${t("voorWie.title")} ${t("voorWie.titleAccent")} | ZP Zaken`}
        description={t("voorWie.subtitle")}
      />

      <PageHero
        title={<>{t("voorWie.title")} <span className="text-accent">{t("voorWie.titleAccent")}</span>?</>}
        subtitle={t("voorWie.subtitle")}
        badge={{ icon: <Users className="h-4 w-4" />, text: t("voorWie.badge") }}
        backgroundImage={teamWalking}
      />

      <section className="section-padding bg-background">
        <div className="container-wide">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {audiences.map((audience) => (
              <div key={audience.title} className="bg-card rounded-2xl p-8 shadow-card border border-border/50 hover:shadow-lg hover:border-accent/30 transition-all duration-300">
                <div className="inline-flex items-center gap-3 bg-accent/10 border border-accent/20 px-4 py-2 rounded-xl mb-6">
                  <audience.icon className="h-5 w-5 text-accent" />
                  <h3 className="text-lg font-semibold">{audience.title}</h3>
                </div>
                <p className="text-muted-foreground mb-6">{audience.description}</p>
                <div className="flex flex-wrap gap-2 mb-6">
                  {audience.needs.map((need) => (
                    <span key={need} className="inline-flex items-center gap-1.5 bg-secondary text-foreground px-3 py-1.5 rounded-lg text-sm">
                      <CheckCircle className="h-3.5 w-3.5 text-accent" />{need}
                    </span>
                  ))}
                </div>
                <Button variant="outline" size="sm" className="w-full" asChild>
                  <LocalizedLink to="/contact">{t("voorWie.askAdvice")}<ArrowRight className="h-4 w-4" /></LocalizedLink>
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-padding text-primary-foreground relative overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img src={teamCheers} alt="" className="w-full h-full object-cover" aria-hidden="true" />
          <div className="absolute inset-0 bg-gradient-to-r from-primary/95 via-primary/90 to-primary/85" />
        </div>
        <div className="container-wide relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="mb-4">{t("voorWie.ctaTitle")}</h2>
            <div className="flex flex-wrap justify-center gap-3 mb-8">
              {(t("voorWie.ctaTags", { returnObjects: true }) as string[]).map((tag: string) => (
                <span key={tag} className="inline-flex items-center gap-2 bg-primary-foreground/10 backdrop-blur-sm border border-primary-foreground/20 text-primary-foreground px-4 py-2 rounded-full text-sm">
                  <Shield className="h-4 w-4 text-accent" />{tag}
                </span>
              ))}
            </div>
            <p className="text-lg text-primary-foreground/80 mb-8">{t("voorWie.ctaSubtitle")}</p>
            <Button variant="accent" size="lg" asChild>
              <LocalizedLink to="/contact">{t("voorWie.ctaButton")}<ArrowRight className="h-5 w-5" /></LocalizedLink>
            </Button>
          </div>
        </div>
      </section>
    </Layout>
  );
}

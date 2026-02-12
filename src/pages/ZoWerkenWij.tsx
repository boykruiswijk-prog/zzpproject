import { LocalizedLink } from "@/components/LocalizedLink";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { Layout } from "@/components/layout/Layout";
import { PageHero } from "@/components/layout/PageHero";
import { Button } from "@/components/ui/button";
import { ArrowRight, MessageCircle, FileSearch, CheckCircle, Clock, Heart, Shield, Users } from "lucide-react";

export default function ZoWerkenWij() {
  const { t } = useTranslation();

  const steps = [
    { number: "01", icon: MessageCircle, title: t("zoWerkenWij.step1Title"), description: t("zoWerkenWij.step1Desc"), details: t("zoWerkenWij.step1Details", { returnObjects: true }) as string[] },
    { number: "02", icon: FileSearch, title: t("zoWerkenWij.step2Title"), description: t("zoWerkenWij.step2Desc"), details: t("zoWerkenWij.step2Details", { returnObjects: true }) as string[] },
    { number: "03", icon: CheckCircle, title: t("zoWerkenWij.step3Title"), description: t("zoWerkenWij.step3Desc"), details: t("zoWerkenWij.step3Details", { returnObjects: true }) as string[] },
  ];

  const values = [
    { icon: Heart, title: t("zoWerkenWij.persoonlijk"), description: t("zoWerkenWij.persoonlijkDesc") },
    { icon: Shield, title: t("zoWerkenWij.onafhankelijk"), description: t("zoWerkenWij.onafhankelijkDesc") },
    { icon: Users, title: t("zoWerkenWij.directContact"), description: t("zoWerkenWij.directContactDesc") },
    { icon: Clock, title: t("zoWerkenWij.snelEfficient"), description: t("zoWerkenWij.snelEfficientDesc") },
  ];

  return (
    <Layout>
      <Helmet>
        <title>{t("zoWerkenWij.title")} | ZP Zaken</title>
        <meta name="description" content={t("zoWerkenWij.subtitle")} />
        <link rel="canonical" href="https://zpzaken.nl/zo-werken-wij" />
      </Helmet>

      <PageHero
        title={t("zoWerkenWij.title")}
        subtitle={t("zoWerkenWij.subtitle")}
        badge={{ icon: <MessageCircle className="h-4 w-4" />, text: t("zoWerkenWij.badge") }}
      />

      <section className="section-padding bg-background">
        <div className="container-wide">
          <div className="max-w-4xl mx-auto">
            {steps.map((step, index) => (
              <div key={step.number} className="relative">
                {index < steps.length - 1 && <div className="absolute left-7 top-20 bottom-0 w-0.5 bg-border" />}
                <div className="flex gap-8 pb-16">
                  <div className="relative flex-shrink-0">
                    <div className="h-14 w-14 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center">
                      <step.icon className="h-7 w-7 text-accent" />
                    </div>
                    <span className="absolute -top-2 -right-2 h-7 w-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">{step.number}</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-2xl font-semibold mb-3">{step.title}</h3>
                    <p className="text-muted-foreground mb-6 text-lg">{step.description}</p>
                    <div className="flex flex-wrap gap-2">
                      {step.details.map((detail) => (
                        <span key={detail} className="inline-flex items-center gap-2 bg-accent/10 border border-accent/20 text-foreground px-4 py-2 rounded-lg text-sm">
                          <CheckCircle className="h-4 w-4 text-accent" />{detail}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-padding bg-secondary">
        <div className="container-wide">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="mb-4">{t("zoWerkenWij.whyTitle")}</h2>
            <p className="text-lg text-muted-foreground">{t("zoWerkenWij.whySubtitle")}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-4">
            {values.map((value) => (
              <div key={value.title} className="inline-flex items-center gap-3 bg-card border border-border/50 shadow-sm px-5 py-4 rounded-xl">
                <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                  <value.icon className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <p className="font-semibold">{value.title}</p>
                  <p className="text-sm text-muted-foreground">{value.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-padding bg-primary text-primary-foreground">
        <div className="container-wide">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="mb-6">{t("zoWerkenWij.ctaTitle")}</h2>
            <div className="flex flex-wrap justify-center gap-3 mb-8">
              {(t("zoWerkenWij.ctaTags", { returnObjects: true }) as string[]).map((tag: string) => (
                <span key={tag} className="inline-flex items-center gap-2 bg-primary-foreground/10 backdrop-blur-sm border border-primary-foreground/20 text-primary-foreground px-4 py-2 rounded-full text-sm">
                  <Shield className="h-4 w-4 text-accent" />{tag}
                </span>
              ))}
            </div>
            <p className="text-lg text-primary-foreground/80 mb-8">{t("zoWerkenWij.ctaSubtitle")}</p>
            <Button variant="accent" size="lg" asChild>
              <LocalizedLink to="/contact">{t("zoWerkenWij.ctaButton")}<ArrowRight className="h-5 w-5" /></LocalizedLink>
            </Button>
          </div>
        </div>
      </section>
    </Layout>
  );
}

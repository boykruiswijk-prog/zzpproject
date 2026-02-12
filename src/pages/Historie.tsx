import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { Layout } from "@/components/layout/Layout";
import { PageHero } from "@/components/layout/PageHero";
import { Button } from "@/components/ui/button";
import { Timeline } from "@/components/historie/Timeline";
import { History, Heart, Shield, Users, Sparkles, ArrowRight, Quote } from "lucide-react";
import { Link } from "react-router-dom";
import boyKruiswijk from "@/assets/team-member-1.jpg";
import teamMeeting from "@/assets/team-meeting.jpg";
import teamBoyCalling from "@/assets/team-boy-calling.jpg";

export default function Historie() {
  const { t } = useTranslation();

  const values = [
    { icon: Heart, title: "Persoonlijk", description: "Geen callcenters, maar échte mensen die je naam kennen." },
    { icon: Shield, title: "Betrouwbaar", description: "10+ jaar ervaring en bewezen track record." },
    { icon: Users, title: "Door ondernemers", description: "We begrijpen je omdat we zelf ondernemen." },
    { icon: Sparkles, title: "Uniek", description: "Innovatieve oplossingen die je nergens anders vindt." },
  ];

  return (
    <Layout>
      <Helmet>
        <title>{t("historie.title")} | ZP Zaken</title>
        <meta name="description" content={t("historie.subtitle")} />
        <link rel="canonical" href="https://zpzaken.nl/historie" />
      </Helmet>

      <PageHero
        title={t("historie.title")}
        subtitle={t("historie.subtitle")}
        badge={{ icon: <History className="h-4 w-4" />, text: t("historie.badge") }}
      />

      <section className="py-16 md:py-24 text-primary-foreground relative overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img src={teamBoyCalling} alt="" className="w-full h-full object-cover" aria-hidden="true" />
          <div className="absolute inset-0 bg-gradient-to-r from-primary/95 via-primary/90 to-primary/85" />
        </div>
        <div className="container-wide relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <Quote className="h-12 w-12 mx-auto mb-6 opacity-50" />
            <p className="text-2xl md:text-4xl font-bold leading-relaxed mb-6">{t("historie.quoteText")}</p>
            <div className="flex items-center justify-center gap-4">
              <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-primary-foreground/30 shadow-lg">
                <img src={boyKruiswijk} alt="Boy Kruiswijk" className="w-full h-full object-cover" />
              </div>
              <div className="text-left">
                <p className="font-semibold">Boy Kruiswijk</p>
                <p className="text-primary-foreground/70 text-sm">{t("historie.quoteRole")}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-padding bg-gradient-to-b from-background via-secondary/30 to-background">
        <div className="container-wide">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-accent/20 to-primary/20 text-accent px-5 py-2.5 rounded-full text-sm font-semibold mb-6 border border-accent/20">
              <History className="h-4 w-4" />
              <span>{t("historie.badge")}</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-foreground via-primary to-foreground bg-clip-text text-transparent">{t("historie.timelineTitle")}</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {t("historie.timelineSubtitle")}{" "}
              <span className="text-accent font-medium">{t("historie.timelineScroll")}</span>
            </p>
          </div>
          <Timeline />
        </div>
      </section>

      <section className="section-padding bg-secondary relative overflow-hidden">
        <div className="container-wide relative">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">{t("historie.valuesTitle")}</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">{t("historie.valuesSubtitle")}</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((value, index) => (
              <div key={value.title} className="group bg-card rounded-3xl shadow-lg border border-border/50 p-6 text-center hover:shadow-2xl hover:border-accent/40 hover:-translate-y-2 transition-all duration-300 relative overflow-hidden" style={{ animationDelay: `${index * 100}ms` }}>
                <div className="w-16 h-16 bg-gradient-to-br from-accent/20 to-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                  <value.icon className="h-8 w-8 text-accent" />
                </div>
                <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors">{value.title}</h3>
                <p className="text-muted-foreground text-sm">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-padding relative overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img src={teamMeeting} alt="" className="w-full h-full object-cover" aria-hidden="true" />
          <div className="absolute inset-0 bg-gradient-to-r from-foreground/90 via-foreground/85 to-foreground/80" />
        </div>
        <div className="container-wide relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-primary-foreground">{t("historie.ctaTitle")}</h2>
            <p className="text-lg text-primary-foreground/80 mb-8">{t("historie.ctaSubtitle")}</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button variant="accent" size="lg" asChild>
                <Link to="/contact">{t("historie.ctaButton")}<ArrowRight className="h-4 w-4 ml-2" /></Link>
              </Button>
              <Button variant="outline" size="lg" className="border-primary-foreground/40 text-primary-foreground hover:bg-primary-foreground/10" asChild>
                <Link to="/over-ons">{t("historie.ctaTeam")}</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}

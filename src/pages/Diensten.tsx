import { LocalizedLink } from "@/components/LocalizedLink";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { Layout } from "@/components/layout/Layout";
import { PageHero } from "@/components/layout/PageHero";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { ServiceCard } from "@/components/diensten/ServiceCard";
import { AnimatedSection, StaggerContainer, StaggerItem } from "@/components/ui/animated-section";

import officeCoffee from "@/assets/office-coffee.jpg";
import teamWalking from "@/assets/team-walking.jpg";
import teamCheers from "@/assets/team-cheers.jpg";
import officeFlowers from "@/assets/office-flowers.jpg";
import officeMeetingRoom from "@/assets/office-meeting-room.jpg";
import teamBoyCalling from "@/assets/team-boy-calling.jpg";
import { Shield, Calculator, Scale, UserCheck, Banknote } from "lucide-react";

// Services data stays in Dutch as it's domain content passed to ServiceCard
const services = [
  { id: "verzekeringen", icon: Shield, title: "Verzekeringen", subtitle: "Inclusief onze unieke combinatiepolis", description: "Als zelfstandig professional ben je zelf verantwoordelijk voor je zakelijke zekerheid. Ons paradepaardje: de unieke BAV + AVB combinatiepolis die beroeps- én bedrijfsaansprakelijkheid combineert in één verzekering — exclusief via ZP Zaken.", features: ["⭐ Unieke BAV + AVB combinatiepolis (exclusief)", "Arbeidsongeschiktheidsverzekering (AOV)", "Rechtsbijstandverzekering", "Cyberverzekering", "Zorgverzekering met collectieve korting"], forWho: "Alle zelfstandig professionals die hun risico's willen afdekken", cta: "Direct online afsluiten", href: "/#combinatiepolis", partners: ["Hiscox", "Movir", "Centraal Beheer", "Zorg en Zekerheid"], backgroundImage: officeCoffee },
  { id: "administratie", icon: Calculator, title: "Administratie & Boekhouding", subtitle: "Focus op je werk, wij regelen de rest", description: "Administratie kost tijd en energie die je liever in je opdrachten steekt. Via onze partners kun je je boekhouding, facturatie en belastingzaken uitbesteden aan specialisten die ZZP'ers begrijpen.", features: ["Volledige boekhouding", "BTW-aangiftes", "Facturatie en debiteurenbeheer", "Jaarafsluiting en jaarrekening", "Belastingadvies", "Koppeling met je bankrekening"], forWho: "ZZP'ers die hun administratie willen uitbesteden of ondersteuning zoeken", cta: "Meer over administratie", href: "/contact", partners: ["Boekhoudpartners via ZP Zaken"], backgroundImage: officeFlowers },
  { id: "juridisch", icon: Scale, title: "Juridisch Advies", subtitle: "Bescherm jezelf met goede contracten", description: "Goede contracten en algemene voorwaarden zijn essentieel voor elke zelfstandige. Voorkom geschillen en bescherm jezelf juridisch met hulp van onze juridische partners.", features: ["Algemene voorwaarden opstellen", "Contracten voor opdrachtgevers", "Juridische review van overeenkomsten", "Advies bij geschillen", "Incasso ondersteuning", "Modelcontracten en templates"], forWho: "ZZP'ers die professioneel willen werken met waterdichte afspraken", cta: "Juridisch advies aanvragen", href: "/contact", partners: ["Juridische partners via ZP Zaken"], backgroundImage: teamCheers },
  { id: "screening", icon: UserCheck, title: "Screening voor Ondernemers", subtitle: "Bewijs je betrouwbaarheid aan opdrachtgevers", description: "Steeds meer opdrachtgevers willen zekerheid over de ZZP'ers die ze inhuren. Met onze screening toon je aan dat je betrouwbaar, gekwalificeerd en compliant bent. Onderscheid jezelf van de massa.", features: ["Identiteitsverificatie", "KvK en BTW-nummer check", "Verificatie van diploma's en certificaten", "Referentiecheck bij eerdere opdrachtgevers", "VOG (Verklaring Omtrent Gedrag)", "Compliance check voor wet DBA"], forWho: "ZZP'ers die werken voor grotere opdrachtgevers of in gereguleerde sectoren", cta: "Start je screening", href: "/contact", partners: ["Screeningspartners via ZP Zaken"], backgroundImage: teamWalking },
  { id: "financiering", icon: Banknote, title: "Factoring & Financiering", subtitle: "Snelle uitbetaling, geen cashflow-zorgen", description: "Wacht niet meer weken op betaling van je facturen. Via onze partner Homy Capital ontvang je binnen 24 uur je geld, 7 dagen per week. Volledig geautomatiseerd, met debiteurenbeheer en faillissementsrisico afgedekt.", features: ["⚡ Uitbetaling binnen 24 uur", "Geautomatiseerde facturering", "Debiteurenbeheer uitbesteed", "Faillissementsrisico afgedekt", "SEPA-brede ondersteuning", "Realtime financieel dashboard"], forWho: "ZZP'ers die snel over hun geld willen beschikken", cta: "Start met factoring", href: "/contact", partners: ["Homy Capital"], backgroundImage: officeMeetingRoom },
];

export default function Diensten() {
  const { t } = useTranslation();

  const dienstenSchema = {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    "name": "ZP Zaken - Diensten voor ZZP'ers",
    "url": "https://zpzaken.nl/diensten",
    "description": "Verzekeringen, administratie, juridisch advies, screening en factoring voor zelfstandig professionals.",
    "provider": {
      "@type": "Organization",
      "name": "ZP Zaken",
      "url": "https://zpzaken.nl"
    },
    "areaServed": "NL",
    "hasOfferCatalog": {
      "@type": "OfferCatalog",
      "name": "Diensten voor ZZP'ers",
      "itemListElement": services.map((s) => ({
        "@type": "Offer",
        "itemOffered": {
          "@type": "Service",
          "name": s.title,
          "description": s.description
        }
      }))
    }
  };

  return (
    <Layout>
      <Helmet>
        <title>{t("diensten.title")} {t("diensten.titleAccent")} | ZP Zaken</title>
        <meta name="description" content={t("diensten.subtitle")} />
        <link rel="canonical" href="https://zpzaken.nl/diensten" />
        <script type="application/ld+json">{JSON.stringify(dienstenSchema)}</script>
      </Helmet>
      <PageHero
        title={<>{t("diensten.title")} <span className="text-accent">{t("diensten.titleAccent")}</span></>}
        subtitle={t("diensten.subtitle")}
        badge={{ icon: <Sparkles className="h-4 w-4" />, text: t("diensten.badge") }}
        backgroundImage={teamBoyCalling}
      >
        <Button variant="accent" size="lg" asChild>
          <LocalizedLink to="/contact">{t("diensten.ctaAdvies")}<ArrowRight className="h-5 w-5" /></LocalizedLink>
        </Button>
      </PageHero>

      <motion.section 
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}
        className="bg-secondary py-6 border-b border-border/50"
      >
        <div className="container-wide">
          <StaggerContainer className="flex flex-wrap justify-center gap-3 md:gap-4" staggerDelay={0.08}>
            {services.map((service) => (
              <StaggerItem key={service.id}>
                <a href={`#${service.id}`} className="flex items-center gap-2 px-4 py-2.5 bg-card rounded-lg hover:bg-accent/10 hover:border-accent/20 transition-all border border-border/50 shadow-sm hover:scale-105 hover:shadow-md duration-200">
                  <service.icon className="h-4 w-4 text-accent" />
                  <span className="text-sm font-medium">{service.title}</span>
                </a>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </motion.section>

      {services.map((service, index) => (
        <ServiceCard key={service.id} {...service} index={index} />
      ))}

      <motion.section initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="section-padding relative overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img src={teamCheers} alt="" className="w-full h-full object-cover" aria-hidden="true" />
          <div className="absolute inset-0 bg-gradient-to-r from-foreground/95 via-foreground/90 to-foreground/85" />
        </div>
        <div className="container-wide relative z-10">
          <AnimatedSection className="max-w-3xl mx-auto text-center">
            <AnimatedSection delay={0.1}><h2 className="mb-4 text-primary-foreground">{t("diensten.ctaTitle")}</h2></AnimatedSection>
            <AnimatedSection delay={0.2}><p className="text-lg text-primary-foreground/80 mb-8">{t("diensten.ctaSubtitle")}</p></AnimatedSection>
            <AnimatedSection delay={0.3}>
              <Button variant="accent" size="lg" asChild className="hover:scale-105 transition-transform duration-200">
                <LocalizedLink to="/contact">{t("diensten.ctaButton")}<ArrowRight className="h-5 w-5" /></LocalizedLink>
              </Button>
            </AnimatedSection>
          </AnimatedSection>
        </div>
      </motion.section>
    </Layout>
  );
}

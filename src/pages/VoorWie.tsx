import { LocalizedLink } from "@/components/LocalizedLink";
import { SEOHead } from "@/components/SEOHead";
import { useTranslation } from "react-i18next";
import { Layout } from "@/components/layout/Layout";
import { PageHero } from "@/components/layout/PageHero";
import { Button } from "@/components/ui/button";
import { ArrowRight, HardHat, HeartPulse, Briefcase, Calculator, Scale, Megaphone, Monitor, Users, Shield } from "lucide-react";
import teamWalking from "@/assets/team-walking.jpg";
import teamCheers from "@/assets/team-cheers.jpg";

const audiences = [
  {
    icon: HardHat,
    title: "Bouw en Techniek",
    description: "Voor zelfstandige professionals in de techniek en bouwsector. Niet voor uitvoerend werk met fysiek risico, maar voor adviserende, ontwerpende en coördinerende rollen.",
    examples: "architecten, bouwkundig adviseurs, projectleiders, technische coaches",
  },
  {
    icon: HeartPulse,
    title: "Zorg en Welzijn",
    description: "Voor adviserende, coachende en coördinerende rollen binnen zorg en welzijn. Niet voor uitvoerende zorgverlening (daarvoor verwijzen we naar gespecialiseerde verzekeraars).",
    examples: "zorgconsultants, beleidsadviseurs, coaches in welzijnssector",
  },
  {
    icon: Briefcase,
    title: "Management Consultancy",
    description: "Voor zelfstandige consultants en interim-managers die strategisch advies geven aan organisaties.",
    examples: "strategy consultants, change managers, interim directeuren, transformatie-experts",
  },
  {
    icon: Calculator,
    title: "HR en Finance",
    description: "Voor specialisten in human resources, finance en gerelateerde adviestrajecten.",
    examples: "HR-managers, recruiters, financieel adviseurs, controllers, interim CFO's",
  },
  {
    icon: Scale,
    title: "Zakelijke Dienstverlening",
    description: "Voor brede zakelijke ondersteuning: juridisch, fiscaal, organisatorisch en operationeel advies.",
    examples: "bedrijfsjuristen, fiscaal adviseurs, operations consultants, business analysts",
  },
  {
    icon: Megaphone,
    title: "PR en Marketing",
    description: "Voor marketing-, communicatie- en PR-professionals die als zelfstandige werken voor opdrachtgevers.",
    examples: "marketing strategen, content specialisten, communicatie-adviseurs, PR-consultants",
  },
  {
    icon: Monitor,
    title: "ICT",
    description: "Voor IT-professionals die in adviserende, ontwerpende of projectmatige rol werken.",
    examples: "software-architecten, scrum masters, product owners, IT-consultants",
  },
];

export default function VoorWie() {
  const { t } = useTranslation();

  return (
    <Layout>
      <SEOHead
        title="Voor Wie is ZP Zaken? | Bouw, Zorg, ICT, Consultancy en meer"
        description="ZP Zaken helpt zelfstandig professionals in bouw, zorg, consultancy, HR, finance, marketing en ICT. Persoonlijk verzekeringsbemiddeling op maat voor jouw beroep."
      />

      <PageHero
        title={<>Voor wie is ZP Zaken?</>}
        subtitle="We verzekeren zelfstandigen met adviserende, ontwerpende of coördinerende rollen,  binnen een groot aantal vakgebieden."
        badge={{ icon: <Users className="h-4 w-4" />, text: "Voor zelfstandig professionals" }}
        backgroundImage={teamWalking}
      />

      <section className="section-padding bg-background">
        <div className="container-wide">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {audiences.map((audience) => (
              <div
                key={audience.title}
                className="bg-card rounded-2xl p-6 shadow-card border border-border/60 hover:-translate-y-0.5 hover:shadow-lg hover:border-accent/40 transition-all duration-300"
              >
                <div className="h-12 w-12 rounded-xl bg-accent/10 flex items-center justify-center mb-4">
                  <audience.icon className="h-6 w-6 text-accent" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{audience.title}</h3>
                <p className="text-sm text-muted-foreground mb-3">{audience.description}</p>
                <p className="text-sm text-foreground">
                  <span className="font-semibold">Voorbeelden:</span> {audience.examples}.
                </p>
              </div>
            ))}
          </div>

          <div
            className="max-w-3xl mx-auto mt-12 p-6 rounded-lg flex flex-col sm:flex-row sm:items-center gap-4 justify-between"
            style={{ backgroundColor: "#FFF5F5", borderLeft: "3px solid #E53E2F" }}
          >
            <p className="text-sm text-foreground">
              Twijfel je of jouw beroep onder onze dekking valt? Neem contact op,  we denken graag met je mee.
            </p>
            <Button variant="accent" size="sm" asChild className="flex-shrink-0">
              <LocalizedLink to="/contact">Neem contact op <ArrowRight className="h-4 w-4" /></LocalizedLink>
            </Button>
          </div>
        </div>
      </section>

      <section className="section-padding text-primary-foreground relative overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img src={teamCheers} alt="" className="w-full h-full object-cover bg-person" aria-hidden="true" />
          <div className="absolute inset-0 bg-gradient-to-r from-primary/95 via-primary/90 to-primary/85" />
        </div>
        <div className="container-wide relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="mb-4">{t("voorWie.ctaTitle")}</h2>
            <p className="text-lg text-primary-foreground/80 mb-8">{t("voorWie.ctaSubtitle")}</p>
            <Button variant="accent" size="lg" asChild>
              <LocalizedLink to="/contact"><Shield className="h-5 w-5" />{t("voorWie.ctaButton")}<ArrowRight className="h-5 w-5" /></LocalizedLink>
            </Button>
          </div>
        </div>
      </section>
    </Layout>
  );
}

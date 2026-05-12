import { LocalizedLink } from "@/components/LocalizedLink";
import { SEOHead } from "@/components/SEOHead";
import { useTranslation } from "react-i18next";
import { Layout } from "@/components/layout/Layout";
import { PageHero } from "@/components/layout/PageHero";
import { Button } from "@/components/ui/button";
import { ArrowRight, Monitor, Briefcase, Users, UserCog, Calculator, Scale, Megaphone, Compass, GraduationCap, Shield } from "lucide-react";
import teamWalking from "@/assets/team-walking.jpg";
import teamCheers from "@/assets/team-cheers.jpg";

const audiences = [
  { icon: Monitor, title: "ICT & Software", description: "Developers, architects, consultants en andere IT-professionals." },
  { icon: Briefcase, title: "Management Consultancy", description: "Zelfstandige adviseurs en interim managers in strategie, organisatie en verandering." },
  { icon: UserCog, title: "HR & Recruitment", description: "HR managers, recruiters, L&D specialisten en organisatieadviseurs." },
  { icon: Calculator, title: "Finance", description: "Financieel adviseurs, controllers, accountants en interim CFO's." },
  { icon: Scale, title: "Zakelijke Dienstverlening", description: "Zelfstandige professionals in juridisch advies, notariaat en bedrijfsadvies." },
  { icon: Megaphone, title: "PR & Marketing", description: "Communicatieadviseurs, marketeers, content specialisten en PR professionals." },
  { icon: Compass, title: "Architectuur & Design", description: "Architecten, interieurontwerpers en ruimtelijk adviseurs." },
  { icon: GraduationCap, title: "Coaching & Training", description: "Executive coaches, trainers, loopbaanadviseurs en facilitators." },
];

export default function VoorWie() {
  const { t } = useTranslation();

  return (
    <Layout>
      <SEOHead
        title="Voor Wie is ZP Zaken? | ICT, Consultancy, Finance & Meer"
        description="ZP Zaken helpt zelfstandig professionals in ICT, consultancy, finance, marketing en meer. Persoonlijk verzekeringsadvies op maat voor jouw beroep."
      />

      <PageHero
        title={<>{t("voorWie.title")} <span className="text-accent">{t("voorWie.titleAccent")}</span>?</>}
        subtitle={t("voorWie.subtitle")}
        badge={{ icon: <Users className="h-4 w-4" />, text: t("voorWie.badge") }}
        backgroundImage={teamWalking}
      />

      <section className="section-padding bg-background">
        <div className="container-wide">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {audiences.map((audience) => (
              <div key={audience.title} className="bg-card rounded-2xl p-6 shadow-card border border-border/50 hover:shadow-lg hover:border-accent/30 transition-all duration-300">
                <div className="h-12 w-12 rounded-xl bg-accent/10 flex items-center justify-center mb-4">
                  <audience.icon className="h-6 w-6 text-accent" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{audience.title}</h3>
                <p className="text-sm text-muted-foreground">{audience.description}</p>
              </div>
            ))}
          </div>

          {/* Info block - Twijfel je */}
          <div
            className="max-w-3xl mx-auto mt-12 p-6 rounded-lg flex flex-col sm:flex-row sm:items-center gap-4 justify-between"
            style={{ backgroundColor: "#FFF5F5", borderLeft: "3px solid #E53E2F" }}
          >
            <p className="text-sm text-foreground">
              Twijfel je of jouw beroep onder onze dekking valt? Neem contact op — we denken graag met je mee.
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

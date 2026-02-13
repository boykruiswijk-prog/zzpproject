import { LocalizedLink } from "@/components/LocalizedLink";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { Layout } from "@/components/layout/Layout";
import { PageHero } from "@/components/layout/PageHero";
import { Button } from "@/components/ui/button";
import { ArrowRight, Target, Eye, Users, Award, Heart, Shield, CheckCircle, UserPlus } from "lucide-react";
import teamMember1 from "@/assets/team-member-1.jpg";
import teamMember2 from "@/assets/team-member-2.jpg";
import teamMember3 from "@/assets/team-member-3.jpg";
import teamMember4 from "@/assets/team-member-4.jpg";
import teamMemberMystery from "@/assets/team-member-mystery.jpg";
import teamWalking from "@/assets/team-walking.jpg";
import teamCheers from "@/assets/team-cheers.jpg";
import officeFlowers from "@/assets/office-flowers.jpg";

// Team and content data stays in Dutch as it's specific content
const values = [
  { icon: Target, title: "Onafhankelijk", description: "We zijn niet gebonden aan één verzekeraar. Ons advies is gebaseerd op wat het beste bij jou past, niet op commissies." },
  { icon: Eye, title: "Transparant", description: "Geen kleine lettertjes of verborgen kosten. We leggen alles helder uit zodat je weet waar je aan toe bent." },
  { icon: Users, title: "Persoonlijk", description: "Je spreekt met echte adviseurs die je situatie kennen. Geen callcenters of doorverwijzingen." },
  { icon: Award, title: "Deskundig", description: "Meer dan 10 jaar ervaring in verzekeringen voor zelfstandigen. We kennen de markt en jouw uitdagingen." },
];

const facts = [
  { value: "2012", label: "Opgericht" },
  { value: "2.500+", label: "Klanten" },
  { value: "13+", label: "Jaar ervaring" },
  { value: "4.9/5", label: "Beoordeling" },
];

const team = [
  { name: "Boy Kruiswijk", role: "Oprichter", image: teamMember1, description: "Ruim 13 jaar geleden bedenker van de unieke polis voor zzp'ers in Nederland. Zijn visie: iedere ondernemer goed en zorgeloos verzekerd." },
  { name: "Roxy Taskin", role: "Backoffice", image: teamMember2, description: "Zorgt ervoor dat alles op de achtergrond soepel verloopt. Van administratie tot klantondersteuning." },
  { name: "Ellen Baars", role: "Senior Adviseur", image: teamMember3, description: "Met jarenlange ervaring in verzekeringen helpt zij ondernemers met passend advies voor hun situatie." },
  { name: "Gert-Jan Schellingerhout", role: "Adviseur", image: teamMember4, description: "Versterkt ons team met gedegen kennis en persoonlijk advies voor zelfstandig ondernemers." },
  { name: "Binnenkort bekend", role: "Nieuw teamlid", image: teamMemberMystery, description: "We verwelkomen binnenkort een nieuw gezicht in ons team. Wordt vervolgd!" },
];

const registrations = [
  { title: "AFM geregistreerd", description: "Wij staan geregistreerd bij de Autoriteit Financiële Markten als onafhankelijk adviseur." },
  { title: "Kifid aangesloten", description: "Bij klachten kun je terecht bij het Klachteninstituut Financiële Dienstverlening." },
  { title: "Beroepsaansprakelijkheid verzekerd", description: "Uiteraard zijn wij zelf ook verzekerd tegen beroepsfouten." },
];

export default function OverOns() {
  const { t } = useTranslation();

  return (
    <Layout>
      <Helmet>
        <title>{t("overOns.title")} | ZP Zaken</title>
        <meta name="description" content={t("overOns.subtitle")} />
        <link rel="canonical" href="https://zpzaken.nl/over-ons" />
      </Helmet>

      <PageHero
        title={t("overOns.title")}
        subtitle={t("overOns.subtitle")}
        badge={{ icon: <Heart className="h-4 w-4" />, text: t("overOns.badge") }}
        backgroundImage={teamWalking}
      />

      {/* Founder/CEO module */}
      <section className="section-padding bg-background">
        <div className="container-wide">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-accent/10 border border-accent/20 text-foreground px-4 py-2 rounded-full text-sm font-medium mb-6">
                <Award className="h-4 w-4 text-accent" />
                Oprichter & visionair
              </div>
              <h2 className="mb-4">Boy Kruiswijk</h2>
              <p className="text-lg text-muted-foreground mb-4">
                "Meer dan 13 jaar geleden zag ik dat zzp'ers niet dezelfde zekerheid kregen als werknemers. Dat moest anders. Ik ontwikkelde de eerste gecombineerde BAV+AVB polis in Nederland — speciaal voor zelfstandig professionals."
              </p>
              <p className="text-lg text-muted-foreground mb-6">
                Zijn visie: iedere ondernemer goed en zorgeloos verzekerd, met persoonlijk contact en eerlijk advies. Geen callcenters, geen verkooppraatjes — gewoon een partner die met je meedenkt.
              </p>
              <div className="flex flex-wrap gap-2">
                {["13+ jaar ervaring", "Bedenker unieke BAV+AVB polis", "NEN-gecertificeerd", "AFM geregistreerd"].map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-2 bg-accent/10 border border-accent/20 text-foreground px-3 py-1.5 rounded-lg text-sm">
                    <CheckCircle className="h-3.5 w-3.5 text-accent" />{tag}
                  </span>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="bg-card rounded-2xl overflow-hidden shadow-card border border-border/50">
                <div className="aspect-[4/3] overflow-hidden">
                  <img src={teamMember1} alt="Boy Kruiswijk - Oprichter ZP Zaken" className="w-full h-full object-cover" />
                </div>
                <div className="p-6">
                  <blockquote className="text-lg font-medium mb-2 text-foreground italic">
                    "Zzp'ers verdienen dezelfde zekerheid als werknemers, maar dan op een manier die past bij het ondernemersleven."
                  </blockquote>
                  <p className="text-sm text-muted-foreground">— Boy Kruiswijk, Oprichter ZP Zaken</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Missie sectie */}
      <section className="section-padding bg-secondary">
        <div className="container-wide">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <h2 className="mb-6">{t("overOns.missieTitle")}</h2>
              <p className="text-lg text-muted-foreground mb-6">{t("overOns.missieP1")}</p>
              <p className="text-lg text-muted-foreground mb-6">{t("overOns.missieP2")}</p>
              <div className="flex flex-wrap gap-2">
                {(t("overOns.missieTags", { returnObjects: true }) as string[]).map((tag: string) => (
                  <span key={tag} className="inline-flex items-center gap-2 bg-accent/10 border border-accent/20 text-foreground px-3 py-1.5 rounded-lg text-sm">
                    <CheckCircle className="h-3.5 w-3.5 text-accent" />{tag}
                  </span>
                ))}
              </div>
            </div>
            <div className="bg-primary/5 border border-primary/10 rounded-2xl p-8 lg:p-12 relative overflow-hidden">
              <img src={officeFlowers} alt="" className="absolute inset-0 w-full h-full object-cover opacity-10" aria-hidden="true" />
              <blockquote className="text-xl lg:text-2xl font-medium mb-6 text-foreground">{t("overOns.quote")}</blockquote>
              <p className="text-muted-foreground font-medium">{t("overOns.quoteAuthor")}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section-padding bg-secondary">
        <div className="container-wide">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="mb-4">{t("overOns.teamTitle")}</h2>
            <p className="text-lg text-muted-foreground">{t("overOns.teamSubtitle")}</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {team.map((member) => (
              <div key={member.name} className="bg-card rounded-2xl overflow-hidden shadow-card border border-border/50">
                <div className="aspect-[4/3] overflow-hidden">
                  <img src={member.image} alt={member.name} className="w-full h-full object-cover" />
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-semibold">{member.name}</h3>
                  <span className="inline-flex items-center gap-2 bg-accent/10 border border-accent/20 text-accent px-3 py-1 rounded-full text-sm font-medium my-3">
                    <Shield className="h-3.5 w-3.5" />{member.role}
                  </span>
                  <p className="text-muted-foreground text-sm">{member.description}</p>
                </div>
              </div>
            ))}

            {/* Vacancy Card */}
            <div className="bg-card rounded-2xl overflow-hidden shadow-card border-2 border-dashed border-primary/30">
              <div className="aspect-[4/3] flex flex-col items-center justify-center bg-primary/5">
                <UserPlus className="h-16 w-16 text-primary/40 mb-4" />
                <h3 className="text-xl font-semibold">Jij?</h3>
                <span className="inline-flex items-center gap-2 bg-accent/10 border border-accent/20 text-accent px-3 py-1 rounded-full text-sm font-medium mt-3">
                  <Shield className="h-3.5 w-3.5" />Vacature
                </span>
              </div>
              <div className="p-6">
                <p className="text-muted-foreground text-sm mb-4">
                  Wij zijn op zoek naar versterking! Ben jij de adviseur die ons team compleet maakt?
                </p>
                <Button variant="outline" size="sm" asChild>
                  <LocalizedLink to="/contact">
                    Solliciteer nu
                    <ArrowRight className="h-4 w-4" />
                  </LocalizedLink>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-padding bg-background">
        <div className="container-wide">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="mb-4">{t("overOns.valuesTitle")}</h2>
            <p className="text-lg text-muted-foreground">{t("overOns.valuesSubtitle")}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-4 mb-12">
            {values.map((value) => (
              <div key={value.title} className="inline-flex items-center gap-3 bg-card border border-border/50 shadow-sm px-5 py-3 rounded-xl">
                <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                  <value.icon className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{value.title}</p>
                  <p className="text-xs text-muted-foreground max-w-[200px]">{value.description}</p>
                </div>
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
          <div className="flex flex-wrap justify-center gap-6">
            {facts.map((fact) => (
              <div key={fact.label} className="inline-flex items-center gap-3 bg-primary-foreground/10 backdrop-blur-sm border border-primary-foreground/20 px-6 py-4 rounded-xl">
                <Shield className="h-5 w-5 text-accent" />
                <div className="text-center">
                  <p className="text-2xl md:text-3xl font-bold">{fact.value}</p>
                  <p className="text-primary-foreground/70 text-sm">{fact.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-padding bg-background">
        <div className="container-wide">
          <div className="max-w-3xl mx-auto">
            <h2 className="mb-8 text-center">{t("overOns.registrationsTitle")}</h2>
            <div className="flex flex-wrap justify-center gap-4">
              {registrations.map((reg) => (
                <div key={reg.title} className="inline-flex items-center gap-3 bg-accent/10 border border-accent/20 px-5 py-3 rounded-xl max-w-sm">
                  <CheckCircle className="h-6 w-6 text-accent flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-sm">{reg.title}</p>
                    <p className="text-xs text-muted-foreground">{reg.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section-padding bg-secondary">
        <div className="container-wide">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="mb-4">{t("overOns.ctaTitle")}</h2>
            <p className="text-lg text-muted-foreground mb-8">{t("overOns.ctaSubtitle")}</p>
            <Button variant="accent" size="lg" asChild>
              <LocalizedLink to="/contact">{t("overOns.ctaButton")}<ArrowRight className="h-5 w-5" /></LocalizedLink>
            </Button>
          </div>
        </div>
      </section>
    </Layout>
  );
}

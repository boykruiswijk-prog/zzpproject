import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { LocalizedLink } from "@/components/LocalizedLink";
import { useTranslation } from "react-i18next";
import { Layout } from "@/components/layout/Layout";
import { PageHero } from "@/components/layout/PageHero";
import { Button } from "@/components/ui/button";
import { Shield, Heart, Scale, ArrowRight, CheckCircle, Globe, Sparkles, Euro, Star } from "lucide-react";
import { OnlineAanvraagDialog } from "@/components/verzekeringen/OnlineAanvraagDialog";
import { TrustBar } from "@/components/shared/TrustBar";
import { QualificationCheck } from "@/components/shared/QualificationCheck";
import { StepsProcess } from "@/components/shared/StepsProcess";
import { WhyAffordable } from "@/components/shared/WhyAffordable";
import { MiniSocialProof } from "@/components/shared/MiniSocialProof";
import teamBoyCalling from "@/assets/team-boy-calling.jpg";
import teamCheers from "@/assets/team-cheers.jpg";

const insurances = [
  { id: "combinatiepolis", icon: Shield, title: "Beroeps- én Bedrijfsaansprakelijkheid", subtitle: "Unieke combinatiepolis van ZP Zaken", description: "Als enige in Nederland bieden wij een unieke combinatiepolis die beroeps- én bedrijfsaansprakelijkheid combineert in één verzekering. Eén polis, één premie, dubbele bescherming — nergens anders te krijgen.", features: ["Beroepsaansprakelijkheid: dekking voor financiële schade door beroepsfouten", "Bedrijfsaansprakelijkheid: dekking voor letsel- en zaakschade aan derden", "Juridische bijstand bij claims inbegrepen", "Eén polis, één premie — maximaal gemak", "Maatwerk dekkingen per beroepsgroep", "Exclusief via ZP Zaken"], forWho: "ICT'ers, consultants, coaches, trainers, adviseurs, creatieven", price: "Vanaf €20 per maand", canApplyOnline: true, isUnique: true, isMostChosen: true },
  { id: "arbeidsongeschiktheid", icon: Heart, title: "Arbeidsongeschiktheid", subtitle: "Inkomen bij ziekte of ongeval", description: "Als zzp'er bouw je geen WIA op. Word je ziek of krijg je een ongeval, dan valt je inkomen weg. Een AOV zorgt voor financiële zekerheid als je niet kunt werken.", features: ["Maandelijkse uitkering bij arbeidsongeschiktheid", "Keuze in wachttijd en uitkeringsduur", "Dekking voor zowel ziekte als ongevallen", "Premie fiscaal aftrekbaar"], forWho: "Alle zzp'ers die afhankelijk zijn van hun inkomen", price: "Vanaf €150 per maand", canApplyOnline: false },
  { id: "rechtsbijstand", icon: Scale, title: "Rechtsbijstand", subtitle: "Juridische hulp bij conflicten", description: "Conflicten met opdrachtgevers, leveranciers of de Belastingdienst kunnen duur uitpakken. Met een rechtsbijstandverzekering krijg je juridische hulp zonder torenhoge advocaatkosten.", features: ["Juridisch advies en bemiddeling", "Proceskosten en advocaatkosten vergoed", "Hulp bij conflicten met opdrachtgevers", "Fiscale rechtsbijstand"], forWho: "Zzp'ers met opdrachtgevers, contracten of personeel", price: "Vanaf €20 per maand", canApplyOnline: true },
];

export default function Verzekeringen() {
  const { t } = useTranslation();
  const [selectedInsurance, setSelectedInsurance] = useState<{ id: string; title: string } | null>(null);

  return (
    <Layout>
      <Helmet>
        <title>{t("verzekeringenPage.title")} {t("verzekeringenPage.titleAccent")} | ZP Zaken</title>
        <meta name="description" content={t("verzekeringenPage.subtitle")} />
        <link rel="canonical" href="https://zpzaken.nl/verzekeringen" />
      </Helmet>

      <PageHero
        title={<>{t("verzekeringenPage.title")} <span className="text-accent">{t("verzekeringenPage.titleAccent")}</span></>}
        subtitle={t("verzekeringenPage.subtitle")}
        badge={{ icon: <Sparkles className="h-4 w-4" />, text: t("verzekeringenPage.badge") }}
        backgroundImage={teamBoyCalling}
      >
        <Button variant="accent" size="lg" asChild>
          <LocalizedLink to="/contact">{t("verzekeringenPage.ctaAdvies")}<ArrowRight className="h-5 w-5" /></LocalizedLink>
        </Button>
      </PageHero>

      {/* Trust bar */}
      <div className="bg-secondary border-b border-border py-4">
        <TrustBar />
      </div>

      {/* 3-stappen + kwalificatiecheck */}
      <section className="section-padding bg-background">
        <div className="container-wide">
          <StepsProcess />

          <div className="max-w-2xl mx-auto mt-12">
            <QualificationCheck />
          </div>
        </div>
      </section>

      {/* Verzekeringen */}
      <section className="section-padding bg-secondary">
        <div className="container-wide">
          <div className="space-y-16">
            {insurances.map((insurance, index) => (
              <div key={insurance.id} id={insurance.id} className="scroll-mt-24">
                {insurance.isMostChosen && (
                  <div className="inline-flex items-center gap-2 bg-accent text-accent-foreground px-4 py-1.5 rounded-t-xl text-sm font-semibold">
                    <Star className="h-4 w-4" />
                    Meest gekozen door zzp'ers
                  </div>
                )}
                <div className={`${insurance.isMostChosen ? "border-2 border-accent rounded-b-2xl rounded-tr-2xl p-6 md:p-8 bg-card" : ""}`}>
                  <div className={`grid lg:grid-cols-5 gap-8 lg:gap-12 items-start ${index % 2 === 1 ? 'lg:grid-flow-col-dense' : ''}`}>
                    <div className={`lg:col-span-3 ${index % 2 === 1 ? 'lg:col-start-3' : ''}`}>
                      <div className="flex items-center gap-4 mb-6">
                        <div className="h-14 w-14 rounded-xl bg-accent/10 flex items-center justify-center">
                          <insurance.icon className="h-7 w-7 text-accent" />
                        </div>
                        <div>
                          <h2 className="text-2xl md:text-3xl">{insurance.title}</h2>
                          <p className="text-muted-foreground">{insurance.subtitle}</p>
                        </div>
                      </div>
                      <p className="text-lg text-muted-foreground mb-6">{insurance.description}</p>
                      <div className="flex flex-wrap gap-2 mb-6">
                        {insurance.features.map((feature) => (
                          <span key={feature} className="inline-flex items-center gap-2 bg-accent/10 border border-accent/20 text-foreground px-3 py-1.5 rounded-lg text-sm">
                            <CheckCircle className="h-3.5 w-3.5 text-accent" />{feature}
                          </span>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-3 mb-6">
                        <div className="inline-flex items-center gap-2 bg-card border border-border/50 shadow-sm px-4 py-2.5 rounded-xl">
                          <Shield className="h-4 w-4 text-accent" />
                          <div>
                            <span className="text-xs text-muted-foreground">{t("verzekeringenPage.suitableFor")}</span>
                            <p className="text-sm font-medium">{insurance.forWho}</p>
                          </div>
                        </div>
                        <div className="inline-flex items-center gap-2 bg-accent/10 border border-accent/20 px-4 py-2.5 rounded-xl">
                          <Euro className="h-4 w-4 text-accent" />
                          <div>
                            <span className="text-xs text-muted-foreground">{t("verzekeringenPage.indication")}</span>
                            <p className="text-sm font-medium text-accent">{insurance.price}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        {insurance.canApplyOnline && (
                          <Button variant="accent" onClick={() => setSelectedInsurance({ id: insurance.id, title: insurance.title })}>
                            <Globe className="h-4 w-4" />{t("verzekeringenPage.onlineApply")}
                          </Button>
                        )}
                        <Button variant={insurance.canApplyOnline ? "outline" : "accent"} asChild>
                          <LocalizedLink to="/contact">{t("verzekeringenPage.askAdvice")}<ArrowRight className="h-4 w-4" /></LocalizedLink>
                        </Button>
                        {insurance.isMostChosen && <MiniSocialProof className="ml-2 hidden md:flex" />}
                      </div>
                    </div>
                    <div className={`lg:col-span-2 ${index % 2 === 1 ? 'lg:col-start-1 lg:row-start-1' : ''}`}>
                      <div className="bg-accent/10 border border-accent/20 rounded-xl p-6">
                        <div className="flex items-center gap-2 mb-3">
                          <Shield className="h-5 w-5 text-accent" />
                          <p className="font-semibold text-accent">{t("verzekeringenPage.didYouKnow")}</p>
                        </div>
                        <p className="text-sm text-muted-foreground">{t("verzekeringenPage.taxDeductible")}</p>
                      </div>
                    </div>
                  </div>
                </div>
                {index < insurances.length - 1 && !insurance.isMostChosen && <div className="border-t border-border mt-16" />}
                {insurance.isMostChosen && <div className="mt-16" />}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Waarom zo voordelig */}
      <section className="section-padding bg-background">
        <div className="container-wide max-w-3xl mx-auto">
          <WhyAffordable />
        </div>
      </section>

      <section className="section-padding text-primary-foreground relative overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img src={teamCheers} alt="" className="w-full h-full object-cover" aria-hidden="true" />
          <div className="absolute inset-0 bg-gradient-to-r from-primary/95 via-primary/90 to-primary/85" />
        </div>
        <div className="container-wide relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="mb-4 text-primary-foreground">{t("verzekeringenPage.ctaTitle")}</h2>
            <p className="text-lg text-primary-foreground/80 mb-6">{t("verzekeringenPage.ctaSubtitle")}</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
              <Button variant="accent" size="lg" asChild>
                <LocalizedLink to="/contact">{t("verzekeringenPage.ctaButton")}<ArrowRight className="h-5 w-5" /></LocalizedLink>
              </Button>
              <a
                href="tel:0232010502"
                className="inline-flex items-center justify-center gap-2 text-primary-foreground border border-primary-foreground/40 rounded-lg px-4 py-2 hover:bg-primary-foreground/10 transition-all font-medium"
              >
                📞 023 - 201 0502
              </a>
            </div>
            <MiniSocialProof variant="dark" className="justify-center" />
          </div>
        </div>
      </section>

      <OnlineAanvraagDialog
        open={selectedInsurance !== null}
        onOpenChange={(open) => !open && setSelectedInsurance(null)}
        insuranceType={selectedInsurance?.id ?? ""}
        insuranceTitle={selectedInsurance?.title ?? ""}
      />
    </Layout>
  );
}

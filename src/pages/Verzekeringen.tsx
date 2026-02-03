import { useState } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { PageHero } from "@/components/layout/PageHero";
import { Button } from "@/components/ui/button";
import { Shield, Heart, Scale, ArrowRight, CheckCircle, Globe, Sparkles } from "lucide-react";
import { OnlineAanvraagDialog } from "@/components/verzekeringen/OnlineAanvraagDialog";

const insurances = [
  {
    id: "combinatiepolis",
    icon: Shield,
    title: "Beroeps- én Bedrijfsaansprakelijkheid",
    subtitle: "Unieke combinatiepolis van ZP Zaken",
    description: "Als enige in Nederland bieden wij een unieke combinatiepolis die beroeps- én bedrijfsaansprakelijkheid combineert in één verzekering. Eén polis, één premie, dubbele bescherming — nergens anders te krijgen.",
    features: [
      "Beroepsaansprakelijkheid: dekking voor financiële schade door beroepsfouten",
      "Bedrijfsaansprakelijkheid: dekking voor letsel- en zaakschade aan derden",
      "Juridische bijstand bij claims inbegrepen",
      "Eén polis, één premie — maximaal gemak",
      "Maatwerk dekkingen per beroepsgroep",
      "Exclusief via ZP Zaken",
    ],
    forWho: "ICT'ers, consultants, coaches, trainers, adviseurs, creatieven",
    price: "Vanaf €20 per maand",
    canApplyOnline: true,
    isUnique: true,
  },
  {
    id: "arbeidsongeschiktheid",
    icon: Heart,
    title: "Arbeidsongeschiktheid",
    subtitle: "Inkomen bij ziekte of ongeval",
    description: "Als zzp'er bouw je geen WIA op. Word je ziek of krijg je een ongeval, dan valt je inkomen weg. Een AOV zorgt voor financiële zekerheid als je niet kunt werken.",
    features: [
      "Maandelijkse uitkering bij arbeidsongeschiktheid",
      "Keuze in wachttijd en uitkeringsduur",
      "Dekking voor zowel ziekte als ongevallen",
      "Premie fiscaal aftrekbaar",
    ],
    forWho: "Alle zzp'ers die afhankelijk zijn van hun inkomen",
    price: "Vanaf €150 per maand",
    canApplyOnline: false,
  },
  {
    id: "rechtsbijstand",
    icon: Scale,
    title: "Rechtsbijstand",
    subtitle: "Juridische hulp bij conflicten",
    description: "Conflicten met opdrachtgevers, leveranciers of de Belastingdienst kunnen duur uitpakken. Met een rechtsbijstandverzekering krijg je juridische hulp zonder torenhoge advocaatkosten.",
    features: [
      "Juridisch advies en bemiddeling",
      "Proceskosten en advocaatkosten vergoed",
      "Hulp bij conflicten met opdrachtgevers",
      "Fiscale rechtsbijstand",
    ],
    forWho: "Zzp'ers met opdrachtgevers, contracten of personeel",
    price: "Vanaf €20 per maand",
    canApplyOnline: true,
  },
];

export default function Verzekeringen() {
  const [selectedInsurance, setSelectedInsurance] = useState<{
    id: string;
    title: string;
  } | null>(null);

  return (
    <Layout>
      <PageHero
        title={<>Verzekeringen voor <span className="text-accent">zzp'ers</span></>}
        subtitle="Als zelfstandig ondernemer ben je zelf verantwoordelijk voor je zakelijke zekerheid. Ontdek welke verzekeringen passen bij jouw situatie en beroep."
        badge={{
          icon: <Sparkles className="h-4 w-4" />,
          text: "✨ Exclusief: Unieke BAV + AVB combinatiepolis"
        }}
      >
        <Button variant="accent" size="lg" asChild>
          <Link to="/contact">
            Krijg persoonlijk advies
            <ArrowRight className="h-5 w-5" />
          </Link>
        </Button>
      </PageHero>

      {/* Insurance cards */}
      <section className="section-padding bg-background">
        <div className="container-wide">
          <div className="space-y-12 lg:space-y-16">
            {insurances.map((insurance, index) => (
              <div
                key={insurance.id}
                id={insurance.id}
                className="scroll-mt-24"
              >
                <div className={`grid lg:grid-cols-2 gap-8 lg:gap-12 items-center ${index % 2 === 1 ? 'lg:grid-flow-col-dense' : ''}`}>
                  {/* Content */}
                  <div className={index % 2 === 1 ? 'lg:col-start-2' : ''}>
                    <div className="flex items-center gap-4 mb-4">
                      <div className="h-14 w-14 rounded-xl bg-accent/10 flex items-center justify-center">
                        <insurance.icon className="h-7 w-7 text-accent" />
                      </div>
                      <div>
                        <h2 className="text-2xl md:text-3xl">{insurance.title}</h2>
                        <p className="text-muted-foreground">{insurance.subtitle}</p>
                      </div>
                    </div>
                    
                    <p className="text-lg text-muted-foreground mb-6">
                      {insurance.description}
                    </p>

                    <ul className="space-y-3 mb-6">
                      {insurance.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-3">
                          <CheckCircle className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="flex flex-wrap gap-3">
                      {insurance.canApplyOnline && (
                        <Button
                          variant="accent"
                          onClick={() =>
                            setSelectedInsurance({
                              id: insurance.id,
                              title: insurance.title,
                            })
                          }
                        >
                          <Globe className="h-4 w-4" />
                          Direct online afsluiten
                        </Button>
                      )}
                      <Button variant={insurance.canApplyOnline ? "outline" : "accent"} asChild>
                        <Link to="/contact">
                          Vraag advies aan
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </div>

                  {/* Info card */}
                  <div className={`bg-card rounded-2xl p-8 shadow-card border border-border/50 ${index % 2 === 1 ? 'lg:col-start-1 lg:row-start-1' : ''}`}>
                    <h3 className="font-semibold mb-4">Overzicht</h3>
                    <div className="space-y-4">
                      <div className="p-4 bg-secondary rounded-lg">
                        <p className="text-sm text-muted-foreground mb-1">Geschikt voor</p>
                        <p className="font-medium">{insurance.forWho}</p>
                      </div>
                      <div className="p-4 bg-secondary rounded-lg">
                        <p className="text-sm text-muted-foreground mb-1">Indicatie premie</p>
                        <p className="font-medium text-accent">{insurance.price}</p>
                      </div>
                      <div className="p-4 bg-accent/10 rounded-lg border border-accent/20">
                        <p className="text-sm font-medium text-accent">
                          💡 Wist je dat? De premie is vaak fiscaal aftrekbaar als zakelijke kosten.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {index < insurances.length - 1 && (
                  <div className="border-t border-border mt-12 lg:mt-16" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section-padding bg-secondary">
        <div className="container-wide">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="mb-4">Niet zeker welke verzekering je nodig hebt?</h2>
            <p className="text-lg text-muted-foreground mb-8">
              Plan een gratis adviesgesprek. We bekijken samen welke verzekeringen passen bij jouw 
              beroep en situatie — zonder verplichtingen.
            </p>
            <Button variant="accent" size="lg" asChild>
              <Link to="/contact">
                Gratis adviesgesprek
                <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Online Aanvraag Dialog */}
      <OnlineAanvraagDialog
        open={selectedInsurance !== null}
        onOpenChange={(open) => !open && setSelectedInsurance(null)}
        insuranceType={selectedInsurance?.id ?? ""}
        insuranceTitle={selectedInsurance?.title ?? ""}
      />
    </Layout>
  );
}

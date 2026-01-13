import { useState } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Shield, Briefcase, Heart, Scale, ArrowRight, CheckCircle, Globe } from "lucide-react";
import { OnlineAanvraagDialog } from "@/components/verzekeringen/OnlineAanvraagDialog";

const insurances = [
  {
    id: "beroepsaansprakelijkheid",
    icon: Shield,
    title: "Beroepsaansprakelijkheid",
    subtitle: "Bescherming tegen beroepsfouten",
    description: "Als zzp'er kun je aansprakelijk worden gesteld voor fouten in je werk. Een beroepsaansprakelijkheidsverzekering beschermt je tegen financiële gevolgen van claims door opdrachtgevers.",
    features: [
      "Dekking voor financiële schade door beroepsfouten",
      "Juridische bijstand bij claims",
      "Vaak verplicht gesteld door opdrachtgevers",
      "Maatwerk dekkingen per beroepsgroep",
    ],
    forWho: "ICT'ers, consultants, marketeers, designers, adviseurs",
    price: "Vanaf €15 per maand",
    canApplyOnline: true,
  },
  {
    id: "bedrijfsaansprakelijkheid",
    icon: Briefcase,
    title: "Bedrijfsaansprakelijkheid",
    subtitle: "Schade aan personen of spullen",
    description: "Werk je bij klanten op locatie of lever je producten? Dan ben je aansprakelijk voor schade die je veroorzaakt aan personen of eigendommen. Deze verzekering dekt die risico's.",
    features: [
      "Dekking voor letselschade aan derden",
      "Schade aan eigendommen van opdrachtgevers",
      "Ook dekking voor schade door medewerkers",
      "Werkmateriaal en bedrijfsuitrusting",
    ],
    forWho: "Bouwers, installateurs, fotografen, trainers, coaches",
    price: "Vanaf €10 per maand",
    canApplyOnline: true,
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
    canApplyOnline: false, // AOV vereist meer maatwerk
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
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary via-primary to-primary/90 text-primary-foreground py-16 md:py-24">
        <div className="container-wide">
          <div className="max-w-3xl">
            <h1 className="mb-6">
              Verzekeringen voor <span className="text-accent">zzp'ers</span>
            </h1>
            <p className="text-lg md:text-xl text-primary-foreground/80 mb-8">
              Als zelfstandig ondernemer ben je zelf verantwoordelijk voor je zakelijke zekerheid. 
              Ontdek welke verzekeringen passen bij jouw situatie en beroep.
            </p>
            <Button variant="hero" size="lg" asChild>
              <Link to="/contact">
                Krijg persoonlijk advies
                <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

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

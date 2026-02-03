import { useState } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { PageHero } from "@/components/layout/PageHero";
import { Button } from "@/components/ui/button";
import { Shield, Heart, Scale, ArrowRight, CheckCircle, Globe, Sparkles, Euro } from "lucide-react";
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

  // Structured data for insurance products
  const insuranceSchemas = insurances.map((ins) => ({
    "@context": "https://schema.org",
    "@type": "InsuranceProduct",
    "name": ins.title,
    "description": ins.description,
    "provider": {
      "@type": "Organization",
      "name": "ZP Zaken"
    },
    "category": "Business Insurance",
    "audience": {
      "@type": "Audience",
      "audienceType": ins.forWho
    }
  }));

  return (
    <Layout>
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(insuranceSchemas) }}
      />

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
          <div className="space-y-16">
            {insurances.map((insurance, index) => (
              <div
                key={insurance.id}
                id={insurance.id}
                className="scroll-mt-24"
                itemScope
                itemType="https://schema.org/InsuranceProduct"
              >
                <div className={`grid lg:grid-cols-5 gap-8 lg:gap-12 items-start ${index % 2 === 1 ? 'lg:grid-flow-col-dense' : ''}`}>
                  {/* Content - Takes 3 columns */}
                  <div className={`lg:col-span-3 ${index % 2 === 1 ? 'lg:col-start-3' : ''}`}>
                    <div className="flex items-center gap-4 mb-6">
                      <div className="h-14 w-14 rounded-xl bg-accent/10 flex items-center justify-center">
                        <insurance.icon className="h-7 w-7 text-accent" />
                      </div>
                      <div>
                        <h2 className="text-2xl md:text-3xl" itemProp="name">{insurance.title}</h2>
                        <p className="text-muted-foreground">{insurance.subtitle}</p>
                      </div>
                    </div>
                    
                    <p className="text-lg text-muted-foreground mb-6" itemProp="description">
                      {insurance.description}
                    </p>

                    {/* Features as Shield Tags */}
                    <div className="flex flex-wrap gap-2 mb-6">
                      {insurance.features.map((feature) => (
                        <span
                          key={feature}
                          className="inline-flex items-center gap-2 bg-accent/10 border border-accent/20 text-foreground px-3 py-1.5 rounded-lg text-sm"
                          itemProp="hasOfferCatalog"
                        >
                          <CheckCircle className="h-3.5 w-3.5 text-accent" />
                          {feature}
                        </span>
                      ))}
                    </div>

                    {/* Target audience and price shields */}
                    <div className="flex flex-wrap gap-3 mb-6">
                      <div 
                        className="inline-flex items-center gap-2 bg-card border border-border/50 shadow-sm px-4 py-2.5 rounded-xl"
                        itemProp="audience"
                      >
                        <Shield className="h-4 w-4 text-accent" />
                        <div>
                          <span className="text-xs text-muted-foreground">Geschikt voor</span>
                          <p className="text-sm font-medium" itemProp="audienceType">{insurance.forWho}</p>
                        </div>
                      </div>
                      <div className="inline-flex items-center gap-2 bg-accent/10 border border-accent/20 px-4 py-2.5 rounded-xl">
                        <Euro className="h-4 w-4 text-accent" />
                        <div>
                          <span className="text-xs text-muted-foreground">Indicatie</span>
                          <p className="text-sm font-medium text-accent">{insurance.price}</p>
                        </div>
                      </div>
                    </div>

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

                  {/* Tip Card - Takes 2 columns */}
                  <div className={`lg:col-span-2 ${index % 2 === 1 ? 'lg:col-start-1 lg:row-start-1' : ''}`}>
                    <div className="bg-accent/10 border border-accent/20 rounded-xl p-6">
                      <div className="flex items-center gap-2 mb-3">
                        <Shield className="h-5 w-5 text-accent" />
                        <p className="font-semibold text-accent">Wist je dat?</p>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        De premie voor zakelijke verzekeringen is vaak fiscaal aftrekbaar als zakelijke kosten. 
                        Dat maakt je verzekering netto een stuk voordeliger!
                      </p>
                    </div>
                  </div>
                </div>

                {index < insurances.length - 1 && (
                  <div className="border-t border-border mt-16" />
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

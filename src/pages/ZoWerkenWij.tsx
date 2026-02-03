import { Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { PageHero } from "@/components/layout/PageHero";
import { Button } from "@/components/ui/button";
import { ArrowRight, MessageCircle, FileSearch, CheckCircle, Clock, Heart, Shield, Users } from "lucide-react";

const steps = [
  {
    number: "01",
    icon: MessageCircle,
    title: "Gratis kennismakingsgesprek",
    description: "We beginnen met een vrijblijvend gesprek van 15-20 minuten. We luisteren naar jouw situatie, beroep en wensen. Wat voor werk doe je? Welke risico's loop je? Wat zijn je prioriteiten?",
    details: [
      "Telefonisch of via videobellen",
      "Geen verplichtingen",
      "Direct inzicht in je situatie",
    ],
  },
  {
    number: "02",
    icon: FileSearch,
    title: "Persoonlijk adviesrapport",
    description: "Op basis van ons gesprek stellen we een helder overzicht samen van relevante verzekeringen. Je krijgt per verzekering uitleg over de dekking, premie en of het past bij jouw situatie.",
    details: [
      "Overzicht van geschikte verzekeringen",
      "Duidelijke uitleg per optie",
      "Vergelijking van aanbieders",
    ],
  },
  {
    number: "03",
    icon: CheckCircle,
    title: "Samen regelen",
    description: "Kies je voor ons advies? Dan regelen we de aanvraag voor je. Je ontvangt de polis en wij blijven beschikbaar voor vragen. Wijzigt je situatie? We passen je dekking aan.",
    details: [
      "Wij doen de administratie",
      "Polis direct in je mailbox",
      "Blijvende ondersteuning",
    ],
  },
];

const values = [
  {
    icon: Heart,
    title: "Persoonlijk",
    description: "Je spreekt altijd met een echte adviseur, geen callcenter. We kennen jouw situatie.",
  },
  {
    icon: Shield,
    title: "Onafhankelijk",
    description: "We zijn niet gebonden aan één verzekeraar. We adviseren wat het beste bij jou past.",
  },
  {
    icon: Users,
    title: "Geen tussenpersonen",
    description: "Je hebt rechtstreeks contact met ons. Geen doorverwijzingen of lange wachttijden.",
  },
  {
    icon: Clock,
    title: "Snel & efficiënt",
    description: "Binnen 24 uur reactie. Geen eindeloos papierwerk, wel directe resultaten.",
  },
];

export default function ZoWerkenWij() {
  return (
    <Layout>
      <PageHero
        title="Zo werken wij"
        subtitle="Persoonlijk advies zonder gedoe. We helpen je in drie simpele stappen aan de juiste verzekeringen — eerlijk, transparant en op jouw tempo."
        badge={{
          icon: <MessageCircle className="h-4 w-4" />,
          text: "Onze werkwijze"
        }}
      />

      {/* Steps */}
      <section className="section-padding bg-background">
        <div className="container-wide">
          <div className="max-w-4xl mx-auto">
            {steps.map((step, index) => (
              <div key={step.number} className="relative">
                {/* Connector line */}
                {index < steps.length - 1 && (
                  <div className="absolute left-7 top-20 bottom-0 w-0.5 bg-border" />
                )}
                
                <div className="flex gap-8 pb-16">
                  {/* Icon */}
                  <div className="relative flex-shrink-0">
                    <div className="h-14 w-14 rounded-full bg-accent/10 flex items-center justify-center">
                      <step.icon className="h-7 w-7 text-accent" />
                    </div>
                    <span className="absolute -top-2 -right-2 h-7 w-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                      {step.number}
                    </span>
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1">
                    <h3 className="text-2xl font-semibold mb-3">{step.title}</h3>
                    <p className="text-muted-foreground mb-6 text-lg">{step.description}</p>
                    
                    <div className="bg-secondary rounded-xl p-6">
                      <ul className="space-y-3">
                        {step.details.map((detail) => (
                          <li key={detail} className="flex items-center gap-3">
                            <CheckCircle className="h-5 w-5 text-accent flex-shrink-0" />
                            <span>{detail}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="section-padding bg-secondary">
        <div className="container-wide">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="mb-4">Waarom zpzaken?</h2>
            <p className="text-lg text-muted-foreground">
              We geloven in eerlijk advies en persoonlijk contact. 
              Geen verkooppraatjes, wel een partner die met je meedenkt.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((value) => (
              <div key={value.title} className="bg-card rounded-2xl p-8 text-center shadow-card border border-border/50">
                <div className="h-14 w-14 rounded-xl bg-accent/10 flex items-center justify-center mx-auto mb-6">
                  <value.icon className="h-7 w-7 text-accent" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{value.title}</h3>
                <p className="text-muted-foreground text-sm">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section-padding bg-primary text-primary-foreground">
        <div className="container-wide">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="mb-4">Klaar om te starten?</h2>
            <p className="text-lg text-primary-foreground/80 mb-8">
              Plan een gratis adviesgesprek en ontdek binnen 15 minuten welke 
              verzekeringen bij jouw situatie passen.
            </p>
            <Button variant="accent" size="lg" asChild>
              <Link to="/contact">
                Plan een gesprek
                <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </Layout>
  );
}

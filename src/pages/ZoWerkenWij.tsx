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
    description: "We beginnen met een vrijblijvend gesprek van 15-20 minuten. We luisteren naar jouw situatie, beroep en wensen.",
    details: ["Telefonisch of via videobellen", "Geen verplichtingen", "Direct inzicht in je situatie"],
  },
  {
    number: "02",
    icon: FileSearch,
    title: "Persoonlijk adviesrapport",
    description: "Op basis van ons gesprek stellen we een helder overzicht samen van relevante verzekeringen.",
    details: ["Overzicht van geschikte verzekeringen", "Duidelijke uitleg per optie", "Vergelijking van aanbieders"],
  },
  {
    number: "03",
    icon: CheckCircle,
    title: "Samen regelen",
    description: "Kies je voor ons advies? Dan regelen we de aanvraag voor je. Je ontvangt de polis en wij blijven beschikbaar voor vragen.",
    details: ["Wij doen de administratie", "Polis direct in je mailbox", "Blijvende ondersteuning"],
  },
];

const values = [
  { icon: Heart, title: "Persoonlijk", description: "Je spreekt altijd met een echte adviseur, geen callcenter." },
  { icon: Shield, title: "Onafhankelijk", description: "We zijn niet gebonden aan één verzekeraar." },
  { icon: Users, title: "Geen tussenpersonen", description: "Je hebt rechtstreeks contact met ons." },
  { icon: Clock, title: "Snel & efficiënt", description: "Binnen 24 uur reactie." },
];

// Structured data for HowTo
const howToSchema = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "Hoe werkt ZP Zaken?",
  "description": "Persoonlijk advies zonder gedoe. We helpen je in drie simpele stappen aan de juiste verzekeringen.",
  "step": steps.map((step, index) => ({
    "@type": "HowToStep",
    "position": index + 1,
    "name": step.title,
    "text": step.description
  }))
};

export default function ZoWerkenWij() {
  return (
    <Layout>
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToSchema) }}
      />

      <PageHero
        title="Zo werken wij"
        subtitle="Persoonlijk advies zonder gedoe. We helpen je in drie simpele stappen aan de juiste verzekeringen — eerlijk, transparant en op jouw tempo."
        badge={{
          icon: <MessageCircle className="h-4 w-4" />,
          text: "Onze werkwijze"
        }}
      />

      {/* Steps as Shield Timeline */}
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
                  {/* Icon with number badge */}
                  <div className="relative flex-shrink-0">
                    <div className="h-14 w-14 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center">
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
                    
                    {/* Details as Shield Tags */}
                    <div className="flex flex-wrap gap-2">
                      {step.details.map((detail) => (
                        <span
                          key={detail}
                          className="inline-flex items-center gap-2 bg-accent/10 border border-accent/20 text-foreground px-4 py-2 rounded-lg text-sm"
                        >
                          <CheckCircle className="h-4 w-4 text-accent" />
                          {detail}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Values as Shield Badges */}
      <section className="section-padding bg-secondary">
        <div className="container-wide">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="mb-4">Waarom ZP Zaken?</h2>
            <p className="text-lg text-muted-foreground">
              We geloven in eerlijk advies en persoonlijk contact. 
              Geen verkooppraatjes, wel een partner die met je meedenkt.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-4">
            {values.map((value) => (
              <div
                key={value.title}
                className="inline-flex items-center gap-3 bg-card border border-border/50 shadow-sm px-5 py-4 rounded-xl"
              >
                <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                  <value.icon className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <p className="font-semibold">{value.title}</p>
                  <p className="text-sm text-muted-foreground">{value.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section-padding bg-primary text-primary-foreground">
        <div className="container-wide">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="mb-6">Klaar om te starten?</h2>
            <div className="flex flex-wrap justify-center gap-3 mb-8">
              {["15 minuten", "Vrijblijvend", "Persoonlijk advies"].map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-2 bg-primary-foreground/10 backdrop-blur-sm border border-primary-foreground/20 text-primary-foreground px-4 py-2 rounded-full text-sm"
                >
                  <Shield className="h-4 w-4 text-accent" />
                  {tag}
                </span>
              ))}
            </div>
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

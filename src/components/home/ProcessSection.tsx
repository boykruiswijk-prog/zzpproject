import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MessageCircle, FileSearch, CheckCircle, ArrowRight } from "lucide-react";

const steps = [
  {
    number: "01",
    icon: MessageCircle,
    title: "Gratis kennismaking",
    description: "We bespreken jouw situatie, beroep en wensen. Geen verplichtingen, gewoon een open gesprek.",
  },
  {
    number: "02",
    icon: FileSearch,
    title: "Persoonlijk advies",
    description: "Op basis van je situatie krijg je een helder overzicht van relevante verzekeringen en opties.",
  },
  {
    number: "03",
    icon: CheckCircle,
    title: "Regelen we samen",
    description: "Kies je voor ons advies? Dan regelen we alles voor je. Snel, transparant en zonder gedoe.",
  },
];

export function ProcessSection() {
  return (
    <section className="section-padding bg-secondary">
      <div className="container-wide">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="mb-4">
            Zo werken wij
          </h2>
          <p className="text-lg text-muted-foreground">
            Persoonlijk advies in drie simpele stappen. Geen verkooppraatjes, 
            wel eerlijk advies dat past bij jouw situatie.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 lg:gap-12 mb-12">
          {steps.map((step, index) => (
            <div
              key={step.number}
              className="relative text-center"
            >
              {/* Connector line */}
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-12 left-[60%] w-[80%] h-0.5 bg-border" />
              )}
              
              <div className="relative inline-flex items-center justify-center h-24 w-24 rounded-full bg-card shadow-card mb-6">
                <step.icon className="h-10 w-10 text-accent" />
                <span className="absolute -top-2 -right-2 h-8 w-8 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center">
                  {step.number}
                </span>
              </div>
              
              <h3 className="text-xl font-semibold mb-3">{step.title}</h3>
              <p className="text-muted-foreground max-w-xs mx-auto">{step.description}</p>
            </div>
          ))}
        </div>

        <div className="text-center">
          <Button variant="accent" size="lg" asChild>
            <Link to="/contact">
              Plan een gratis gesprek
              <ArrowRight className="h-5 w-5" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

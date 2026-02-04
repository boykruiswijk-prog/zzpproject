import { Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { PageHero } from "@/components/layout/PageHero";
import { Button } from "@/components/ui/button";
import { 
  Banknote, 
  Clock, 
  Shield, 
  CheckCircle, 
  ArrowRight,
  Zap,
  Users,
  TrendingUp
} from "lucide-react";
import teamMeeting from "@/assets/team-meeting.jpg";

const features = [
  {
    icon: Zap,
    title: "Binnen 24 uur betaald",
    description: "Wacht niet meer weken op je geld. Stuur je factuur en ontvang direct uitbetaling.",
  },
  {
    icon: Shield,
    title: "Faillissementsrisico afgedekt",
    description: "Geen zorgen als je opdrachtgever niet kan betalen — wij dragen het risico.",
  },
  {
    icon: Users,
    title: "Debiteurenbeheer uitbesteed",
    description: "Wij zorgen voor de opvolging, jij focust op je werk.",
  },
  {
    icon: TrendingUp,
    title: "Jouw factuur, jouw eigendom",
    description: "Anders dan bij intermediairs blijf jij eigenaar van je omzet.",
  },
];

const steps = [
  { number: "1", title: "Verstuur je factuur", description: "Upload je factuur via ons platform" },
  { number: "2", title: "Wij betalen direct", description: "Ontvang binnen 24 uur je geld" },
  { number: "3", title: "Wij regelen de rest", description: "Debiteurenbeheer en incasso" },
];

export default function EerderBetalen() {
  return (
    <Layout>
      <PageHero
        title={<>Eerder <span className="text-accent">betaald</span> worden</>}
        subtitle="Wacht niet weken op je facturen. Met onze factoringdienst ontvang je binnen 24 uur je geld — 7 dagen per week. Jij behoudt de controle, wij nemen het risico."
        badge={{
          icon: <Banknote className="h-4 w-4" />,
          text: "Factoring voor ZZP'ers"
        }}
        backgroundImage={teamMeeting}
      >
        <Button variant="accent" size="lg" asChild>
          <Link to="/contact">
            Start vandaag nog
            <ArrowRight className="h-5 w-5" />
          </Link>
        </Button>
      </PageHero>

      {/* Key benefits */}
      <section className="section-padding bg-secondary">
        <div className="container-wide">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="mb-4">
              Waarom eerder betalen via <span className="text-accent">ZP Zaken</span>?
            </h2>
            <p className="text-muted-foreground">
              Wij geloven dat je factuur jouw eigendom is — niet van een tussenpersoon. 
              Daarom bieden wij een eerlijke, transparante factoringoplossing.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature) => (
              <div 
                key={feature.title}
                className="bg-card rounded-xl p-6 shadow-card border border-border"
              >
                <div className="h-12 w-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                  <feature.icon className="h-6 w-6 text-accent" />
                </div>
                <h3 className="font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="section-padding bg-background">
        <div className="container-wide">
          <div className="text-center max-w-xl mx-auto mb-12">
            <h2 className="mb-4">Zo werkt het</h2>
            <p className="text-muted-foreground">
              In drie eenvoudige stappen heb jij je geld op de rekening.
            </p>
          </div>

          <div className="flex flex-col md:flex-row justify-center items-center gap-6 md:gap-12 max-w-3xl mx-auto">
            {steps.map((step, index) => (
              <div key={step.number} className="flex flex-col items-center text-center">
                <div className="h-14 w-14 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-xl font-bold mb-4">
                  {step.number}
                </div>
                <h3 className="font-semibold mb-1">{step.title}</h3>
                <p className="text-sm text-muted-foreground max-w-[180px]">{step.description}</p>
                {index < steps.length - 1 && (
                  <ArrowRight className="hidden md:block absolute right-0 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* USPs */}
      <section className="py-8 bg-secondary border-y border-border">
        <div className="container-wide">
          <div className="flex flex-wrap justify-center gap-8 text-sm">
            <span className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-accent" />
              Geen verborgen kosten
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-accent" />
              SEPA-breed beschikbaar
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-accent" />
              Realtime dashboard
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-accent" />
              Persoonlijke ondersteuning
            </span>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section-padding relative overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img
            src={teamMeeting}
            alt=""
            className="w-full h-full object-cover"
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-foreground/95 via-foreground/90 to-foreground/85" />
        </div>
        
        <div className="container-wide relative z-10">
          <div className="max-w-2xl mx-auto text-center text-primary-foreground">
            <h2 className="mb-4 text-primary-foreground">
              Klaar om sneller betaald te worden?
            </h2>
            <p className="text-primary-foreground/80 text-lg mb-8">
              Plan een gratis gesprek en ontdek hoe factoring jouw cashflow kan verbeteren.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button variant="accent" size="lg" asChild>
                <Link to="/contact">
                  <Clock className="h-5 w-5" />
                  Plan een gesprek
                </Link>
              </Button>
              <Button 
                variant="outline" 
                size="lg" 
                className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10"
                asChild
              >
                <a href="tel:0232010502">
                  Bel: 023 - 201 0502
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}

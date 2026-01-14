import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Shield, UserCheck, ArrowRight, Code, Headphones } from "lucide-react";

const services = [
  {
    icon: Code,
    title: "Software & Automatisering",
    description: "Webapplicaties, integraties en AI-oplossingen op maat. Wij bouwen technologie die je werk makkelijker maakt — met uitleg in normaal Nederlands.",
    href: "/diensten#software",
    features: ["Webapps op maat", "Automatisering", "AI-integraties"],
  },
  {
    icon: UserCheck,
    title: "Screening",
    description: "Betrouwbare verificatie voor opdrachtgevers en kandidaten. Transparant, snel en altijd met persoonlijke ondersteuning.",
    href: "/diensten#screening",
    features: ["Identiteitsverificatie", "KvK-check", "Referenties"],
  },
  {
    icon: Shield,
    title: "Verzekeringen",
    description: "Beroepsaansprakelijkheid, AOV en meer. De juiste dekking zonder poespas, met een adviseur die je kent.",
    href: "/diensten#verzekeringen",
    features: ["Beroepsaansprakelijkheid", "Arbeidsongeschiktheid", "Rechtsbijstand"],
  },
  {
    icon: Headphones,
    title: "Support & Onderhoud",
    description: "Geen ticketsystemen of wachtrijen. Directe ondersteuning van mensen die je kennen en jouw situatie begrijpen.",
    href: "/diensten#support",
    features: ["Persoonlijk contact", "Snelle respons", "Doorlopend onderhoud"],
  },
];

export function ServicesSection() {
  return (
    <section className="section-padding bg-background">
      <div className="container-wide">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="mb-4">
            Onze <span className="text-accent">oplossingen</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Technologie en diensten met een menselijke aanpak. Geen jargon, wel resultaat — 
            en altijd iemand die je kunt bellen.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {services.map((service, index) => (
            <Link
              key={service.title}
              to={service.href}
              className="group relative bg-card rounded-2xl p-6 shadow-card hover:shadow-card-hover transition-all duration-300 border border-border/50 hover:border-accent/30 flex flex-col"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="flex-shrink-0 h-14 w-14 rounded-xl bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 transition-colors mb-4">
                <service.icon className="h-7 w-7 text-accent" />
              </div>
              
              <h3 className="text-xl font-semibold mb-2 group-hover:text-accent transition-colors">
                {service.title}
              </h3>
              
              <p className="text-muted-foreground text-sm mb-4 flex-grow">
                {service.description}
              </p>

              <ul className="space-y-1.5 mb-4">
                {service.features.map((feature) => (
                  <li key={feature} className="text-xs text-muted-foreground flex items-center gap-2">
                    <div className="h-1 w-1 rounded-full bg-accent" />
                    {feature}
                  </li>
                ))}
              </ul>
              
              <span className="inline-flex items-center gap-2 text-sm font-medium text-primary group-hover:text-accent transition-colors mt-auto">
                Meer informatie
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </span>
            </Link>
          ))}
        </div>

        <div className="text-center mt-12">
          <Button variant="outline" size="lg" asChild>
            <Link to="/diensten">
              Bekijk alle oplossingen
              <ArrowRight className="h-5 w-5" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

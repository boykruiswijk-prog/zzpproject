import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Shield, UserCheck, ArrowRight, Headphones } from "lucide-react";

const services = [
  {
    icon: Shield,
    title: "Verzekeringen",
    description: "Inclusief onze unieke BAV+AVB combinatiepolis — beroeps- én bedrijfsaansprakelijkheid in één. Nergens anders te krijgen.",
    href: "/diensten#verzekeringen",
    features: ["⭐ Unieke BAV+AVB combipolis", "Arbeidsongeschiktheid", "Rechtsbijstand"],
  },
  {
    icon: UserCheck,
    title: "Screening",
    description: "Betrouwbare verificatie voor opdrachtgevers en kandidaten. Transparant, snel en altijd met persoonlijke ondersteuning.",
    href: "/diensten#screening",
    features: ["Identiteitsverificatie", "KvK-check", "Referenties"],
  },
  {
    icon: Headphones,
    title: "Persoonlijk Advies",
    description: "Geen callcenters of wachtrijen. Directe ondersteuning van mensen die je kennen en jouw situatie begrijpen.",
    href: "/contact",
    features: ["Persoonlijk contact", "Snelle respons", "Eerlijk advies"],
  },
];

export function ServicesSection() {
  return (
    <section className="section-padding bg-background">
      <div className="container-wide">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="mb-4">
            Onze <span className="text-accent">diensten</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Alles wat je nodig hebt als zelfstandig professional — verzameld bij één partij, 
            geleverd via betrouwbare partners.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
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
              Bekijk alle diensten
              <ArrowRight className="h-5 w-5" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Shield, Heart, Scale, Briefcase, ArrowRight } from "lucide-react";

const services = [
  {
    icon: Shield,
    title: "Beroepsaansprakelijkheid",
    description: "Bescherm jezelf tegen claims van opdrachtgevers bij beroepsfouten. Vaak verplicht gesteld door klanten.",
    href: "/verzekeringen#beroepsaansprakelijkheid",
  },
  {
    icon: Briefcase,
    title: "Bedrijfsaansprakelijkheid",
    description: "Dekking voor schade aan personen of eigendommen tijdens je werkzaamheden. Essentieel voor elke ondernemer.",
    href: "/verzekeringen#bedrijfsaansprakelijkheid",
  },
  {
    icon: Heart,
    title: "Arbeidsongeschiktheid",
    description: "Financiële zekerheid als je door ziekte of ongeval niet kunt werken. Jouw inkomen, jouw verantwoordelijkheid.",
    href: "/verzekeringen#arbeidsongeschiktheid",
  },
  {
    icon: Scale,
    title: "Rechtsbijstand",
    description: "Juridische hulp bij conflicten met opdrachtgevers, leveranciers of de Belastingdienst.",
    href: "/verzekeringen#rechtsbijstand",
  },
];

export function ServicesSection() {
  return (
    <section className="section-padding bg-background">
      <div className="container-wide">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="mb-4">
            Verzekeringen voor <span className="text-accent">zzp'ers</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            De belangrijkste verzekeringen om jezelf en je onderneming te beschermen. 
            Wij helpen je de juiste keuze te maken.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
          {services.map((service, index) => (
            <Link
              key={service.title}
              to={service.href}
              className="group relative bg-card rounded-2xl p-8 shadow-card hover:shadow-card-hover transition-all duration-300 border border-border/50 hover:border-accent/30"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="flex items-start gap-5">
                <div className="flex-shrink-0 h-14 w-14 rounded-xl bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 transition-colors">
                  <service.icon className="h-7 w-7 text-accent" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold mb-2 group-hover:text-accent transition-colors">
                    {service.title}
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    {service.description}
                  </p>
                  <span className="inline-flex items-center gap-2 text-sm font-medium text-primary group-hover:text-accent transition-colors">
                    Meer informatie
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="text-center mt-12">
          <Button variant="default" size="lg" asChild>
            <Link to="/verzekeringen">
              Bekijk alle verzekeringen
              <ArrowRight className="h-5 w-5" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

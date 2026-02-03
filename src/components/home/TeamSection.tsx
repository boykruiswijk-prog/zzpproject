import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Mail, Phone } from "lucide-react";
import teamMember1 from "@/assets/team-member-1.jpg";
import teamMember2 from "@/assets/team-member-2.jpg";
import teamMember3 from "@/assets/team-member-3.jpg";

const teamMembers = [
  {
    name: "Boy Kruiswijk",
    role: "Oprichter",
    image: teamMember1,
    description: "Ruim 13 jaar geleden bedenker van de unieke polis voor zzp'ers in Nederland. Zijn visie: iedere ondernemer goed en zorgeloos verzekerd.",
  },
  {
    name: "Roxy Taskin",
    role: "Backoffice",
    image: teamMember2,
    description: "Zorgt dat alles soepel verloopt achter de schermen.",
  },
  {
    name: "Ellen Baars",
    role: "Senior Adviseur",
    image: teamMember3,
    description: "Expert in BAV en aansprakelijkheidsverzekeringen.",
  },
];

export function TeamSection() {
  return (
    <section className="section-padding bg-secondary relative overflow-hidden">
      {/* Decorative background pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-0 left-0 w-96 h-96 bg-primary rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-accent rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
      </div>
      
      <div className="container-wide relative z-10">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="inline-block text-primary font-semibold text-sm uppercase tracking-wider mb-3">
            Ons Team
          </span>
          <h2 className="mb-4">
            Persoonlijk advies van{" "}
            <span className="text-primary">echte mensen</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            Geen callcenters of chatbots, maar een klein team van experts die je persoonlijk 
            verder helpen. Wij kennen onze klanten bij naam.
          </p>
        </div>

        {/* Team Grid */}
        <div className="grid md:grid-cols-3 gap-8 lg:gap-10 mb-12">
          {teamMembers.map((member, index) => (
            <div
              key={member.name}
              className="group bg-card rounded-2xl overflow-hidden shadow-card hover:shadow-card-hover transition-all duration-300"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {/* Photo */}
              <div className="aspect-[4/5] overflow-hidden">
                <img
                  src={member.image}
                  alt={member.name}
                  className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              
              {/* Info */}
              <div className="p-6">
                <h3 className="text-xl font-semibold mb-1">{member.name}</h3>
                <p className="text-primary font-medium text-sm mb-3">{member.role}</p>
                <p className="text-muted-foreground text-sm">{member.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center">
          <div className="inline-flex flex-col sm:flex-row items-center gap-4">
            <a 
              href="tel:0232010502"
              className="inline-flex items-center gap-2 text-foreground font-medium hover:text-primary transition-colors"
            >
              <Phone className="h-5 w-5" />
              023 - 201 0502
            </a>
            <span className="hidden sm:inline text-muted-foreground">of</span>
            <Button variant="accent" size="lg" asChild>
              <Link to="/contact">
                Neem contact op
                <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

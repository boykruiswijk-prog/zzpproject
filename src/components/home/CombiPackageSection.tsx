import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CheckCircle, Shield, UserCheck, ArrowRight, ChevronDown, Headphones, Heart } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const benefits = [
  {
    icon: Shield,
    title: "Verzekeringen",
    description: "Unieke BAV+AVB combipolis en meer",
    link: "/verzekeringen",
  },
  {
    icon: UserCheck,
    title: "Screening",
    description: "Betrouwbare verificatie voor opdrachtgevers",
    link: "/diensten",
  },
  {
    icon: Headphones,
    title: "Persoonlijk advies",
    description: "Altijd een mens aan de lijn",
    link: "/contact",
  },
  {
    icon: Heart,
    title: "Menselijke maat",
    description: "Geen callcenters, wel betrokkenheid",
    link: "/over-ons",
  },
];

const professions = [
  { category: "IT & ICT", items: ["Developers", "Scrum masters", "ICT-architecten", "Productowners", "DevOps engineers", "Data engineers"] },
  { category: "Consultancy", items: ["Management consultants", "Bedrijfsadviseurs", "Organisatiedeskundigen", "Business architects", "Data analisten"] },
  { category: "Creatief", items: ["Designers", "UX specialists", "Copywriters", "Grafisch ontwerpers", "Videomakers", "Animators"] },
  { category: "Zorg & Coaching", items: ["Verpleegkundigen", "Fysiotherapeuten", "Business coaches", "Loopbaancoaches", "Trainers"] },
];

function ProfessionsDropdown() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-card rounded-xl shadow-card border border-border overflow-hidden">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="w-full p-5 flex items-center justify-between hover:bg-secondary/50 transition-colors">
          <h3 className="text-lg font-semibold">
            Speciaal afgestemd voor deze beroepen
          </h3>
          <ChevronDown 
            className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${
              isOpen ? "rotate-180" : ""
            }`} 
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-5 pb-5">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {professions.map((group) => (
                <div key={group.category}>
                  <h4 className="font-medium text-primary mb-3">{group.category}</h4>
                  <ul className="space-y-1.5">
                    {group.items.map((item) => (
                      <li key={item} className="text-sm text-muted-foreground flex items-center gap-2">
                        <CheckCircle className="h-3 w-3 text-accent" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <p className="text-center text-sm text-muted-foreground mt-6">
              Staat jouw beroep er niet tussen? <Link to="/contact" className="text-primary hover:underline">Neem contact op</Link> — we helpen je graag verder.
            </p>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

export function CombiPackageSection() {
  return (
    <section className="section-padding bg-background" id="diensten">
      <div className="container-wide">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="mb-4">
            Alles onder <span className="text-primary">één dak</span>
          </h2>
          <p className="text-muted-foreground">
            Als zelfstandig professional wil je focussen op je werk, niet op randzaken. 
            Wij regelen alles voor je — met persoonlijke begeleiding en zonder gedoe.
          </p>
        </div>

        {/* Benefits grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5 mb-12">
          {benefits.map((benefit) => (
            <Link 
              key={benefit.title}
              to={benefit.link}
              className="bg-card rounded-xl p-6 shadow-card border border-border text-center hover:shadow-lg hover:border-primary/20 transition-all duration-200 group"
            >
              <div className="h-12 w-12 rounded-lg bg-accent/10 flex items-center justify-center mx-auto mb-4 group-hover:bg-accent/20 transition-colors">
                <benefit.icon className="h-6 w-6 text-accent" />
              </div>
              <h3 className="font-semibold mb-2 group-hover:text-primary transition-colors">{benefit.title}</h3>
              <p className="text-sm text-muted-foreground">{benefit.description}</p>
            </Link>
          ))}
        </div>

        {/* USPs */}
        <div className="flex flex-wrap justify-center gap-x-8 gap-y-3 mb-12">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle className="h-4 w-4 text-accent" />
            <span>Alles via betrouwbare partners</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle className="h-4 w-4 text-accent" />
            <span>Persoonlijk advies</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle className="h-4 w-4 text-accent" />
            <span>Speciaal voor ZZP'ers</span>
          </div>
        </div>

        {/* Main CTA */}
        <div className="bg-secondary rounded-xl p-8 md:p-10 text-center mb-10">
          <h3 className="text-xl font-bold mb-3">Ontdek wat ZP Zaken voor jou kan betekenen</h3>
          <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
            Plan een gratis adviesgesprek en we kijken samen naar jouw situatie. 
            Wij geven je eerlijk advies — zonder verplichtingen.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button variant="accent" size="lg" asChild>
              <Link to="/diensten">
                Bekijk onze diensten
                <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link to="/contact">
                Gratis adviesgesprek
              </Link>
            </Button>
          </div>
        </div>

        {/* Professions Dropdown */}
        <ProfessionsDropdown />
      </div>
    </section>
  );
}

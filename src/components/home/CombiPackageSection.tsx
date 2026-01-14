import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CheckCircle, Shield, Calculator, Scale, UserCheck, ArrowRight, Zap, ChevronDown } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const benefits = [
  {
    icon: Shield,
    title: "Verzekeringen",
    description: "BAV, AOV en meer voor de scherpste prijs",
  },
  {
    icon: Calculator,
    title: "Administratie",
    description: "Boekhouding en BTW uitbesteed",
  },
  {
    icon: Scale,
    title: "Juridisch",
    description: "Contracten en algemene voorwaarden",
  },
  {
    icon: UserCheck,
    title: "Screening",
    description: "Bewijs je betrouwbaarheid",
  },
];

const professions = [
  { category: "IT & ICT", items: ["Developers", "Scrum masters", "ICT-architecten", "Productowners", "Programmeurs", "Systeembeheerders"] },
  { category: "Consultancy", items: ["Management consultants", "Bedrijfsadviseurs", "Organisatiedeskundigen", "Business architecten", "Data analisten"] },
  { category: "Marketing & Design", items: ["Marketeers", "Designers", "Copywriters", "Grafisch ontwerpers", "Tekstschrijvers", "Vormgevers"] },
  { category: "Coaches", items: ["Business coaches", "Loopbaancoaches", "Executive coaches", "Leiderschapscoaches", "Trainers"] },
];

function ProfessionsDropdown() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-card rounded-2xl shadow-card border border-border/50 overflow-hidden">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="w-full p-6 flex items-center justify-between hover:bg-secondary/50 transition-colors">
          <h3 className="text-xl font-semibold">
            Speciaal afgestemd voor deze beroepen
          </h3>
          <ChevronDown 
            className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${
              isOpen ? "rotate-180" : ""
            }`} 
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-6 pb-6">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {professions.map((group) => (
                <div key={group.category}>
                  <h4 className="font-medium text-accent mb-3">{group.category}</h4>
                  <ul className="space-y-1.5">
                    {group.items.map((item) => (
                      <li key={item} className="text-sm text-muted-foreground flex items-center gap-2">
                        <CheckCircle className="h-3 w-3 text-accent/60" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <p className="text-center text-sm text-muted-foreground mt-6">
              Staat jouw beroep er niet tussen? <Link to="/contact" className="text-accent hover:underline">Neem contact op</Link> — we helpen je graag verder.
            </p>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

export function CombiPackageSection() {
  return (
    <section className="section-padding bg-gradient-to-b from-secondary to-background" id="diensten">
      <div className="container-wide">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 bg-accent/10 px-4 py-2 rounded-full mb-6">
            <Zap className="h-4 w-4 text-accent" />
            <span className="text-sm font-semibold text-accent">Alles onder één dak</span>
          </div>
          <h2 className="mb-4">
            Zorgeloos <span className="text-accent">ondernemen</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Als zelfstandig professional wil je focussen op je werk, niet op randzaken. 
            Wij regelen alles voor je — van verzekeringen tot administratie — via betrouwbare partners.
          </p>
        </div>

        {/* Benefits grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {benefits.map((benefit) => (
            <div 
              key={benefit.title}
              className="bg-card rounded-xl p-6 shadow-card border border-border/50 text-center"
            >
              <div className="h-14 w-14 rounded-xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
                <benefit.icon className="h-7 w-7 text-accent" />
              </div>
              <h3 className="font-semibold mb-2">{benefit.title}</h3>
              <p className="text-sm text-muted-foreground">{benefit.description}</p>
            </div>
          ))}
        </div>

        {/* USPs */}
        <div className="flex flex-wrap justify-center gap-6 mb-12">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle className="h-5 w-5 text-accent" />
            <span className="font-medium">Alles via betrouwbare partners</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle className="h-5 w-5 text-accent" />
            <span className="font-medium">Persoonlijk advies</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle className="h-5 w-5 text-accent" />
            <span className="font-medium">Speciaal voor ZZP'ers</span>
          </div>
        </div>

        {/* Main CTA */}
        <div className="bg-card rounded-2xl p-8 md:p-12 shadow-card border border-border/50 text-center mb-12">
          <h3 className="text-2xl font-bold mb-4">Ontdek wat ZP Zaken voor jou kan betekenen</h3>
          <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
            Plan een gratis adviesgesprek en we kijken samen naar jouw situatie. 
            Welke verzekeringen heb je nodig? Kun je administratie uitbesteden? 
            Wij geven je eerlijk advies — zonder verplichtingen.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
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

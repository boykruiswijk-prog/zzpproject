import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CheckCircle, Shield, Briefcase, ArrowRight, Zap, Clock, Calendar } from "lucide-react";

const packages = [
  {
    id: "maandelijks",
    title: "Maandelijks",
    price: "55",
    period: "maand",
    popular: false,
    features: [
      "Dagelijks opzegbaar",
      "Flexibel pauzeren mogelijk",
    ],
    bav: { perEvent: "5.000.000", perYear: "15.000.000" },
    avb: { perEvent: "2.500.000", perYear: "5.000.000" },
    cta: "Direct afsluiten",
    href: "https://shop.zpzaken.nl/bav-maandelijks",
  },
  {
    id: "jaarlijks",
    title: "Jaarlijks",
    price: "600",
    period: "jaar",
    popular: true,
    discount: "€60 korting",
    features: [
      "Voordeliger dan maandelijks",
      "1x per jaar betalen",
    ],
    bav: { perEvent: "5.000.000", perYear: "15.000.000" },
    avb: { perEvent: "2.500.000", perYear: "5.000.000" },
    cta: "Direct afsluiten",
    href: "https://shop.zpzaken.nl/bav-jaarlijks",
  },
  {
    id: "optimaal",
    title: "Optimaal + Cyber",
    price: "750",
    period: "jaar",
    popular: false,
    features: [
      "Inclusief cyberverzekering",
      "Maximale bescherming",
    ],
    bav: { perEvent: "5.000.000", perYear: "15.000.000" },
    avb: { perEvent: "2.500.000", perYear: "5.000.000" },
    cyber: true,
    cta: "Direct afsluiten",
    href: "https://shop.zpzaken.nl/bav-optimaal",
  },
];

const professions = [
  { category: "IT & ICT", items: ["Developers", "Scrum masters", "ICT-architecten", "Productowners", "Programmeurs", "Systeembeheerders"] },
  { category: "Consultancy", items: ["Management consultants", "Bedrijfsadviseurs", "Organisatiedeskundigen", "Business architecten", "Data analisten"] },
  { category: "Marketing & Design", items: ["Marketeers", "Designers", "Copywriters", "Grafisch ontwerpers", "Tekstschrijvers", "Vormgevers"] },
  { category: "Coaches", items: ["Business coaches", "Loopbaancoaches", "Executive coaches", "Leiderschapscoaches", "Trainers"] },
];

export function CombiPackageSection() {
  return (
    <section className="section-padding bg-gradient-to-b from-secondary to-background" id="pakket">
      <div className="container-wide">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 bg-accent/10 px-4 py-2 rounded-full mb-6">
            <Zap className="h-4 w-4 text-accent" />
            <span className="text-sm font-semibold text-accent">Meest gekozen door zzp'ers</span>
          </div>
          <h2 className="mb-4">
            <span className="text-accent">BAV + AVB</span> Combi-pakket
          </h2>
          <p className="text-lg text-muted-foreground">
            Beroeps- én bedrijfsaansprakelijkheid in één pakket. Alles wat je nodig hebt als zzp'er
            in IT, consultancy, marketing of coaching — voor de scherpste prijs van Nederland.
          </p>
        </div>

        {/* USPs */}
        <div className="flex flex-wrap justify-center gap-6 mb-12">
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-5 w-5 text-accent" />
            <span className="font-medium">Binnen 24 uur geregeld</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-5 w-5 text-accent" />
            <span className="font-medium">Dagelijks opzegbaar</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle className="h-5 w-5 text-accent" />
            <span className="font-medium">Goedkoopste van Nederland</span>
          </div>
        </div>

        {/* Pricing cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {packages.map((pkg) => (
            <div
              key={pkg.id}
              className={`relative bg-card rounded-2xl p-6 shadow-card border ${
                pkg.popular 
                  ? "border-accent ring-2 ring-accent/20" 
                  : "border-border/50"
              }`}
            >
              {pkg.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-accent-foreground px-4 py-1 rounded-full text-sm font-semibold">
                  Meest gekozen
                </div>
              )}
              {pkg.discount && (
                <div className="absolute -top-3 right-4 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-semibold">
                  {pkg.discount}
                </div>
              )}

              <div className="text-center mb-6 pt-2">
                <h3 className="text-xl font-semibold mb-2">{pkg.title}</h3>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-4xl font-bold">€{pkg.price}</span>
                  <span className="text-muted-foreground">/{pkg.period}</span>
                </div>
              </div>

              <ul className="space-y-2 mb-6">
                {pkg.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-accent flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="space-y-3 mb-6">
                <div className="p-3 bg-secondary rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Shield className="h-4 w-4 text-accent" />
                    <span className="text-sm font-medium">Beroepsaansprakelijkheid</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    €{pkg.bav.perEvent} per gebeurtenis / €{pkg.bav.perYear} per jaar
                  </p>
                </div>
                <div className="p-3 bg-secondary rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Briefcase className="h-4 w-4 text-accent" />
                    <span className="text-sm font-medium">Bedrijfsaansprakelijkheid</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    €{pkg.avb.perEvent} per gebeurtenis / €{pkg.avb.perYear} per jaar
                  </p>
                </div>
                {pkg.cyber && (
                  <div className="p-3 bg-accent/10 rounded-lg border border-accent/20">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-accent" />
                      <span className="text-sm font-medium text-accent">+ Cyberverzekering</span>
                    </div>
                  </div>
                )}
              </div>

              <Button 
                variant={pkg.popular ? "accent" : "outline"} 
                className="w-full" 
                asChild
              >
                <a href={pkg.href} target="_blank" rel="noopener noreferrer">
                  {pkg.cta}
                  <ArrowRight className="h-4 w-4" />
                </a>
              </Button>
            </div>
          ))}
        </div>

        {/* Professions */}
        <div className="bg-card rounded-2xl p-8 shadow-card border border-border/50">
          <h3 className="text-xl font-semibold text-center mb-6">
            Speciaal afgestemd voor deze beroepen
          </h3>
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

        {/* CTA */}
        <div className="text-center mt-12">
          <p className="text-muted-foreground mb-4">
            Liever eerst advies? We helpen je graag persoonlijk.
          </p>
          <Button variant="outline" size="lg" asChild>
            <Link to="/contact">
              Gratis adviesgesprek
              <ArrowRight className="h-5 w-5" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

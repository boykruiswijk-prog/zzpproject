import { Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Shield, Calculator, Scale, UserCheck, ArrowRight, CheckCircle, Sparkles } from "lucide-react";

const services = [
  {
    id: "verzekeringen",
    icon: Shield,
    title: "Verzekeringen",
    subtitle: "Inclusief onze unieke combinatiepolis",
    description: "Als zelfstandig professional ben je zelf verantwoordelijk voor je zakelijke zekerheid. Ons paradepaardje: de unieke BAV + AVB combinatiepolis die beroeps- én bedrijfsaansprakelijkheid combineert in één verzekering — exclusief via ZP Zaken.",
    features: [
      "⭐ Unieke BAV + AVB combinatiepolis (exclusief)",
      "Arbeidsongeschiktheidsverzekering (AOV)",
      "Rechtsbijstandverzekering",
      "Cyberverzekering",
      "Zorgverzekering met collectieve korting",
    ],
    forWho: "Alle zelfstandig professionals die hun risico's willen afdekken",
    cta: "Bekijk verzekeringen",
    href: "/verzekeringen",
    partners: ["Hiscox", "Movir", "Centraal Beheer", "Zorg en Zekerheid"],
  },
  {
    id: "administratie",
    icon: Calculator,
    title: "Administratie & Boekhouding",
    subtitle: "Focus op je werk, wij regelen de rest",
    description: "Administratie kost tijd en energie die je liever in je opdrachten steekt. Via onze partners kun je je boekhouding, facturatie en belastingzaken uitbesteden aan specialisten die ZZP'ers begrijpen.",
    features: [
      "Volledige boekhouding",
      "BTW-aangiftes",
      "Facturatie en debiteurenbeheer",
      "Jaarafsluiting en jaarrekening",
      "Belastingadvies",
      "Koppeling met je bankrekeninrg",
    ],
    forWho: "ZZP'ers die hun administratie willen uitbesteden of ondersteuning zoeken",
    cta: "Meer over administratie",
    href: "/contact",
    partners: ["Boekhoudpartners via ZP Zaken"],
  },
  {
    id: "juridisch",
    icon: Scale,
    title: "Juridisch Advies",
    subtitle: "Bescherm jezelf met goede contracten",
    description: "Goede contracten en algemene voorwaarden zijn essentieel voor elke zelfstandige. Voorkom geschillen en bescherm jezelf juridisch met hulp van onze juridische partners.",
    features: [
      "Algemene voorwaarden opstellen",
      "Contracten voor opdrachtgevers",
      "Juridische review van overeenkomsten",
      "Advies bij geschillen",
      "Incasso ondersteuning",
      "Modelcontracten en templates",
    ],
    forWho: "ZZP'ers die professioneel willen werken met waterdichte afspraken",
    cta: "Juridisch advies aanvragen",
    href: "/contact",
    partners: ["Juridische partners via ZP Zaken"],
  },
  {
    id: "screening",
    icon: UserCheck,
    title: "Screening voor Ondernemers",
    subtitle: "Bewijs je betrouwbaarheid aan opdrachtgevers",
    description: "Steeds meer opdrachtgevers willen zekerheid over de ZZP'ers die ze inhuren. Met onze screening toon je aan dat je betrouwbaar, gekwalificeerd en compliant bent. Onderscheid jezelf van de massa.",
    features: [
      "Identiteitsverificatie",
      "KvK en BTW-nummer check",
      "Verificatie van diploma's en certificaten",
      "Referentiecheck bij eerdere opdrachtgevers",
      "VOG (Verklaring Omtrent Gedrag)",
      "Compliance check voor wet DBA",
    ],
    forWho: "ZZP'ers die werken voor grotere opdrachtgevers of in gereguleerde sectoren",
    cta: "Start je screening",
    href: "/contact",
    partners: ["Screeningspartners via ZP Zaken"],
  },
];

export default function Diensten() {
  return (
    <Layout>
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary via-primary to-primary/90 text-primary-foreground py-16 md:py-24">
        <div className="container-wide">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 bg-accent/20 backdrop-blur-sm px-4 py-2 rounded-full mb-6">
              <Sparkles className="h-4 w-4 text-accent" />
              <span className="text-sm font-semibold text-accent">Alles voor zelfstandig professionals</span>
            </div>
            <h1 className="mb-6">
              Onze <span className="text-accent">diensten</span>
            </h1>
            <p className="text-lg md:text-xl text-primary-foreground/80 mb-8">
              Verzekeringen, administratie, juridisch advies én screening — alles wat je nodig hebt 
              als zelfstandig professional. Wij koppelen je aan de beste partners voor elke dienst.
            </p>
            <Button variant="hero" size="lg" asChild>
              <Link to="/contact">
                Krijg persoonlijk advies
                <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Quick navigation */}
      <section className="bg-secondary py-6 border-b border-border/50">
        <div className="container-wide">
          <div className="flex flex-wrap justify-center gap-4">
            {services.map((service) => (
              <a
                key={service.id}
                href={`#${service.id}`}
                className="flex items-center gap-2 px-4 py-2 bg-card rounded-lg hover:bg-accent/10 transition-colors"
              >
                <service.icon className="h-4 w-4 text-accent" />
                <span className="text-sm font-medium">{service.title}</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="section-padding bg-background">
        <div className="container-wide">
          <div className="space-y-16 lg:space-y-24">
            {services.map((service, index) => (
              <div
                key={service.id}
                id={service.id}
                className="scroll-mt-24"
              >
                <div className={`grid lg:grid-cols-2 gap-8 lg:gap-12 items-center ${index % 2 === 1 ? 'lg:grid-flow-col-dense' : ''}`}>
                  {/* Content */}
                  <div className={index % 2 === 1 ? 'lg:col-start-2' : ''}>
                    <div className="flex items-center gap-4 mb-4">
                      <div className="h-14 w-14 rounded-xl bg-accent/10 flex items-center justify-center">
                        <service.icon className="h-7 w-7 text-accent" />
                      </div>
                      <div>
                        <h2 className="text-2xl md:text-3xl">{service.title}</h2>
                        <p className="text-muted-foreground">{service.subtitle}</p>
                      </div>
                    </div>
                    
                    <p className="text-lg text-muted-foreground mb-6">
                      {service.description}
                    </p>

                    <ul className="grid sm:grid-cols-2 gap-3 mb-6">
                      {service.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-3">
                          <CheckCircle className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
                          <span className="text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="flex flex-wrap gap-3">
                      <Button variant="accent" asChild>
                        <Link to={service.href}>
                          {service.cta}
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button variant="outline" asChild>
                        <Link to="/contact">
                          Vraag advies aan
                        </Link>
                      </Button>
                    </div>
                  </div>

                  {/* Info card */}
                  <div className={`bg-card rounded-2xl p-8 shadow-card border border-border/50 ${index % 2 === 1 ? 'lg:col-start-1 lg:row-start-1' : ''}`}>
                    <h3 className="font-semibold mb-4">Overzicht</h3>
                    <div className="space-y-4">
                      <div className="p-4 bg-secondary rounded-lg">
                        <p className="text-sm text-muted-foreground mb-1">Geschikt voor</p>
                        <p className="font-medium text-sm">{service.forWho}</p>
                      </div>
                      <div className="p-4 bg-secondary rounded-lg">
                        <p className="text-sm text-muted-foreground mb-2">Via onze partners</p>
                        <div className="flex flex-wrap gap-2">
                          {service.partners.map((partner) => (
                            <span key={partner} className="text-xs bg-accent/10 text-accent px-2 py-1 rounded-full">
                              {partner}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="p-4 bg-accent/10 rounded-lg border border-accent/20">
                        <p className="text-sm font-medium text-accent">
                          💡 Alles via betrouwbare partners, met persoonlijk advies van ZP Zaken.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {index < services.length - 1 && (
                  <div className="border-t border-border mt-16 lg:mt-24" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section-padding bg-secondary">
        <div className="container-wide">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="mb-4">Niet zeker welke dienst je nodig hebt?</h2>
            <p className="text-lg text-muted-foreground mb-8">
              Plan een gratis adviesgesprek. We bekijken samen welke diensten passen bij jouw 
              situatie en beroep — zonder verplichtingen.
            </p>
            <Button variant="accent" size="lg" asChild>
              <Link to="/contact">
                Gratis adviesgesprek
                <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </Layout>
  );
}

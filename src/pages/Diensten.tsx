import { Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { PageHero } from "@/components/layout/PageHero";
import { Button } from "@/components/ui/button";
import { Shield, Calculator, Scale, UserCheck, ArrowRight, Sparkles } from "lucide-react";
import { ServiceCard } from "@/components/diensten/ServiceCard";

// Import background images
import serviceVerzekeringen from "@/assets/service-verzekeringen.jpg";
import serviceAdministratie from "@/assets/service-administratie.jpg";
import serviceJuridisch from "@/assets/service-juridisch.jpg";
import serviceScreening from "@/assets/service-screening.jpg";

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
    backgroundImage: serviceVerzekeringen,
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
      "Koppeling met je bankrekening",
    ],
    forWho: "ZZP'ers die hun administratie willen uitbesteden of ondersteuning zoeken",
    cta: "Meer over administratie",
    href: "/contact",
    partners: ["Boekhoudpartners via ZP Zaken"],
    backgroundImage: serviceAdministratie,
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
    backgroundImage: serviceJuridisch,
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
    backgroundImage: serviceScreening,
  },
];

export default function Diensten() {
  return (
    <Layout>
      <PageHero
        title={<>Onze <span className="text-accent">diensten</span></>}
        subtitle="Verzekeringen, administratie, juridisch advies én screening — alles wat je nodig hebt als zelfstandig professional. Wij koppelen je aan de beste partners voor elke dienst."
        badge={{
          icon: <Sparkles className="h-4 w-4" />,
          text: "Alles voor zelfstandig professionals"
        }}
      >
        <Button variant="accent" size="lg" asChild>
          <Link to="/contact">
            Krijg persoonlijk advies
            <ArrowRight className="h-5 w-5" />
          </Link>
        </Button>
      </PageHero>

      {/* Quick navigation */}
      <section className="bg-secondary py-6 border-b border-border/50 sticky top-16 z-30">
        <div className="container-wide">
          <div className="flex flex-wrap justify-center gap-3 md:gap-4">
            {services.map((service) => (
              <a
                key={service.id}
                href={`#${service.id}`}
                className="flex items-center gap-2 px-4 py-2.5 bg-card rounded-lg hover:bg-accent/10 hover:border-accent/20 transition-all border border-border/50 shadow-sm"
              >
                <service.icon className="h-4 w-4 text-accent" />
                <span className="text-sm font-medium">{service.title}</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Services with background images */}
      {services.map((service, index) => (
        <ServiceCard
          key={service.id}
          {...service}
          index={index}
        />
      ))}

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

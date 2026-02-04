import { Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { PageHero } from "@/components/layout/PageHero";
import { Button } from "@/components/ui/button";
import { Shield, Calculator, Scale, UserCheck, ArrowRight, Sparkles, Banknote } from "lucide-react";
import { ServiceCard } from "@/components/diensten/ServiceCard";

// Import background images
import serviceVerzekeringen from "@/assets/service-verzekeringen.jpg";
import serviceAdministratie from "@/assets/service-administratie.jpg";
import serviceJuridisch from "@/assets/service-juridisch.jpg";
import serviceScreening from "@/assets/service-screening.jpg";
import serviceFinanciering from "@/assets/service-financiering.jpg";
import officeLogo from "@/assets/office-logo.jpg";
import teamMeeting from "@/assets/team-meeting.jpg";

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
  {
    id: "financiering",
    icon: Banknote,
    title: "Factoring & Financiering",
    subtitle: "Snelle uitbetaling, geen cashflow-zorgen",
    description: "Wacht niet meer weken op betaling van je facturen. Via onze partner Homy Capital ontvang je binnen 24 uur je geld, 7 dagen per week. Volledig geautomatiseerd, met debiteurenbeheer en faillissementsrisico afgedekt.",
    features: [
      "⚡ Uitbetaling binnen 24 uur",
      "Geautomatiseerde facturering",
      "Debiteurenbeheer uitbesteed",
      "Faillissementsrisico afgedekt",
      "SEPA-brede ondersteuning",
      "Realtime financieel dashboard",
    ],
    forWho: "ZZP'ers die snel over hun geld willen beschikken",
    cta: "Start met factoring",
    href: "/contact",
    partners: ["Homy Capital"],
    backgroundImage: serviceFinanciering,
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
        backgroundImage={officeLogo}
      >
        <Button variant="accent" size="lg" asChild>
          <Link to="/contact">
            Krijg persoonlijk advies
            <ArrowRight className="h-5 w-5" />
          </Link>
        </Button>
      </PageHero>

      {/* Quick navigation */}
      <section className="bg-secondary py-6 border-b border-border/50">
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
      <section className="section-padding relative overflow-hidden">
        {/* Background Image */}
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
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="mb-4 text-primary-foreground">Niet zeker welke dienst je nodig hebt?</h2>
            <p className="text-lg text-primary-foreground/80 mb-8">
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

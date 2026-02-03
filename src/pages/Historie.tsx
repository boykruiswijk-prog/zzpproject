import { Layout } from "@/components/layout/Layout";
import { PageHero } from "@/components/layout/PageHero";
import { Button } from "@/components/ui/button";
import { 
  History, 
  Rocket, 
  Building2, 
  Users, 
  Award, 
  Heart,
  Shield,
  TrendingUp,
  Sparkles,
  ArrowRight
} from "lucide-react";
import { Link } from "react-router-dom";

const timelineEvents = [
  {
    year: "2014",
    title: "De start van een droom",
    subtitle: "Ontstaan vanuit HeadFirst",
    description: "ZP Zaken werd geboren vanuit Kennisbemiddelaar HeadFirst. Oprichter Boy Kruiswijk zag een gat in de markt: zzp'ers verdienden persoonlijke begeleiding en unieke verzekeringsoplossingen. Met een revolutionair idee voor een gecombineerde BAV+AVB polis begon het avontuur.",
    icon: Rocket,
    highlight: "Het fundament gelegd",
    stats: "Eerste klanten geholpen",
  },
  {
    year: "2017",
    title: "Op eigen kracht",
    subtitle: "Volledig zelfstandig",
    description: "Na drie jaar groeien was het tijd voor de volgende stap. ZP Zaken werd volledig onafhankelijk en kon haar eigen koers varen. Dit markeerde het begin van een periode van sterke groei en innovatie in de zzp-markt.",
    icon: TrendingUp,
    highlight: "100% onafhankelijk",
    stats: "Eigen identiteit",
  },
  {
    year: "2022",
    title: "Een eigen thuis",
    subtitle: "Kantoor in Hoofddorp",
    description: "De groei vroeg om meer ruimte. In het hart van Hoofddorp opende ZP Zaken haar eigen kantoor. Een plek waar ondernemers welkom zijn voor persoonlijk advies, waar het team kan samenwerken en waar de toekomst wordt gebouwd.",
    icon: Building2,
    highlight: "Eigen locatie",
    stats: "Hoofddorp",
  },
  {
    year: "2024",
    title: "Marktleider in zzp-verzekeringen",
    subtitle: "Duizenden ondernemers geholpen",
    description: "ZP Zaken is uitgegroeid tot dé specialist voor zzp'ers in Nederland. Duizenden ondernemers zijn geholpen met verzekeringen, administratie, juridische ondersteuning en meer. Het bewijs dat persoonlijke aandacht en expertise het verschil maken.",
    icon: Award,
    highlight: "Marktleider",
    stats: "Duizenden klanten",
  },
  {
    year: "Eind 2024",
    title: "Nieuw hoofdkantoor",
    subtitle: "Schiphol-Rijk, Tupolevlaan 41",
    description: "De volgende stap in onze groei: een gloednieuw kantoor op Schiphol-Rijk. Tupolevlaan 41 is nu ons thuis — een moderne werkplek waar ondernemers altijd welkom zijn. En ja, de koffie is hier écht lekker.",
    icon: Building2,
    highlight: "Nieuwe locatie",
    stats: "Schiphol-Rijk",
  },
  {
    year: "2026",
    title: "Klaar voor de toekomst",
    subtitle: "Nieuwe website & innovatieve diensten",
    description: "Een gloednieuwe website markeert het begin van de volgende fase. Met online screening voor zzp'ers én onze eigen factoring-oplossing. Waarom zou je jouw facturen laten factoren door bemiddelaars terwijl dat juist jóuw asset is? Geen risico's meer, maar zekerheid: uitbetaling binnen 24 uur, geautomatiseerde facturering, debiteurenbeheer uitbesteed en faillissementsrisico afgedekt.",
    icon: Sparkles,
    highlight: "Innovatie",
    stats: "Screening & Factoring",
  },
];

const values = [
  {
    icon: Heart,
    title: "Persoonlijk",
    description: "Geen callcenters, maar échte mensen die je naam kennen.",
  },
  {
    icon: Shield,
    title: "Betrouwbaar",
    description: "10+ jaar ervaring en bewezen track record.",
  },
  {
    icon: Users,
    title: "Door ondernemers",
    description: "We begrijpen je omdat we zelf ondernemen.",
  },
  {
    icon: Sparkles,
    title: "Uniek",
    description: "Innovatieve oplossingen die je nergens anders vindt.",
  },
];

// Structured data for SEO
const historieSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "ZP Zaken",
  "foundingDate": "2014",
  "description": "ZP Zaken is al meer dan 10 jaar dé specialist voor zzp'ers in Nederland. Van verzekeringen tot administratie, altijd persoonlijk en betrouwbaar.",
  "founder": {
    "@type": "Person",
    "name": "Boy Kruiswijk"
  },
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "Tupolevlaan 41",
    "addressLocality": "Schiphol-Rijk",
    "addressCountry": "NL"
  }
};

export default function Historie() {
  return (
    <Layout>
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(historieSchema) }}
      />

      <PageHero
        title="10 Jaar ZP Zaken"
        subtitle="Van startup tot marktleider. Ontdek onze reis en waarom duizenden zzp'ers ons vertrouwen."
        badge={{
          icon: <History className="h-4 w-4" />,
          text: "Onze Historie"
        }}
      />

      {/* Mission Statement */}
      <section className="py-12 bg-primary text-primary-foreground">
        <div className="container-wide">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-2xl md:text-3xl font-medium leading-relaxed">
              "Voor ondernemers, door ondernemers. Dat is onze belofte sinds dag één."
            </p>
            <p className="mt-4 text-primary-foreground/80">
              — Boy Kruiswijk, Oprichter ZP Zaken
            </p>
          </div>
        </div>
      </section>

      {/* Timeline Section */}
      <section className="section-padding bg-background">
        <div className="container-wide">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-accent/10 text-accent px-4 py-2 rounded-full text-sm font-medium mb-6">
              <History className="h-4 w-4" />
              Onze tijdlijn
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Van idee tot marktleider
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Een reis van 10 jaar ondernemerschap, innovatie en het helpen van duizenden zzp'ers.
            </p>
          </div>

          {/* Timeline */}
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-1/2 transform -translate-x-1/2 h-full w-1 bg-gradient-to-b from-primary via-accent to-primary rounded-full hidden lg:block" />

            <div className="space-y-12 lg:space-y-0">
              {timelineEvents.map((event, index) => (
                <div
                  key={event.year}
                  className={`relative lg:flex lg:items-center lg:gap-8 ${
                    index % 2 === 0 ? "lg:flex-row" : "lg:flex-row-reverse"
                  }`}
                >
                  {/* Content Card */}
                  <div className={`lg:w-[calc(50%-2rem)] ${index % 2 === 0 ? "lg:text-right" : "lg:text-left"}`}>
                    <div className="bg-card rounded-2xl shadow-card border border-border/50 p-6 md:p-8 hover:shadow-lg transition-shadow">
                      {/* Year Badge */}
                      <div className={`inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-full text-lg font-bold mb-4 ${
                        index % 2 === 0 ? "lg:ml-auto" : ""
                      }`}>
                        {event.year}
                      </div>

                      <h3 className="text-xl md:text-2xl font-bold mb-2">
                        {event.title}
                      </h3>
                      <p className="text-accent font-semibold mb-4">
                        {event.subtitle}
                      </p>
                      <p className="text-muted-foreground leading-relaxed mb-4">
                        {event.description}
                      </p>

                      {/* Stats badges */}
                      <div className={`flex flex-wrap gap-2 ${index % 2 === 0 ? "lg:justify-end" : "lg:justify-start"}`}>
                        <span className="inline-flex items-center gap-1.5 bg-secondary text-foreground px-3 py-1.5 rounded-lg text-sm font-medium">
                          <Shield className="h-3.5 w-3.5 text-accent" />
                          {event.highlight}
                        </span>
                        <span className="inline-flex items-center gap-1.5 bg-accent/10 text-accent px-3 py-1.5 rounded-lg text-sm font-medium">
                          {event.stats}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Center Icon */}
                  <div className="hidden lg:flex absolute left-1/2 transform -translate-x-1/2 w-16 h-16 bg-card border-4 border-primary rounded-full items-center justify-center shadow-lg z-10">
                    <event.icon className="h-7 w-7 text-primary" />
                  </div>

                  {/* Mobile Icon */}
                  <div className="lg:hidden absolute left-0 top-0 w-12 h-12 bg-primary rounded-full flex items-center justify-center shadow-lg -ml-1">
                    <event.icon className="h-5 w-5 text-primary-foreground" />
                  </div>

                  {/* Spacer for opposite side */}
                  <div className="hidden lg:block lg:w-[calc(50%-2rem)]" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="section-padding bg-secondary">
        <div className="container-wide">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Wat ons drijft
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Onze kernwaarden bepalen alles wat we doen — voor ondernemers, door ondernemers.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((value) => (
              <div
                key={value.title}
                className="bg-card rounded-2xl shadow-card border border-border/50 p-6 text-center hover:shadow-lg hover:border-accent/30 transition-all"
              >
                <div className="w-14 h-14 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <value.icon className="h-7 w-7 text-accent" />
                </div>
                <h3 className="text-lg font-bold mb-2">{value.title}</h3>
                <p className="text-muted-foreground text-sm">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-primary text-primary-foreground">
        <div className="container-wide">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
            <div>
              <p className="text-4xl md:text-5xl font-bold mb-2">10+</p>
              <p className="text-primary-foreground/80">Jaar ervaring</p>
            </div>
            <div>
              <p className="text-4xl md:text-5xl font-bold mb-2">1000+</p>
              <p className="text-primary-foreground/80">Zzp'ers geholpen</p>
            </div>
            <div>
              <p className="text-4xl md:text-5xl font-bold mb-2">10+</p>
              <p className="text-primary-foreground/80">Partners</p>
            </div>
            <div>
              <p className="text-4xl md:text-5xl font-bold mb-2">★★★★★</p>
              <p className="text-primary-foreground/80">Klantbeoordeling</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="section-padding bg-background">
        <div className="container-wide">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Schrijf mee aan ons verhaal
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Word onderdeel van de ZP Zaken familie. Ontdek wat wij voor jouw onderneming kunnen betekenen.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button variant="accent" size="lg" asChild>
                <Link to="/contact">
                  Neem contact op
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link to="/over-ons">
                  Ontmoet het team
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}

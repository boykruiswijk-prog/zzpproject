import { Layout } from "@/components/layout/Layout";
import { PageHero } from "@/components/layout/PageHero";
import { Button } from "@/components/ui/button";
import { Handshake, ExternalLink, Shield, Heart, PiggyBank, Umbrella, Users, Calculator, Scale, UserCheck, CheckCircle, Banknote, Briefcase } from "lucide-react";
import { Link } from "react-router-dom";
import otenticaLogo from "@/assets/partner-otentica.png";

const partners = [
  {
    name: "Hiscox",
    category: "Verzekeringen",
    description: "Specialist in beroeps- en bedrijfsaansprakelijkheid en cyberdekkingen.",
    logo: "https://img.poweredcache.net/zpzaken.nl/wp-content/uploads/2021/05/hiscox.png?rs=fit&w=150&h=100&ssl=1&format=webp",
    icon: Shield,
    link: "/diensten#verzekeringen",
    features: ["Beroepsaansprakelijkheid", "Bedrijfsaansprakelijkheid", "Cyberverzekering"],
  },
  {
    name: "Zorg en Zekerheid",
    category: "Verzekeringen",
    description: "Regionale zorgverzekeraar met persoonlijke service en Mirro mentale zorg.",
    logo: "https://img.poweredcache.net/zpzaken.nl/wp-content/uploads/2021/05/Zorgverzekeraars-1.png?rs=fit&w=800&h=450&ssl=1&format=webp",
    icon: Heart,
    link: "/diensten#verzekeringen",
    features: ["Basisverzekering", "Aanvullende dekking", "Mirro mentale zorg"],
  },
  {
    name: "BrightPensioen",
    category: "Verzekeringen",
    description: "Coöperatief pensioen met lage kosten en mede-eigenaarschap.",
    logo: "https://img.poweredcache.net/zpzaken.nl/wp-content/uploads/2021/05/BrightPensioen_logo_RGB1.png?rs=fit&w=768&h=174&ssl=1&format=webp",
    icon: PiggyBank,
    link: "/diensten#verzekeringen",
    features: ["Lage kosten", "Geen winstoogmerk", "Mede-eigenaarschap"],
  },
  {
    name: "Movir",
    category: "Verzekeringen",
    description: "100+ jaar specialist in inkomensbescherming voor professionals.",
    logo: "https://img.poweredcache.net/zpzaken.nl/wp-content/uploads/2023/01/LogoMovir-e1675076456534.png?rs=fit&w=768&h=542&ssl=1&format=webp",
    icon: Umbrella,
    link: "/diensten#verzekeringen",
    features: ["100+ jaar ervaring", "Maatwerk dekking", "Online of met adviseur"],
  },
  {
    name: "Centraal Beheer",
    category: "Verzekeringen",
    description: "Betrouwbare AOV met ledenkorting via ZP Zaken.",
    logo: "https://img.poweredcache.net/zpzaken.nl/wp-content/uploads/2021/05/cb.jpeg?rs=fit&w=768&h=566&ssl=1&format=webp",
    icon: Shield,
    link: "/diensten#verzekeringen",
    features: ["Ledenkorting", "Betrouwbaar", "Uitgebreide dekking"],
  },
  {
    name: "SharePeople",
    category: "Verzekeringen",
    description: "Vernieuwend crowdsurance concept: onderling geregeld.",
    logo: "https://img.poweredcache.net/zpzaken.nl/wp-content/uploads/2021/05/4-2.png?rs=fit&w=150&h=100&ssl=1&format=webp",
    icon: Users,
    link: "/contact",
    features: ["Crowdsurance", "Onderling geregeld", "Transparant"],
  },
  {
    name: "Otentica",
    category: "Screening",
    description: "Eenvoudige, snelle en transparante screening voor ondernemers.",
    logo: otenticaLogo,
    icon: UserCheck,
    link: "/diensten#screening",
    features: ["Snelle verificatie", "Officiële instanties", "In eigen huisstijl"],
  },
  {
    name: "Homy Capital",
    category: "Financiering",
    description: "Factoring en financiering voor de flexbranche. Facturen binnen 24 uur uitbetaald, 7 dagen per week.",
    logo: "https://cdn.prod.website-files.com/66bf41c79759cc2db4035331/66bf41c79759cc2db403536d_homy-capital-logo-white-1.svg",
    icon: Banknote,
    link: "/diensten#financiering",
    features: ["Uitbetaling binnen 24 uur", "Geautomatiseerde facturering", "Debiteurenbeheer"],
  },
  {
    name: "Circle8",
    category: "Opdrachten",
    description: "Toonaangevende intermediair op de Nederlandse arbeidsmarkt. Toegang tot opdrachten bij grote opdrachtgevers.",
    logo: "https://www.circle8.nl/hubfs/raw_assets/public/Circle8_2023/images/logo-circle8.svg",
    icon: Briefcase,
    link: "/contact",
    features: ["Opdrachten-marktplaats", "Contractmanagement", "Wet DBA compliant"],
  },
];

const serviceCategories = [
  { id: "verzekeringen", label: "Verzekeringen", icon: Shield },
  { id: "administratie", label: "Administratie", icon: Calculator },
  { id: "juridisch", label: "Juridisch", icon: Scale },
  { id: "screening", label: "Screening", icon: UserCheck },
  { id: "financiering", label: "Financiering", icon: Banknote },
  { id: "opdrachten", label: "Opdrachten", icon: Briefcase },
];

// Structured data for partners
const partnersSchema = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "Partners van ZP Zaken",
  "description": "ZP Zaken werkt samen met betrouwbare partners voor verzekeringen, administratie, juridisch advies en screening.",
  "mentions": partners.map(p => ({
    "@type": "Organization",
    "name": p.name,
    "description": p.description
  }))
};

export default function Partners() {
  return (
    <Layout>
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(partnersSchema) }}
      />

      <PageHero
        title="Trots dat we met onze partners samenwerken!"
        subtitle="Bij ZP Zaken zorgen we ervoor dat jij zorgeloos kunt ondernemen. Dit doen we in samenwerking met onze partners."
        badge={{
          icon: <Handshake className="h-4 w-4" />,
          text: "Onze Partners"
        }}
      />

      {/* Service categories as Shield Navigation */}
      <section className="bg-secondary py-6 border-b border-border/50">
        <div className="container-wide">
          <div className="flex flex-wrap justify-center gap-3">
            {serviceCategories.map((cat) => (
              <Link
                key={cat.id}
                to={`/diensten#${cat.id}`}
                className="inline-flex items-center gap-2 bg-card border border-border/50 shadow-sm px-4 py-2.5 rounded-xl hover:bg-accent/10 hover:border-accent/20 transition-all"
              >
                <cat.icon className="h-4 w-4 text-accent" />
                <span className="text-sm font-medium">{cat.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Partners as Shield Cards */}
      <section className="section-padding bg-background">
        <div className="container-wide">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {partners.map((partner) => (
              <div 
                key={partner.name}
                className="bg-card rounded-2xl shadow-card border border-border/50 overflow-hidden hover:shadow-lg hover:border-accent/30 transition-all"
                itemScope
                itemType="https://schema.org/Organization"
              >
                {/* Logo */}
                <div className="bg-secondary/50 p-6 flex items-center justify-center h-32">
                  <img 
                    src={partner.logo} 
                    alt={`${partner.name} logo`} 
                    className="max-h-16 max-w-[160px] object-contain"
                    itemProp="logo"
                  />
                </div>

                {/* Content */}
                <div className="p-6">
                  {/* Header Shield */}
                  <div className="inline-flex items-center gap-2 bg-accent/10 border border-accent/20 px-3 py-1.5 rounded-lg mb-4">
                    <partner.icon className="h-4 w-4 text-accent" />
                    <span className="text-sm font-semibold" itemProp="name">{partner.name}</span>
                  </div>

                  <p className="text-muted-foreground text-sm mb-4" itemProp="description">
                    {partner.description}
                  </p>

                  {/* Features as Tags */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {partner.features.map((feature) => (
                      <span 
                        key={feature}
                        className="inline-flex items-center gap-1.5 bg-secondary text-foreground px-2.5 py-1 rounded-md text-xs"
                      >
                        <CheckCircle className="h-3 w-3 text-accent" />
                        {feature}
                      </span>
                    ))}
                  </div>

                  <Button variant="outline" size="sm" className="w-full" asChild>
                    <Link to={partner.link}>
                      Meer informatie
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Become a Partner CTA */}
      <section className="section-padding bg-secondary">
        <div className="container-wide">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6">
              <Users className="h-4 w-4" />
              Word partner
            </div>
            <h2 className="mb-6">Wil jij partner worden van ZP Zaken?</h2>
            
            {/* Benefits as Shield Tags */}
            <div className="flex flex-wrap justify-center gap-3 mb-8">
              {["Toegang tot actief netwerk", "Transparante samenwerking", "Gezamenlijke marketing"].map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-2 bg-card border border-border/50 shadow-sm px-4 py-2 rounded-lg text-sm"
                >
                  <Handshake className="h-4 w-4 text-accent" />
                  {tag}
                </span>
              ))}
            </div>
            
            <p className="text-lg text-muted-foreground mb-8">
              Ben je een verzekeraar, pensioenadviseur of financiële dienstverlener? 
              Wij zijn altijd op zoek naar betrouwbare partners.
            </p>
            <Button variant="accent" size="lg" asChild>
              <Link to="/contact">
                Word partner
                <ExternalLink className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Questions CTA */}
      <section className="section-padding bg-background">
        <div className="container-wide text-center">
          <h2 className="mb-4">Vragen over onze partners?</h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Wil je meer weten over onze samenwerkingen? Neem gerust contact met ons op.
          </p>
          <Button variant="accent" size="lg" asChild>
            <Link to="/contact">Neem contact op</Link>
          </Button>
        </div>
      </section>
    </Layout>
  );
}

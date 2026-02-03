import { Layout } from "@/components/layout/Layout";
import { PageHero } from "@/components/layout/PageHero";
import { Button } from "@/components/ui/button";
import { Handshake, ExternalLink, Shield, Heart, PiggyBank, Umbrella, Users, Calculator, Scale, UserCheck } from "lucide-react";
import { Link } from "react-router-dom";
import otenticaLogo from "@/assets/partner-otentica.png";

const partners = [
  // Verzekeringen
  {
    name: "Hiscox",
    category: "Verzekeringen",
    description: "Hiscox is de gespecialiseerde risicodrager achter de beroeps- en bedrijfsaansprakelijkheidsverzekeringen en de cyberdekking.",
    longDescription: "Als toonaangevende specialist in zakelijke verzekeringen biedt Hiscox uitgebreide dekking voor professionals. Hun expertise in beroepsaansprakelijkheid, bedrijfsaansprakelijkheid en cyberrisico's maakt hen de ideale partner voor ZZP'ers die hun onderneming willen beschermen tegen onvoorziene risico's.",
    logo: "https://img.poweredcache.net/zpzaken.nl/wp-content/uploads/2021/05/hiscox.png?rs=fit&w=150&h=100&ssl=1&format=webp",
    icon: Shield,
    link: "/diensten#verzekeringen",
    linkText: "Bekijk verzekeringen",
    features: ["Beroepsaansprakelijkheid", "Bedrijfsaansprakelijkheid", "Cyberverzekering"],
  },
  {
    name: "Zorg en Zekerheid",
    category: "Verzekeringen",
    description: "Elk jaar bieden we met Zorg en Zekerheid een nieuwe zorgdekking aan. Via deze partner is ook Mirro toegankelijk voor een goede psychische gezondheid.",
    longDescription: "Zorg en Zekerheid is een regionale zorgverzekeraar die bekend staat om persoonlijke service en uitstekende dekking. Via hen bieden wij ook toegang tot Mirro, een platform voor mentale gezondheid. Wij vinden dat iedereen met mentale klachten recht heeft op de juiste zorg op het juiste moment.",
    logo: "https://img.poweredcache.net/zpzaken.nl/wp-content/uploads/2021/05/Zorgverzekeraars-1.png?rs=fit&w=800&h=450&ssl=1&format=webp",
    icon: Heart,
    link: "/diensten#verzekeringen",
    linkText: "Bekijk zorgverzekering",
    features: ["Basisverzekering", "Aanvullende dekking", "Mirro mentale zorg"],
  },
  {
    name: "BrightPensioen",
    category: "Verzekeringen",
    description: "Bij BrightPensioen kun je als zelfstandig professional lid worden van deze coöperatie en heel simpel je pensioen opbouwen.",
    longDescription: "BrightPensioen is een unieke coöperatie (social enterprise) waar je als zelfstandige eenvoudig pensioen kunt opbouwen. Door lage kosten, geen winstoogmerk en het feit dat alle deelnemers mede-eigenaar zijn, deel je slim en eerlijk mee in de winst. Een moderne en transparante manier om voor je toekomst te zorgen.",
    logo: "https://img.poweredcache.net/zpzaken.nl/wp-content/uploads/2021/05/BrightPensioen_logo_RGB1.png?rs=fit&w=768&h=174&ssl=1&format=webp",
    icon: PiggyBank,
    link: "/diensten#verzekeringen",
    linkText: "Meer over pensioen",
    features: ["Lage kosten", "Geen winstoogmerk", "Mede-eigenaarschap"],
  },
  {
    name: "Movir",
    category: "Verzekeringen",
    description: "Voor een uitstekende arbeidsongeschiktheidsverzekering ga je natuurlijk naar Movir. Dit kan online of met behulp van een adviseur.",
    longDescription: "Movir is al meer dan 100 jaar de specialist in inkomensbescherming voor professionals. Ze begrijpen als geen ander de risico's van zelfstandig ondernemerschap en bieden maatwerkoplossingen die passen bij jouw situatie. Of je nu online wilt afsluiten of persoonlijk advies wenst, Movir staat voor je klaar.",
    logo: "https://img.poweredcache.net/zpzaken.nl/wp-content/uploads/2023/01/LogoMovir-e1675076456534.png?rs=fit&w=768&h=542&ssl=1&format=webp",
    icon: Umbrella,
    link: "/diensten#verzekeringen",
    linkText: "Bekijk AOV opties",
    features: ["100+ jaar ervaring", "Maatwerk dekking", "Online of met adviseur"],
  },
  {
    name: "Centraal Beheer",
    category: "Verzekeringen",
    description: "Ook Centraal Beheer kent een prima AOV, die je met korting kunt afsluiten als je lid bent bij ZP Zaken.",
    longDescription: "Centraal Beheer is één van de bekendste verzekeraars van Nederland. Als lid van ZP Zaken profiteer je van speciale kortingen op hun arbeidsongeschiktheidsverzekering. Een betrouwbare partner met uitgebreide expertise in het verzekeren van zelfstandig ondernemers.",
    logo: "https://img.poweredcache.net/zpzaken.nl/wp-content/uploads/2021/05/cb.jpeg?rs=fit&w=768&h=566&ssl=1&format=webp",
    icon: Shield,
    link: "/diensten#verzekeringen",
    linkText: "Bekijk met korting",
    features: ["Ledenkorting", "Betrouwbaar", "Uitgebreide dekking"],
  },
  {
    name: "SharePeople",
    category: "Verzekeringen",
    description: "Geen verzekering maar een crowdsurance oplossing. Alles onderling geregeld.",
    longDescription: "SharePeople biedt een vernieuwend concept: crowdsurance. In plaats van een traditionele verzekering regel je het onderling met andere professionals. Een moderne, transparante en vaak voordelige manier om risico's te delen. Perfect voor ondernemers die geloven in de kracht van samenwerking.",
    logo: "https://img.poweredcache.net/zpzaken.nl/wp-content/uploads/2021/05/4-2.png?rs=fit&w=150&h=100&ssl=1&format=webp",
    icon: Users,
    link: "/contact",
    linkText: "Meer informatie",
    features: ["Crowdsurance", "Onderling geregeld", "Transparant"],
  },
  // Screening
  {
    name: "Otentica",
    category: "Screening",
    description: "Eenvoudige, snelle en transparante screening voor kandidaten en ondernemers.",
    longDescription: "Otentica zorgt voor een eenvoudige, snelle en transparante screening. Ontdek direct wie écht geschikt is. Kandidaten doorlopen enkele stappen waarin alle gegevens opgehaald worden bij de officiële instanties. Garantie van nauwkeurigheid van de gegevens, volledig in jouw eigen huisstijl.",
    logo: otenticaLogo,
    icon: UserCheck,
    link: "/diensten#screening",
    linkText: "Bekijk screening",
    features: ["Snelle verificatie", "Officiële instanties", "In eigen huisstijl"],
  },
];

const serviceCategories = [
  { id: "verzekeringen", label: "Verzekeringen", icon: Shield },
  { id: "administratie", label: "Administratie", icon: Calculator },
  { id: "juridisch", label: "Juridisch", icon: Scale },
  { id: "screening", label: "Screening", icon: UserCheck },
];

export default function Partners() {
  return (
    <Layout>
      <PageHero
        title="Trots dat we met onze partners samenwerken!"
        subtitle="Bij ZP Zaken zorgen we ervoor dat jij zorgeloos kunt ondernemen. Dit doen we in samenwerking met onze partners voor verzekeringen, administratie, juridisch advies en screening."
        badge={{
          icon: <Handshake className="h-4 w-4" />,
          text: "Onze Partners"
        }}
      />

      {/* Service categories */}
      <section className="bg-secondary py-6 border-b border-border/50">
        <div className="container-wide">
          <div className="flex flex-wrap justify-center gap-4">
            {serviceCategories.map((cat) => (
              <Link
                key={cat.id}
                to={`/diensten#${cat.id}`}
                className="flex items-center gap-2 px-4 py-2 bg-card rounded-lg hover:bg-accent/10 transition-colors"
              >
                <cat.icon className="h-4 w-4 text-accent" />
                <span className="text-sm font-medium">{cat.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Partners Grid */}
      <section className="section-padding bg-background">
        <div className="container-wide">
          <div className="grid gap-8">
            {partners.map((partner, index) => (
              <div 
                key={partner.name}
                className={`bg-card rounded-2xl shadow-card border border-border/50 overflow-hidden ${
                  index % 2 === 0 ? "" : "lg:flex-row-reverse"
                }`}
              >
                <div className="grid lg:grid-cols-3 gap-0">
                  {/* Logo Section */}
                  <div className={`bg-secondary/50 p-8 flex items-center justify-center ${
                    index % 2 === 1 ? "lg:order-2" : ""
                  }`}>
                    <img 
                      src={partner.logo} 
                      alt={`${partner.name} logo`} 
                      className="max-h-24 max-w-[200px] object-contain"
                    />
                  </div>

                  {/* Content Section */}
                  <div className={`p-8 lg:col-span-2 ${
                    index % 2 === 1 ? "lg:order-1" : ""
                  }`}>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-accent/10 rounded-lg">
                        <partner.icon className="h-5 w-5 text-accent" />
                      </div>
                      <h2 className="text-2xl font-bold">{partner.name}</h2>
                    </div>

                    <p className="text-muted-foreground mb-6 leading-relaxed">
                      {partner.longDescription}
                    </p>

                    <div className="flex flex-wrap gap-2 mb-6">
                      {partner.features.map((feature) => (
                        <span 
                          key={feature}
                          className="px-3 py-1 bg-secondary text-sm rounded-full"
                        >
                          {feature}
                        </span>
                      ))}
                    </div>

                    <Button variant="accent" asChild>
                      <Link to={partner.link} className="inline-flex items-center gap-2">
                        {partner.linkText}
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Become a Partner CTA */}
      <section className="section-padding bg-secondary">
        <div className="container-wide">
          <div className="bg-card rounded-2xl shadow-card border border-primary/20 p-8 md:p-12">
            <div className="grid lg:grid-cols-2 gap-8 items-center">
              <div>
                <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary/10 text-primary rounded-full text-sm font-medium mb-4">
                  <Users className="h-4 w-4" />
                  Word partner
                </div>
                <h2 className="text-3xl md:text-4xl font-bold mb-4">
                  Wil jij partner worden van ZP Zaken?
                </h2>
                <p className="text-lg text-muted-foreground mb-6">
                  Ben je een verzekeraar, pensioenadviseur of financiële dienstverlener die zich richt op zelfstandig professionals? 
                  Wij zijn altijd op zoek naar betrouwbare partners die onze leden kunnen helpen met hun zakelijke zekerheid.
                </p>
                <ul className="space-y-3 mb-8">
                  <li className="flex items-center gap-3 text-muted-foreground">
                    <div className="h-6 w-6 rounded-full bg-accent/20 flex items-center justify-center">
                      <Handshake className="h-3 w-3 text-accent" />
                    </div>
                    Toegang tot een actief netwerk van ZZP'ers en ondernemers
                  </li>
                  <li className="flex items-center gap-3 text-muted-foreground">
                    <div className="h-6 w-6 rounded-full bg-accent/20 flex items-center justify-center">
                      <Handshake className="h-3 w-3 text-accent" />
                    </div>
                    Samenwerking op basis van vertrouwen en transparantie
                  </li>
                  <li className="flex items-center gap-3 text-muted-foreground">
                    <div className="h-6 w-6 rounded-full bg-accent/20 flex items-center justify-center">
                      <Handshake className="h-3 w-3 text-accent" />
                    </div>
                    Gezamenlijke marketing en zichtbaarheid
                  </li>
                </ul>
                <Button variant="accent" size="lg" asChild>
                  <Link to="/contact" className="inline-flex items-center gap-2">
                    Word partner
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
              <div className="hidden lg:flex items-center justify-center">
                <div className="relative">
                  <div className="absolute inset-0 bg-primary/20 rounded-full blur-3xl"></div>
                  <div className="relative bg-card rounded-2xl p-12 border border-border/50 shadow-lg">
                    <Handshake className="h-32 w-32 text-primary" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Questions CTA Section */}
      <section className="section-padding bg-background">
        <div className="container-wide text-center">
          <h2 className="text-3xl font-bold mb-4">
            Vragen over onze partners?
          </h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Wil je meer weten over onze samenwerkingen of heb je specifieke vragen? 
            Neem gerust contact met ons op, we helpen je graag verder.
          </p>
          <Button variant="accent" size="lg" asChild>
            <Link to="/contact">Neem contact op</Link>
          </Button>
        </div>
      </section>
    </Layout>
  );
}

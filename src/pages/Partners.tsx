import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Handshake, ExternalLink, Shield, Heart, PiggyBank, Umbrella, Users } from "lucide-react";
import { Link } from "react-router-dom";

const partners = [
  {
    name: "Hiscox",
    description: "Hiscox is de gespecialiseerde risicodrager achter de beroeps- en bedrijfsaansprakelijkheidsverzekeringen en de cyberdekking.",
    longDescription: "Als toonaangevende specialist in zakelijke verzekeringen biedt Hiscox uitgebreide dekking voor professionals. Hun expertise in beroepsaansprakelijkheid, bedrijfsaansprakelijkheid en cyberrisico's maakt hen de ideale partner voor ZZP'ers die hun onderneming willen beschermen tegen onvoorziene risico's.",
    logo: "https://img.poweredcache.net/zpzaken.nl/wp-content/uploads/2021/05/hiscox.png?rs=fit&w=150&h=100&ssl=1&format=webp",
    icon: Shield,
    link: "/verzekeringen",
    linkText: "Bekijk verzekeringen",
    features: ["Beroepsaansprakelijkheid", "Bedrijfsaansprakelijkheid", "Cyberverzekering"],
  },
  {
    name: "Zorg en Zekerheid",
    description: "Elk jaar bieden we met Zorg en Zekerheid een nieuwe zorgdekking aan. Via deze partner is ook Mirro toegankelijk voor een goede psychische gezondheid.",
    longDescription: "Zorg en Zekerheid is een regionale zorgverzekeraar die bekend staat om persoonlijke service en uitstekende dekking. Via hen bieden wij ook toegang tot Mirro, een platform voor mentale gezondheid. Wij vinden dat iedereen met mentale klachten recht heeft op de juiste zorg op het juiste moment.",
    logo: "https://img.poweredcache.net/zpzaken.nl/wp-content/uploads/2021/05/Zorgverzekeraars-1.png?rs=fit&w=800&h=450&ssl=1&format=webp",
    icon: Heart,
    link: "/verzekeringen",
    linkText: "Bekijk zorgverzekering",
    features: ["Basisverzekering", "Aanvullende dekking", "Mirro mentale zorg"],
  },
  {
    name: "BrightPensioen",
    description: "Bij BrightPensioen kun je als zelfstandig professional lid worden van deze coöperatie en heel simpel je pensioen opbouwen.",
    longDescription: "BrightPensioen is een unieke coöperatie (social enterprise) waar je als zelfstandige eenvoudig pensioen kunt opbouwen. Door lage kosten, geen winstoogmerk en het feit dat alle deelnemers mede-eigenaar zijn, deel je slim en eerlijk mee in de winst. Een moderne en transparante manier om voor je toekomst te zorgen.",
    logo: "https://img.poweredcache.net/zpzaken.nl/wp-content/uploads/2021/05/BrightPensioen_logo_RGB1.png?rs=fit&w=768&h=174&ssl=1&format=webp",
    icon: PiggyBank,
    link: "/verzekeringen",
    linkText: "Meer over pensioen",
    features: ["Lage kosten", "Geen winstoogmerk", "Mede-eigenaarschap"],
  },
  {
    name: "Movir",
    description: "Voor een uitstekende arbeidsongeschiktheidsverzekering ga je natuurlijk naar Movir. Dit kan online of met behulp van een adviseur.",
    longDescription: "Movir is al meer dan 100 jaar de specialist in inkomensbescherming voor professionals. Ze begrijpen als geen ander de risico's van zelfstandig ondernemerschap en bieden maatwerkoplossingen die passen bij jouw situatie. Of je nu online wilt afsluiten of persoonlijk advies wenst, Movir staat voor je klaar.",
    logo: "https://img.poweredcache.net/zpzaken.nl/wp-content/uploads/2023/01/LogoMovir-e1675076456534.png?rs=fit&w=768&h=542&ssl=1&format=webp",
    icon: Umbrella,
    link: "/verzekeringen",
    linkText: "Bekijk AOV opties",
    features: ["100+ jaar ervaring", "Maatwerk dekking", "Online of met adviseur"],
  },
  {
    name: "Centraal Beheer",
    description: "Ook Centraal Beheer kent een prima AOV, die je met korting kunt afsluiten als je lid bent bij ZP Zaken.",
    longDescription: "Centraal Beheer is één van de bekendste verzekeraars van Nederland. Als lid van ZP Zaken profiteer je van speciale kortingen op hun arbeidsongeschiktheidsverzekering. Een betrouwbare partner met uitgebreide expertise in het verzekeren van zelfstandig ondernemers.",
    logo: "https://img.poweredcache.net/zpzaken.nl/wp-content/uploads/2021/05/cb.jpeg?rs=fit&w=768&h=566&ssl=1&format=webp",
    icon: Shield,
    link: "/verzekeringen",
    linkText: "Bekijk met korting",
    features: ["Ledenkorting", "Betrouwbaar", "Uitgebreide dekking"],
  },
  {
    name: "SharePeople",
    description: "Geen verzekering maar een crowdsurance oplossing. Alles onderling geregeld.",
    longDescription: "SharePeople biedt een vernieuwend concept: crowdsurance. In plaats van een traditionele verzekering regel je het onderling met andere professionals. Een moderne, transparante en vaak voordelige manier om risico's te delen. Perfect voor ondernemers die geloven in de kracht van samenwerking.",
    logo: "https://img.poweredcache.net/zpzaken.nl/wp-content/uploads/2021/05/4-2.png?rs=fit&w=150&h=100&ssl=1&format=webp",
    icon: Users,
    link: "/contact",
    linkText: "Meer informatie",
    features: ["Crowdsurance", "Onderling geregeld", "Transparant"],
  },
];

export default function Partners() {
  return (
    <Layout>
      {/* Hero Section */}
      <section className="bg-gradient-to-b from-primary to-primary/90 text-primary-foreground py-16 md:py-24">
        <div className="container-wide text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/10 rounded-full text-sm font-medium mb-6">
            <Handshake className="h-4 w-4" />
            Onze Partners
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            Trots dat we met onze partners samenwerken!
          </h1>
          <p className="text-lg md:text-xl text-primary-foreground/80 max-w-3xl mx-auto">
            Bij ZP Zaken zorgen we ervoor dat jij zorgeloos kunt ondernemen. Dit doen we in samenwerking 
            met onze partners, zodat we je altijd kunnen koppelen aan een specialist.
          </p>
        </div>
      </section>

      {/* Partners Grid */}
      <section className="section-padding">
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

      {/* CTA Section */}
      <section className="section-padding bg-secondary/50">
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

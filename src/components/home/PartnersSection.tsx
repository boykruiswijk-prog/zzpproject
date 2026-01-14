import { Handshake } from "lucide-react";

const partners = [
  {
    name: "Hiscox",
    description: "Gespecialiseerde risicodrager achter de beroeps- en bedrijfsaansprakelijkheidsverzekeringen en de cyberdekking.",
    logo: "https://img.poweredcache.net/zpzaken.nl/wp-content/uploads/2021/05/hiscox.png?rs=fit&w=150&h=100&ssl=1&format=webp",
  },
  {
    name: "Zorg en Zekerheid",
    description: "Elk jaar bieden we met Zorg en Zekerheid een nieuwe zorgdekking aan. Via deze partner is ook Mirro toegankelijk.",
    logo: "https://img.poweredcache.net/zpzaken.nl/wp-content/uploads/2021/05/Zorgverzekeraars-1.png?rs=fit&w=800&h=450&ssl=1&format=webp",
  },
  {
    name: "BrightPensioen",
    description: "Coöperatie waar je heel simpel je pensioen kunt opbouwen met lage kosten en zonder winstoogmerk.",
    logo: "https://img.poweredcache.net/zpzaken.nl/wp-content/uploads/2021/05/BrightPensioen_logo_RGB1.png?rs=fit&w=768&h=174&ssl=1&format=webp",
  },
  {
    name: "Movir",
    description: "Voor een uitstekende arbeidsongeschiktheidsverzekering ga je naar Movir. Online of met hulp van een adviseur.",
    logo: "https://img.poweredcache.net/zpzaken.nl/wp-content/uploads/2023/01/LogoMovir-e1675076456534.png?rs=fit&w=768&h=542&ssl=1&format=webp",
  },
  {
    name: "Centraal Beheer",
    description: "Prima AOV die je met korting kunt afsluiten als je lid bent bij ZP Zaken.",
    logo: "https://img.poweredcache.net/zpzaken.nl/wp-content/uploads/2021/05/cb.jpeg?rs=fit&w=768&h=566&ssl=1&format=webp",
  },
  {
    name: "SharePeople",
    description: "Geen verzekering maar een crowdsurance oplossing. Alles onderling geregeld.",
    logo: "https://img.poweredcache.net/zpzaken.nl/wp-content/uploads/2021/05/4-2.png?rs=fit&w=150&h=100&ssl=1&format=webp",
  },
];

export function PartnersSection() {
  return (
    <section className="section-padding bg-secondary/50">
      <div className="container-wide">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-accent/10 text-accent rounded-full text-sm font-medium mb-4">
            <Handshake className="h-4 w-4" />
            Onze Partners
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Trots dat we met onze partners samenwerken!
          </h2>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            Bij ZP Zaken zorgen we ervoor dat jij zorgeloos kunt ondernemen. Dit doen we in samenwerking met onze partners, 
            zodat we je altijd kunnen koppelen aan een specialist.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {partners.map((partner) => (
            <div 
              key={partner.name}
              className="bg-card rounded-xl p-6 shadow-card border border-border/50 flex flex-col items-center text-center hover:shadow-lg transition-shadow"
            >
              <div className="h-20 flex items-center justify-center mb-4">
                <img 
                  src={partner.logo} 
                  alt={`${partner.name} logo`} 
                  className="max-h-16 max-w-[140px] object-contain"
                />
              </div>
              <h3 className="text-lg font-semibold mb-2">{partner.name}</h3>
              <p className="text-sm text-muted-foreground">{partner.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

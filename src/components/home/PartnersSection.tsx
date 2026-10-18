import { Handshake, Heart, PiggyBank, Umbrella, Shield, Users } from "lucide-react";
import hiscoxLogo from "@/assets/partner-hiscox.webp";

const partners = [
  {
    name: "Hiscox",
    description: "Gespecialiseerde risicodrager achter de beroeps- en bedrijfsaansprakelijkheidsverzekeringen en de cyberdekking.",
    logo: hiscoxLogo, icon: Shield,
  },
  {
    name: "Onze zorgpartner",
    description: "Elk jaar bieden we met onze zorgpartner een nieuwe zorgdekking aan. Via deze partner is ook Mirro toegankelijk.",
    logo: null, icon: Heart,
  },
  {
    name: "Onze pensioenpartner",
    description: "Coöperatie waar je heel simpel je pensioen kunt opbouwen met lage kosten en zonder winstoogmerk.",
    logo: null, icon: PiggyBank,
  },
  {
    name: "Onze AOV-partner A",
    description: "Voor een arbeidsongeschiktheidsverzekering verwijzen we je naar onze AOV-partner. Online of met persoonlijk contact.",
    logo: null, icon: Umbrella,
  },
  {
    name: "Onze AOV-partner B",
    description: "Prima AOV die je met korting kunt afsluiten als je lid bent bij ZP Zaken.",
    logo: null, icon: Shield,
  },
  {
    name: "Onze partner voor inkomensondersteuning",
    description: "Geen verzekering maar een crowdsurance oplossing. Alles onderling geregeld.",
    logo: null, icon: Users,
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
            We werken samen met deze partners:
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
                {partner.logo ? <img loading="lazy" decoding="async" src={partner.logo} alt={`${partner.name} logo`} className="max-h-16 max-w-[140px] object-contain" /> : <partner.icon className="h-12 w-12 text-accent" aria-hidden="true" />}
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

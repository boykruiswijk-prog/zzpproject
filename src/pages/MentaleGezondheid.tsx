import { ServicePageTemplate } from "@/components/diensten/ServicePageTemplate";
import { Brain, HeartHandshake, Sparkles } from "lucide-react";

import teamCheers from "@/assets/team-cheers.jpg";
import officeFlowers from "@/assets/office-flowers.jpg";
import teamWalking from "@/assets/team-walking.jpg";
import officeCoffee from "@/assets/office-coffee.jpg";

const schema = {
  "@context": "https://schema.org",
  "@type": "Service",
  "name": "Mentale Gezondheid voor ZZP'ers",
  "provider": { "@type": "Organization", "name": "ZP Zaken", "url": "https://zpzaken.nl" },
  "description": "Als zzp'er is mentale fitheid cruciaal. Doe de gratis mentale gezondheidstest via Mirro en ontdek hoe fit jij bent.",
  "areaServed": "NL",
};

export default function MentaleGezondheid() {
  return (
    <ServicePageTemplate
      seoTitle="Mentale Gezondheid voor ZZP'ers | Mirro Test | ZP Zaken"
      seoDescription="Als zzp'er is mentale fitheid cruciaal. Doe de gratis mentale gezondheidstest via Mirro en ontdek hoe fit jij bent."
      canonicalPath="/mentale-gezondheid"
      heroImage={teamCheers}
      badge="Zorg voor jezelf"
      title={<>Mentale gezondheid: <span className="text-accent">De basis voor succesvol ondernemerschap</span></>}
      subtitle="Ondernemen is geweldig, maar kan ook eenzaam en stressvol zijn. Investeer in je mentale gezondheid: dat is geen luxe, maar noodzaak."
      schema={schema}
      benefits={[
        {
          icon: Brain,
          title: "Burn-out preventie",
          description: "Herken signalen van overbelasting op tijd en leer grenzen stellen. Preventie is altijd beter en goedkoper dan genezen.",
        },
        {
          icon: HeartHandshake,
          title: "Persoonlijke coaching",
          description: "Krijg toegang tot professionele coaches die begrijpen wat het is om zelfstandig te ondernemen. Laagdrempelig en vertrouwelijk.",
        },
        {
          icon: Sparkles,
          title: "Balans werk en privé",
          description: "Leer hoe je een gezonde balans vindt tussen hard werken en ontspannen. Zodat je duurzaam kunt ondernemen.",
        },
      ]}
      explainers={[
        {
          image: officeFlowers,
          title: "Waarom is dit zo belangrijk?",
          text: "Uit onderzoek blijkt dat ZZP'ers vaker last hebben van stress, eenzaamheid en burn-outklachten dan werknemers in loondienst. Toch zoeken ze minder snel hulp. Wij willen dat veranderen.",
          bullets: [
            "1 op de 5 ZZP'ers ervaart burn-outklachten",
            "Geen vangnet via werkgever of bedrijfsarts",
            "Vroegtijdige hulp voorkomt langdurig uitval",
          ],
        },
        {
          image: teamWalking,
          title: "Wat bieden wij?",
          text: "Via onze partners bieden we laagdrempelige toegang tot coaching, psychologische ondersteuning en preventieve programma's. Speciaal ontwikkeld voor zelfstandig professionals.",
          bullets: [
            "Online en offline coaching sessies",
            "Preventieve workshops en webinars",
            "Vertrouwelijk en zonder wachttijd",
          ],
        },
        {
          image: officeCoffee,
          title: "Investeer in jezelf",
          text: "Je mentale gezondheid is je belangrijkste bedrijfsmiddel. Door nu te investeren in preventie en persoonlijke ontwikkeling, voorkom je langdurige uitval en behoud je plezier in je werk.",
          bullets: [
            "Coaching als zakelijke investering",
            "Vaak deels fiscaal aftrekbaar",
            "Combineer met AOV voor complete bescherming",
          ],
        },
      ]}
      ctaTitle="Zorg goed voor jezelf als ondernemer"
      ctaSubtitle="Neem contact op voor een gesprek over mentale ondersteuning."
      ctaButton="Vrijblijvend gesprek aanvragen"
    />
  );
}

import { ServicePageTemplate } from "@/components/diensten/ServicePageTemplate";
import { Heart, Users, Euro } from "lucide-react";

import teamRoxy from "@/assets/team-roxy.jpg";
import officeCookies from "@/assets/zp-boy-laptop.jpg";
import teamMeeting from "@/assets/team-meeting.jpg";
import officeFlowers from "@/assets/office-flowers.jpg";

const schema = {
  "@context": "https://schema.org",
  "@type": "Service",
  "name": "Collectieve Zorgverzekering voor ZZP'ers",
  "provider": { "@type": "Organization", "name": "ZP Zaken", "url": "https://zpzaken.nl" },
  "description": "Profiteer van een collectieve zorgverzekering als zzp'er via ZP Zaken. Samen sterker, betere dekking voor een lagere premie.",
  "areaServed": "NL",
};

export default function Zorgverzekering() {
  return (
    <ServicePageTemplate
      seoTitle="ZZP Zorgverzekering Collectief | ZP Zaken"
      seoDescription="Profiteer van een collectieve zorgverzekering als zzp'er via ZP Zaken. Samen sterker, betere dekking voor een lagere premie."
      canonicalPath="/zorgverzekering"
      heroImage={teamRoxy}
      badge="Collectief voordeel"
      title={<>Zorgverzekering voor zzp'ers: <span className="text-accent">Collectief voordeel</span></>}
      subtitle="Als lid van het ZP Zaken collectief profiteer je van korting op je zorgverzekering. Dezelfde dekking, lagere premie."
      schema={schema}
      benefits={[
        {
          icon: Heart,
          title: "Uitgebreide dekking",
          description: "Kies uit basis- en aanvullende pakketten die passen bij jouw gezondheid en wensen. Van fysiotherapie tot tandzorg.",
        },
        {
          icon: Users,
          title: "Collectieve korting",
          description: "Via het ZP Zaken collectief ontvang je korting op je premie: zonder dat je inlevert op dekking of keuze.",
        },
        {
          icon: Euro,
          title: "Bespaar honderden euro's",
          description: "De collectiviteitskorting kan oplopen tot honderden euro's per jaar. Makkelijk overstappen, wij regelen het voor je.",
        },
      ]}
      explainers={[
        {
          image: officeCookies,
          title: "Hoe werkt de collectieve korting?",
          text: "ZP Zaken heeft als collectief afspraken gemaakt met zorgverzekeraars. Door gebruik te maken van de collectiviteit betaal je minder premie en houd je dezelfde dekking.",
          bullets: [
            "Korting op basis- en aanvullende verzekering",
            "Geen inlevering op dekking of keuze",
            "Eenvoudig overstappen via ZP Zaken",
          ],
        },
        {
          image: teamMeeting,
          title: "Welke verzekeraars zijn beschikbaar?",
          text: "We werken samen met betrouwbare zorgverzekeraars die ruime keuze bieden in pakketten. Zo vind je een verzekering die bij je past.",
          bullets: [
            "Breed aanbod van zorgverzekeraars",
            "Vergelijking op maat door onze adviseurs",
            "Hulp bij het kiezen van de juiste aanvullende dekking",
          ],
        },
        {
          image: officeFlowers,
          title: "Wanneer overstappen?",
          text: "Elk jaar kun je in november en december overstappen naar een andere zorgverzekering. We herinneren je en helpen bij de overstap.",
          bullets: [
            "Overstapperiode: november – december",
            "Wij sturen je een herinnering",
            "Persoonlijke vergelijking en informatie",
          ],
        },
      ]}
      ctaTitle="Bespaar op je zorgverzekering"
      ctaSubtitle="Ontdek hoeveel je kunt besparen met de collectieve korting van ZP Zaken."
      ctaButton="Collectieve korting bekijken"
    />
  );
}

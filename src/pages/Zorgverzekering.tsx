import { seoRoute } from "@/config/seoRoutes";
import { ServicePageTemplate } from "@/components/diensten/ServicePageTemplate";
import { Heart, Users, Euro } from "lucide-react";

import teamRoxy from "@/assets/team-roxy.webp";
import officeCookies from "@/assets/office-flowers.webp";
import officeMeetingRoom from "@/assets/office-meeting-room.webp";
import officeFlowers from "@/assets/office-flowers.webp";

const SEO = seoRoute("/zorgverzekering");

const schema = {
  "@context": "https://schema.org",
  "@type": "Service",
  "name": "Collectieve Zorgverzekering voor ZZP'ers",
  "provider": { "@type": "Organization", "name": "ZP Zaken", "url": "https://zpzaken.nl" },
  "description": "Collectieve zorgverzekering voor zzp'ers via ZP Zaken. Persoonlijk contact, binnen 24 uur reactie.",
  "areaServed": "NL",
};

export default function Zorgverzekering() {
  return (
    <ServicePageTemplate
      seoTitle={SEO.title}
      seoDescription={SEO.description}
      canonicalPath="/zorgverzekering"
      heroImage={teamRoxy}
      badge="Collectief voordeel"
      title={<>Zorgverzekering voor zzp'ers: <span className="text-accent">Collectief voordeel</span></>}
      subtitle="Via ZP Zaken kun je als zzp'er deelnemen aan een collectieve zorgverzekering. Persoonlijk contact, binnen 24 uur reactie."
      schema={schema}
      benefits={[
        {
          icon: Heart,
          title: "Uitgebreide dekking",
          description: "Kies uit basis- en aanvullende pakketten die passen bij jouw gezondheid en wensen. Van fysiotherapie tot tandzorg.",
        },
        {
          icon: Users,
          title: "Collectieve deelname",
          description: "Via het ZP Zaken collectief kun je deelnemen aan een collectieve zorgverzekering en vragen stellen over de beschikbare pakketten.",
        },
        {
          icon: Euro,
          title: "Persoonlijk contact",
          description: "We beantwoorden je vragen over deelname en de overstapperiode. Je ontvangt binnen 24 uur een reactie.",
        },
      ]}
      explainers={[
        {
          image: officeCookies,
          title: "Hoe werkt collectieve deelname?",
          text: "ZP Zaken heeft als collectief afspraken gemaakt met zorgverzekeraars. We informeren je over deelname en de beschikbare pakketten.",
          bullets: [
            "Basis- en aanvullende verzekeringen",
            "Informatie over beschikbare pakketten",
            "Persoonlijk contact over overstappen",
          ],
        },
        {
          image: officeMeetingRoom,
          title: "Welke verzekeraars zijn beschikbaar?",
          text: "We werken samen met betrouwbare zorgverzekeraars die ruime keuze bieden in pakketten. Zo vind je een verzekering die bij je past.",
          bullets: [
            "Breed aanbod van zorgverzekeraars",
            "Persoonlijk contact voor je vragen",
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
      ctaTitle="Meer weten over de collectieve zorgverzekering?"
      ctaSubtitle="Stel je vraag over deelname en de beschikbare pakketten."
      ctaButton="Informatie aanvragen"
    />
  );
}

import { ServicePageTemplate } from "@/components/diensten/ServicePageTemplate";
import { PiggyBank, TrendingUp, CalendarCheck } from "lucide-react";

import teamHero from "@/assets/team-hero.jpg";
import officeMeetingRoom from "@/assets/office-meeting-room.jpg";
import teamWalking from "@/assets/team-walking.jpg";
import officeFlowers from "@/assets/office-flowers.jpg";

export default function Pensioen() {
  return (
    <ServicePageTemplate
      seoTitle="Pensioen opbouwen als ZZP'er"
      seoDescription="Bouw als zelfstandige aan je pensioen. Ontdek de mogelijkheden voor pensioenopbouw via ZP Zaken — fiscaal voordelig en flexibel."
      canonicalPath="/pensioen"
      heroImage={teamHero}
      badge="Investeer in je toekomst"
      title={<>Pensioen opbouwen <span className="text-accent">als ZZP'er</span></>}
      subtitle="Als zelfstandige bouw je niet automatisch pensioen op. Maar er zijn slimme, fiscaal voordelige manieren om toch goed voor je oude dag te zorgen."
      benefits={[
        {
          icon: PiggyBank,
          title: "Fiscaal voordelig sparen",
          description: "Gebruik je jaarruimte en reserveringsruimte om fiscaal voordelig pensioen op te bouwen. Je betaalt minder belasting én spaart voor later.",
        },
        {
          icon: TrendingUp,
          title: "Flexibel beleggen",
          description: "Kies zelf hoeveel risico je wilt nemen. Van defensief sparen tot offensief beleggen — afgestemd op jouw horizon en wensen.",
        },
        {
          icon: CalendarCheck,
          title: "Vrijheid en controle",
          description: "Geen verplichte maandelijkse inleg. Stort wanneer het uitkomt en pas je strategie aan als je situatie verandert.",
        },
      ]}
      explainers={[
        {
          image: officeMeetingRoom,
          title: "Waarom nu starten met pensioen?",
          text: "Hoe eerder je begint, hoe meer je profiteert van het rendement op je inleg. Zelfs kleine maandelijkse bedragen groeien over 20-30 jaar uit tot een substantieel pensioenkapitaal.",
          bullets: [
            "Eerder beginnen = meer rendement op rendement",
            "Al vanaf €50 per maand mogelijk",
            "Volledige flexibiliteit in inleg",
          ],
        },
        {
          image: teamWalking,
          title: "Welke opties heb je als ZZP'er?",
          text: "Er zijn verschillende manieren om pensioen op te bouwen: via een lijfrenteverzekering, banksparen, beleggen of een combinatie. Wij helpen je de juiste keuze maken.",
          bullets: [
            "Lijfrenteverzekering of banksparen",
            "Pensioen beleggen met vrije keuze",
            "Combinatie voor optimale spreiding",
          ],
        },
        {
          image: officeFlowers,
          title: "Fiscaal voordeel benutten",
          text: "Als ZZP'er kun je gebruikmaken van je jaarruimte om fiscaal aftrekbaar te sparen. Heb je de afgelopen jaren niets opgebouwd? Dan kun je de reserveringsruimte benutten voor een extra inleg.",
          bullets: [
            "Jaarruimte: jaarlijks fiscaal aftrekbaar",
            "Reserveringsruimte: inhaalslag maken",
            "Direct belastingvoordeel in je aangifte",
          ],
        },
      ]}
      ctaTitle="Start vandaag met pensioen opbouwen"
      ctaSubtitle="Ontvang persoonlijk advies over de beste pensioenoplossing voor jouw situatie."
      ctaButton="Gratis pensioenadvies aanvragen"
    />
  );
}

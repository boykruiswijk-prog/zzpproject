import { ServicePageTemplate } from "@/components/diensten/ServicePageTemplate";
import { Shield, Clock, Euro } from "lucide-react";

import serviceVerzekeringen from "@/assets/service-verzekeringen.jpg";
import teamMeeting from "@/assets/team-meeting.jpg";
import officeCoffee from "@/assets/office-coffee.jpg";
import teamBoyCalling from "@/assets/team-boy-calling.jpg";

const schema = {
  "@context": "https://schema.org",
  "@type": "Service",
  "name": "AOV Arbeidsongeschiktheidsverzekering voor ZZP'ers",
  "provider": { "@type": "Organization", "name": "ZP Zaken", "url": "https://zpzaken.nl" },
  "description": "Bescherm je inkomen als zzp'er bij ziekte. Vergelijk en sluit direct een AOV af via ZP Zaken. Persoonlijk advies, snel geregeld.",
  "areaServed": "NL",
};

export default function AOV() {
  return (
    <ServicePageTemplate
      seoTitle="AOV Arbeidsongeschiktheidsverzekering ZZP | ZP Zaken"
      seoDescription="Bescherm je inkomen als zzp'er bij ziekte. Vergelijk en sluit direct een AOV af via ZP Zaken. Persoonlijk advies, snel geregeld."
      canonicalPath="/aov"
      heroImage={teamBoyCalling}
      badge="Bescherm je inkomen"
      title={<>AOV voor zzp'ers — <span className="text-accent">Zeker van je inkomen bij ziekte</span></>}
      subtitle="Als zelfstandige ben je zelf verantwoordelijk voor je inkomen bij ziekte of arbeidsongeschiktheid. Een AOV vangt je op wanneer je niet kunt werken."
      schema={schema}
      benefits={[
        {
          icon: Shield,
          title: "Inkomen beschermd",
          description: "Ontvang een maandelijkse uitkering als je door ziekte of een ongeval niet kunt werken. Zo behoud je financiële zekerheid.",
        },
        {
          icon: Clock,
          title: "Flexibele voorwaarden",
          description: "Kies zelf je eigen risicoperiode, uitkeringsduur en verzekerd bedrag. Zo betaal je alleen voor wat je echt nodig hebt.",
        },
        {
          icon: Euro,
          title: "Fiscaal aftrekbaar",
          description: "De premie van je AOV is volledig fiscaal aftrekbaar. Dat maakt de netto kosten aanzienlijk lager dan je denkt.",
        },
      ]}
      explainers={[
        {
          image: serviceVerzekeringen,
          title: "Waarom een AOV als ZZP'er?",
          text: "Als zelfstandige heb je geen werkgever die doorbetaalt bij ziekte. Zonder AOV sta je er financieel alleen voor. Een AOV zorgt ervoor dat je inkomen doorloopt, zodat je je kunt focussen op herstel.",
          bullets: [
            "Geen doorbetalingsplicht als zelfstandige",
            "Gemiddeld 1 op de 4 ZZP'ers wordt arbeidsongeschikt",
            "Financiële rust bij langdurige ziekte",
          ],
        },
        {
          image: teamMeeting,
          title: "Hoe werkt het afsluiten?",
          text: "Via ZP Zaken krijg je persoonlijk advies over de AOV die het beste bij jouw situatie past. We vergelijken de beste verzekeraars en zorgen voor een scherpe premie.",
          bullets: [
            "Persoonlijk advies op maat",
            "Vergelijking van top-verzekeraars",
            "Hulp bij acceptatie en medische keuring",
          ],
        },
        {
          image: officeCoffee,
          title: "Wat kost een AOV?",
          text: "De premie hangt af van je beroep, leeftijd, gewenste dekking en eigen risicoperiode. Gemiddeld betalen ZZP'ers in kantoorberoepen tussen €100 en €300 per maand — en dat is volledig aftrekbaar.",
          bullets: [
            "Premie afhankelijk van je beroep en leeftijd",
            "Eigen risicoperiode verlaagt de premie",
            "100% fiscaal aftrekbaar",
          ],
        },
      ]}
      ctaTitle="Bescherm je inkomen als zelfstandige"
      ctaSubtitle="Vraag vrijblijvend advies aan en ontdek welke AOV het beste bij jou past."
      ctaButton="Gratis AOV-advies aanvragen"
    />
  );
}

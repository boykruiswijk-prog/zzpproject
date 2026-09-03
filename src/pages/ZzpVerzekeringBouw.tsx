import { seoRoute } from "@/config/seoRoutes";
import { ServicePageTemplate } from "@/components/diensten/ServicePageTemplate";
import { faqSchema } from "@/lib/schema";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { HardHat, Shield, FileCheck } from "lucide-react";

import serviceVerzekeringen from "@/assets/service-verzekeringen.jpg";
import teamMeeting from "@/assets/team-meeting.jpg";
import officeCoffee from "@/assets/office-coffee.jpg";

const SEO = seoRoute("/zzp-verzekering-bouw");

const faqs = [
  {
    question: "Wat is het verschil tussen BAV en AVB voor bouwprofessionals?",
    answer:
      "BAV dekt schade die voortvloeit uit fouten in jouw professionele dienstverlening (ontwerp, advies, uitvoeringsfouten). AVB dekt schade aan personen of eigendommen die tijdens je werk ontstaat, los van je professionele handelen.",
  },
  {
    question: "Moet ik als bouwvakker een BAV hebben?",
    answer:
      "Dat hangt af van je werkzaamheden. Voer je advies- of ontwerptaken uit? Dan is een BAV aan te raden. Voer je alleen fysiek uitvoerend werk uit? Dan volstaat mogelijk een AVB. Vraag gratis advies.",
  },
  {
    question: "Dekt mijn verzekering ook schade die jaren later aan het licht komt?",
    answer:
      "Dat hangt af van de nawerking- en nadekkingsclausule in je polis. ZP Zaken adviseert je hierover zodat je niet voor verrassingen staat.",
  },
];

const schema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Service",
      name: "Beroepsaansprakelijkheidsverzekering Bouw",
      provider: { "@type": "Organization", name: "ZP Zaken", url: "https://zpzaken.nl" },
      description: SEO.description,
      areaServed: "NL",
    },
    faqSchema(faqs),
  ],
};

export default function ZzpVerzekeringBouw() {
  return (
    <ServicePageTemplate
      seoTitle={SEO.title}
      seoDescription={SEO.description}
      canonicalPath="/zzp-verzekering-bouw"
      heroImage={serviceVerzekeringen}
      badge="Voor bouwprofessionals"
      title={<>ZZP Verzekering voor <span className="text-accent">bouwprofessionals</span></>}
      subtitle="Als zzp'er in de bouw — aannemer, installateur, architect of constructeur — draag je verantwoordelijkheid voor de kwaliteit van je werk. Een constructiefout of schade aan eigendom kan leiden tot forse schadeclaims. ZP Zaken zorgt voor de juiste dekking."
      schema={schema}
      benefits={[
        {
          icon: HardHat,
          title: "Dekking voor constructie- en ontwerpfouten",
          description:
            "Schade die later aan het licht komt door een ontwerpfout of constructiefout in jouw werk wordt gedekt door jouw BAV-polis.",
        },
        {
          icon: Shield,
          title: "AVB voor schade op de bouwplaats",
          description:
            "Beschadig je eigendommen van de opdrachtgever of derden op de bouwplaats? Je bedrijfsaansprakelijkheidsverzekering (AVB) dekt dat.",
        },
        {
          icon: FileCheck,
          title: "Vereist bij aanbestedingen",
          description:
            "Aanbestedende diensten en grote aannemers eisen standaard een geldig verzekeringscertificaat. ZP Zaken levert die snel aan.",
        },
      ]}
      explainers={[
        {
          image: teamMeeting,
          title: "BAV en AVB in de juiste verhouding",
          text:
            "In de bouw lopen ontwerp, advies en uitvoering vaak door elkaar. Wij bepalen samen welk deel van jouw werk onder beroepsaansprakelijkheid valt en welk deel onder bedrijfsaansprakelijkheid.",
          bullets: [
            "Beroepsaansprakelijkheid voor ontwerp-, advies- en uitvoeringsfouten",
            "Bedrijfsaansprakelijkheid voor schade op de bouwplaats",
            "Verzekeringscertificaat voor aanbestedingen en hoofdaannemers",
          ],
        },
        {
          image: officeCoffee,
          title: "Advies over nawerking en nadekking",
          text:
            "Bouwschade komt soms jaren later aan het licht. Wij leggen uit wat jouw polis dan doet, zodat je weet waar je staat als een oude opdracht terugkomt.",
        },
      ]}
      ctaTitle="Vraag gratis advies aan"
      ctaSubtitle="Vertel ons welk werk je doet. Wij regelen de juiste dekking."
      ctaButton="Vraag gratis advies aan"
    >
      <section className="section-padding bg-background">
        <div className="container-wide">
          <div className="max-w-3xl mx-auto">
            <h2 className="mb-6 text-center">Veelgestelde vragen</h2>
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((f, i) => (
                <AccordionItem key={i} value={`faq-${i}`}>
                  <AccordionTrigger className="text-left">{f.question}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">{f.answer}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>
    </ServicePageTemplate>
  );
}

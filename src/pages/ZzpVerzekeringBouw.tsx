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

import serviceVerzekeringen from "@/assets/service-verzekeringen.webp";
import teamMeeting from "@/assets/team-meeting.webp";
import officeCoffee from "@/assets/office-coffee.webp";

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
      "Dat hangt af van je werkzaamheden en de eisen van je opdrachtgever. Een BAV is bedoeld voor beroepsfouten en een AVB voor schade aan personen of spullen. Heb je vragen over de aanvraag of voorwaarden? Neem persoonlijk contact met ons op.",
  },
  {
    question: "Dekt mijn verzekering ook schade die jaren later aan het licht komt?",
    answer:
      "De polisvoorwaarden zijn leidend. De dekking begint op de ingangsdatum die je kiest. Fouten van voor die datum zijn niet gedekt. Na het beëindigen van de verzekering is er geen uitloopdekking.",
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
            "In de bouw lopen ontwerp, advies en uitvoering vaak door elkaar. De polisvoorwaarden beschrijven wat onder beroepsaansprakelijkheid en bedrijfsaansprakelijkheid valt. We beantwoorden je vragen over deze voorwaarden.",
          bullets: [
            "Beroepsaansprakelijkheid voor ontwerp-, advies- en uitvoeringsfouten",
            "Bedrijfsaansprakelijkheid voor schade op de bouwplaats",
            "Verzekeringscertificaat voor aanbestedingen en hoofdaannemers",
          ],
        },
        {
          image: officeCoffee,
          title: "Vragen over de polisvoorwaarden",
          text:
            "Heb je vragen over je aanvraag of de voorwaarden? We beantwoorden ze graag. De polisvoorwaarden zijn leidend.",
        },
      ]}
      ctaTitle="Neem persoonlijk contact op"
      ctaSubtitle="Vertel ons welk werk je doet. Binnen 24 uur hoor je van ons."
      ctaButton="Neem persoonlijk contact op"
      aanvraag="terugbel"
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

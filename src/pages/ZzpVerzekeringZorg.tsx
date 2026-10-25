import { BeroepspaginaTekst } from "@/components/diensten/BeroepspaginaTekst";
import { seoRoute } from "@/config/seoRoutes";
import { ServicePageTemplate } from "@/components/diensten/ServicePageTemplate";
import { faqSchema } from "@/lib/schema";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { HeartPulse, BadgeCheck, Users } from "lucide-react";

import serviceVerzekeringen from "@/assets/service-verzekeringen.webp";
import officeMeetingRoom from "@/assets/office-meeting-room.webp";
import officeCoffee from "@/assets/office-coffee.webp";

const SEO = seoRoute("/zzp-verzekering-zorg");

const faqs = [
  {
    question: "Is een BAV verplicht als zzp'er in de zorg?",
    answer:
      "De meeste zorginstellingen eisen een geldige BAV-polis als voorwaarde voor inhuur. Controleer je opdrachtovereenkomst. Heb je vragen over de aanvraag of voorwaarden? Neem persoonlijk contact met ons op.",
  },
  {
    question: "Wat wordt gedekt bij een medische fout?",
    answer:
      "Dat hangt af van de situatie. Wat precies gedekt is, staat in de polisvoorwaarden; die zijn leidend. Aanvragen in de zorg beoordelen we per aanvraag.",
  },
  {
    question: "Heb ik naast een BAV ook een AVB nodig?",
    answer:
      "Een AVB dekt schade aan personen of eigendommen tijdens je werk, los van je professionele handelen. Werk je bij cliënten thuis, dan vragen opdrachtgevers vaak ook om een AVB.",
  },
];

const schema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Service",
      name: "Beroepsaansprakelijkheidsverzekering Zorg",
      provider: { "@type": "Organization", name: "ZP Zaken", url: "https://zpzaken.nl" },
      description: SEO.description,
      areaServed: "NL",
    },
    faqSchema(faqs),
  ],
};

export default function ZzpVerzekeringZorg() {
  return (
    <ServicePageTemplate
      seoTitle={SEO.title}
      seoDescription={SEO.description}
      canonicalPath="/zzp-verzekering-zorg"
      heroImage={serviceVerzekeringen}
      badge="Voor zorgprofessionals"
      title={<>ZZP Verzekering voor <span className="text-accent">zorgprofessionals</span></>}
      subtitle="Als zorgprofessional, verpleegkundige, fysiotherapeut, begeleider of specialist, werk je met kwetsbare mensen. Een fout of misverstand kan leiden tot schadeclaims. Een beroepsaansprakelijkheidsverzekering is er voor als een cliënt of opdrachtgever je aansprakelijk stelt voor een fout in je werk."
      schema={schema}
      benefits={[
        {
          icon: HeartPulse,
          title: "Bij een claim over je werk",
          description:
            "Stelt een cliënt of opdrachtgever je aansprakelijk, dan meld je dat bij ons. Wat precies gedekt is, staat in de polisvoorwaarden.",
        },
        {
          icon: BadgeCheck,
          title: "Vereist door zorginstellingen",
          description:
            "Zorginstellingen vragen vaak om een geldig verzekeringscertificaat voor zzp-inhuur.",
        },
        {
          icon: Users,
          title: "Persoonlijke service",
          description:
            "Zorgprofessionals hebben specifieke risico's. Ons team beantwoordt je vragen over de aanvraag en polisvoorwaarden.",
        },
      ]}
      explainers={[
        {
          image: officeMeetingRoom,
          title: "Je rol in de zorg",
          text:
            "Werk je adviserend, coachend, coördinerend of uitvoerend? Dat maakt verschil voor je risico en dus voor je polis. Heb je vragen over de aanvraag of de polisvoorwaarden? We beantwoorden ze graag.",
          bullets: [
            "Beroepsaansprakelijkheid voor fouten in je professionele handelen",
            "Bedrijfsaansprakelijkheid voor schade aan personen of eigendommen",
            "Certificaat dat je binnen 24 uur bij de zorginstelling kunt aanleveren",
          ],
        },
        {
          image: officeCoffee,
          title: "Snel geregeld, zonder papierwerk",
          text:
            "Binnen 24 uur hoor je van ons. Je ontvangt je certificaat in je mailbox.",
        },
      ]}
      ctaTitle="Neem persoonlijk contact op"
      ctaSubtitle="Vertel ons wat je doet en voor welke instelling. Binnen 24 uur hoor je van ons."
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
                  <AccordionContent className="text-muted-foreground"><BeroepspaginaTekst tekst={f.answer} /></AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>
    </ServicePageTemplate>
  );
}

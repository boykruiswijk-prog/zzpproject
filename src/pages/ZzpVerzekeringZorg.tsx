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

import serviceVerzekeringen from "@/assets/service-verzekeringen.jpg";
import teamMeeting from "@/assets/team-meeting.webp";
import officeCoffee from "@/assets/office-coffee.webp";

const SEO = seoRoute("/zzp-verzekering-zorg");

const faqs = [
  {
    question: "Is een BAV verplicht als zzp'er in de zorg?",
    answer:
      "De meeste zorginstellingen eisen een geldige BAV-polis als voorwaarde voor inhuur. Controleer je opdrachtovereenkomst. ZP Zaken adviseert je gratis over de vereiste dekking.",
  },
  {
    question: "Wat wordt gedekt bij een medische fout?",
    answer:
      "Schade die voortvloeit uit fouten in jouw professionele dienstverlening wordt gedekt. Dit omvat letselschade, vermogensschade en juridische kosten. De exacte dekking staat in je polisvoorwaarden.",
  },
  {
    question: "Heb ik naast een BAV ook een AVB nodig?",
    answer:
      "Een AVB dekt schade aan personen of eigendommen tijdens je werk — los van je professionele handelen. Voor zorgprofessionals die bij cliënten thuis werken is een AVB aan te raden.",
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
      subtitle="Als zorgprofessional — verpleegkundige, fysiotherapeut, begeleider of specialist — werk je met kwetsbare mensen. Een fout of misverstand kan leiden tot schadeclaims. Beroepsaansprakelijkheidsverzekering geeft jou de vrijheid om je werk te doen zonder financieel risico."
      schema={schema}
      benefits={[
        {
          icon: HeartPulse,
          title: "Bescherming bij medische fouten",
          description:
            "Lichamelijk letsel, verkeerd advies of een behandelingsfout — jouw polis dekt de geleden schade van jouw cliënt of patiënt.",
        },
        {
          icon: BadgeCheck,
          title: "Vereist door zorginstellingen",
          description:
            "Ziekenhuizen, thuiszorgorganisaties en GGZ-instellingen eisen standaard een geldig BAV-certificaat voor zzp-inhuur.",
        },
        {
          icon: Users,
          title: "Persoonlijk advies op maat",
          description:
            "Zorgprofessionals hebben specifieke risico's. Onze adviseurs kennen de sector en zorgen voor de juiste dekking.",
        },
      ]}
      explainers={[
        {
          image: teamMeeting,
          title: "Dekking die past bij jouw zorgrol",
          text:
            "Werk je adviserend, coachend, coördinerend of uitvoerend? Dat maakt verschil voor je risico en dus voor je polis. Wij kijken samen naar je werkzaamheden en opdrachtovereenkomst.",
          bullets: [
            "Beroepsaansprakelijkheid voor fouten in je professionele handelen",
            "Bedrijfsaansprakelijkheid voor schade aan personen of eigendommen",
            "Certificaat dat je direct bij de zorginstelling kunt aanleveren",
          ],
        },
        {
          image: officeCoffee,
          title: "Snel geregeld, zonder papierwerk",
          text:
            "Je aanvraag wordt dezelfde dag opgepakt en je ontvangt je polis digitaal. Zo kun je zonder vertraging aan een nieuwe opdracht beginnen.",
        },
      ]}
      ctaTitle="Vraag gratis advies aan"
      ctaSubtitle="Vertel ons wat je doet en voor welke instelling. Wij regelen de juiste dekking."
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

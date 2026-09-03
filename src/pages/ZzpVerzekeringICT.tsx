import { seoRoute } from "@/config/seoRoutes";
import { ServicePageTemplate } from "@/components/diensten/ServicePageTemplate";
import { faqSchema } from "@/lib/schema";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Monitor, ShieldCheck, Clock } from "lucide-react";

import serviceVerzekeringen from "@/assets/service-verzekeringen.jpg";
import teamMeeting from "@/assets/team-meeting.jpg";
import officeCoffee from "@/assets/office-coffee.jpg";

const SEO = seoRoute("/zzp-verzekering-ict");

const faqs = [
  {
    question: "Moet ik als ICT-freelancer verplicht verzekerd zijn?",
    answer:
      "Veel opdrachtgevers eisen een BAV-polis in hun raamcontract. Controleer je overeenkomst. ZP Zaken adviseert je gratis over de minimale dekking die jouw opdrachtgever verwacht.",
  },
  {
    question: "Wat is de minimale dekking voor ICT-freelancers?",
    answer:
      "In de ICT-sector is €500.000 per aanspraak gebruikelijk. Voor grotere opdrachtgevers (overheid, banken) kan €1.000.000 vereist zijn. Wij adviseren je op maat.",
  },
  {
    question: "Dekt een BAV ook schade door een datalek?",
    answer:
      "Ja, beroepsaansprakelijkheid dekt ook schade die voortvloeit uit fouten in je dienstverlening, waaronder indirect veroorzaakte datalekken. Vraag je adviseur naar de exacte polisvoorwaarden.",
  },
];

const schema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Service",
      name: "Beroepsaansprakelijkheidsverzekering ICT",
      provider: { "@type": "Organization", name: "ZP Zaken", url: "https://zpzaken.nl" },
      description: SEO.description,
      areaServed: "NL",
    },
    faqSchema(faqs),
  ],
};

export default function ZzpVerzekeringICT() {
  return (
    <ServicePageTemplate
      seoTitle={SEO.title}
      seoDescription={SEO.description}
      canonicalPath="/zzp-verzekering-ict"
      heroImage={serviceVerzekeringen}
      badge="Voor IT-freelancers"
      title={<>ZZP Verzekering voor <span className="text-accent">ICT-freelancers</span></>}
      subtitle="Als ICT-freelancer schrijf je code, implementeer je systemen of geef je advies. Een fout in je werk kan grote financiële gevolgen hebben voor je opdrachtgever. Beroepsaansprakelijkheidsverzekering (BAV) is in de ICT-sector bij veel opdrachtgevers verplicht en beschermt jou én je klant."
      schema={schema}
      benefits={[
        {
          icon: Monitor,
          title: "Veelgevraagd door opdrachtgevers",
          description:
            "De meeste grote ICT-opdrachtgevers eisen een BAV-polis met minimaal €500.000 dekking. ZP Zaken regelt dit snel en zorgt dat je voldoet.",
        },
        {
          icon: ShieldCheck,
          title: "Dekking voor datalekken en fouten",
          description:
            "Softwarefouten, onjuist advies of een datalek — jouw polis dekt de schade die jouw opdrachtgever lijdt.",
        },
        {
          icon: Clock,
          title: "Binnen 24 uur verzekerd",
          description:
            "Geen wachttijden. Je ontvangt je polis dezelfde dag digitaal, zodat je morgen kunt starten.",
        },
      ]}
      explainers={[
        {
          image: teamMeeting,
          title: "De juiste dekking voor jouw ICT-opdrachten",
          text:
            "Of je nu als software-architect, product owner of IT-consultant werkt: de risico's zitten in het werk zelf. Wij kijken naar jouw opdrachten en contracten en bepalen samen welke dekking daar bij hoort.",
          bullets: [
            "Beroepsaansprakelijkheid voor fouten in code, advies of implementatie",
            "Bedrijfsaansprakelijkheid voor schade aan personen of eigendommen",
            "Certificaat dat je direct aan je opdrachtgever kunt doorsturen",
          ],
        },
        {
          image: officeCoffee,
          title: "Persoonlijk advies, geen callcenter",
          text:
            "Je krijgt een vaste adviseur die de ICT-markt kent en weet wat opdrachtgevers in raamcontracten vragen. Zo voorkom je dat je te ruim of te krap verzekerd bent.",
        },
      ]}
      ctaTitle="Vraag gratis advies aan"
      ctaSubtitle="Vertel ons wat je doet en voor wie. Wij regelen de juiste dekking."
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

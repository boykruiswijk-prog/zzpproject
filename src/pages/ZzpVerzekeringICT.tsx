import { CYBER_DEKKING, CYBER_HULP, CYBER_POLISVOORWAARDEN, CYBER_LOOPTIJD } from "../../supabase/functions/_shared/cyber";
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
import { BAVApplicationModule } from "@/components/home/BAVApplicationModule";
import { bavPakketten, formatMiljoenKort } from "@/data/bavPakketten";
import { LeesMeer } from "@/components/kennisbank/LeesMeer";

import serviceVerzekeringen from "@/assets/service-verzekeringen.webp";
import teamMeeting from "@/assets/team-meeting.webp";
import officeCoffee from "@/assets/office-coffee.webp";

const SEO = seoRoute("/zzp-verzekering-ict");

const PAKKET = bavPakketten[0];
const BAV_DEKKING = formatMiljoenKort(PAKKET.dekkingen.bav.perGebeurtenis);
const AVB_DEKKING = formatMiljoenKort(PAKKET.dekkingen.avb.perGebeurtenis);

const faqs = [
  {
    question: "Moet ik als ICT-freelancer verplicht verzekerd zijn?",
    answer:
      "Veel opdrachtgevers eisen een BAV-polis in hun raamcontract. Controleer je overeenkomst. Heb je vragen over de aanvraag of voorwaarden? Neem persoonlijk contact met ons op.",
  },
  {
    question: "Wat is de minimale dekking voor ICT-freelancers?",
    answer:
      `Onze combinatiepolis dekt standaard ${BAV_DEKKING} BAV en ${AVB_DEKKING} AVB per aanspraak. Twijfel je over de eis in je contract? Wij kijken gratis mee.`,
  },
  {
    question: "Dekt een BAV ook schade door een datalek?",
    answer:
      `Dat hangt af van de situatie. Cyber kan bij maand- en jaarbetaling alleen samen met BAV + AVB. ${CYBER_DEKKING} ${CYBER_HULP} ${CYBER_LOOPTIJD} ${CYBER_POLISVOORWAARDEN}`,
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
            `De meeste grote ICT-opdrachtgevers eisen een BAV-polis. Bij ons ben je standaard verzekerd voor ${BAV_DEKKING} BAV en ${AVB_DEKKING} AVB per aanspraak.`,
        },
        {
          icon: ShieldCheck,
          title: "Beschermd bij fouten in je werk",
          description:
            "Een softwarefout of onjuist advies kan schade geven bij je opdrachtgever. Je BAV beschermt je als je daarvoor aansprakelijk wordt gesteld. De polisvoorwaarden zijn leidend.",
        },
        {
          icon: Clock,
          title: "Binnen 24 uur geregeld, certificaat in je mailbox",
          description:
            "Geen wachttijden. Je sluit online af, binnen 24 uur is het geregeld en staat je certificaat in je mailbox.",
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
          title: "Persoonlijk contact, geen callcenter",
          text:
            "Je hebt een vast aanspreekpunt voor vragen over je aanvraag en de polisvoorwaarden.",
        },
      ]}
      ctaTitle="Neem persoonlijk contact op"
      ctaSubtitle="Vertel ons wat je doet en voor wie. Wij regelen de juiste dekking."
      ctaButton="Neem persoonlijk contact op"
      aanvraag="direct"
    >
      <BAVApplicationModule initialSector="ict" />
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
      <LeesMeer voorkeur={["cyberverzekering-zzp", "bav-afsluiten-als-zzper-dit-is-waarom-en-hoe-je-het-regelt", "wat-kosten-verzekeringen-voor-zzp-ers", "welke-verzekeringen-zzp", "bedrijfsaansprakelijkheidsverzekering-zzp"]} />
    </ServicePageTemplate>
  );
}

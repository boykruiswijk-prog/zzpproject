import { CYBER_LOOPTIJD } from "../../supabase/functions/_shared/cyber";
import { CYBER_DEKKING_EN_HULP, CYBER_VOORWAARDEN_OPVRAGEN } from "../config/cyberPubliek";
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
import { Monitor, ShieldCheck, Clock } from "lucide-react";
import { BAVApplicationModule } from "@/components/home/BAVApplicationModule";
import { bavPakketten, formatMiljoenKort } from "@/data/bavPakketten";
import { Link } from "react-router-dom";
import { LeesMeer } from "@/components/kennisbank/LeesMeer";

import serviceVerzekeringen from "@/assets/service-verzekeringen.webp";
import officeMeetingRoom from "@/assets/office-meeting-room.webp";
import officeCoffee from "@/assets/office-coffee.webp";

const SEO = seoRoute("/zzp-verzekering-ict");

const PAKKET = bavPakketten[0];
const BAV_DEKKING = formatMiljoenKort(PAKKET.dekkingen.bav.perGebeurtenis);
const AVB_DEKKING = formatMiljoenKort(PAKKET.dekkingen.avb.perGebeurtenis);

const faqs = [
  {
    question: "Welke aansprakelijkheidsverzekering heb ik nodig als freelance ICT'er?",
    answer:
      "Meestal een BAV voor fouten in je werk, zoals een bug, een verkeerde configuratie of onjuist advies, en een AVB voor schade aan personen of spullen. Bij ZP Zaken zitten beide in één polis, met een verzekerd bedrag per aanspraak. Wat precies gedekt is, lees je in de polisvoorwaarden.",
  },
  {
    question: "Wat kost een BAV voor een ICT-zzp'er?",
    answer:
      "Bij ZP Zaken betaal je voor BAV en AVB samen € 55 per maand of € 600 per jaar, inclusief kosten en assurantiebelasting. Ben je korter dan 12 maanden ingeschreven bij de KVK, dan kan het starterspakket gelden: € 45 per maand of € 495 per jaar de eerste 12 maanden, daarna € 55 per maand of € 600 per jaar, onder voorbehoud van controle van je KVK-inschrijving.",
  },
  {
    question: "Hoe snel heb ik een polisbewijs voor mijn opdrachtgever?",
    answer:
      "Je vraagt online aan en het is binnen 24 uur geregeld. Je certificaat komt in je mailbox, zodat je het direct aan je opdrachtgever of bureau kunt doorsturen. De dekking gaat in op de ingangsdatum die je zelf kiest, vroegst morgen.",
  },
  {
    question: "Moet ik als ICT-freelancer verplicht verzekerd zijn?",
    answer:
      "Veel opdrachtgevers eisen een BAV-polis in hun raamcontract. Controleer je overeenkomst. Heb je vragen over de aanvraag of voorwaarden? Neem persoonlijk contact met ons op.",
  },
  {
    question: "Wat is de minimale dekking voor ICT-freelancers?",
    answer:
      `Onze combinatiepolis dekt standaard ${BAV_DEKKING} BAV en ${AVB_DEKKING} AVB per aanspraak. Heb je vragen over de aanvraag of de voorwaarden? Neem persoonlijk contact met ons op.`,
  },
  {
    question: "Dekt een BAV ook schade door een datalek?",
    answer:
      `Dat hangt af van de situatie. Cyber kan alleen samen met BAV + AVB, met betaling per maand of per jaar. ${CYBER_DEKKING_EN_HULP} ${CYBER_LOOPTIJD} ${CYBER_VOORWAARDEN_OPVRAGEN}`,
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
      title={<>Aansprakelijkheidsverzekering voor ICT-zzp'ers: <span className="text-accent">BAV en AVB in één polis</span></>}
      subtitle={SEO.intro}
      schema={schema}
      benefits={[
        {
          icon: Monitor,
          title: "Veelgevraagd door opdrachtgevers",
          description:
            `Veel opdrachtgevers en bureaus in de ICT vragen om een BAV en een polisbewijs voordat je start. Bij ons ben je standaard verzekerd voor ${BAV_DEKKING} BAV en ${AVB_DEKKING} AVB per aanspraak.`,
        },
        {
          icon: ShieldCheck,
          title: "Verzekerd bij fouten in je werk",
          description:
            "Een softwarefout of onjuist advies kan schade geven bij je opdrachtgever. Je BAV verzekert je als je daarvoor aansprakelijk wordt gesteld, volgens de polisvoorwaarden. De polisvoorwaarden zijn leidend.",
        },
        {
          icon: Clock,
          title: "Binnen 24 uur geregeld, certificaat in je mailbox",
          description:
            "Geen wachttijden. Je vraagt online aan, binnen 24 uur is het geregeld en staat je certificaat in je mailbox.",
        },
      ]}
      explainers={[
        {
          image: officeMeetingRoom,
          title: "Dekking voor je ICT-opdrachten",
          text:
            "Of je nu als software-architect, product owner of IT-consultant werkt: de risico's zitten in het werk zelf. Wat precies gedekt is, staat in de polisvoorwaarden.",
          bullets: [
            "Beroepsaansprakelijkheid voor fouten in code, advies of implementatie",
            "Bedrijfsaansprakelijkheid voor schade aan personen of eigendommen",
            "Certificaat dat je binnen 24 uur aan je opdrachtgever kunt doorsturen",
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
      ctaSubtitle="Vertel ons wat je doet en voor wie. We helpen je graag met je aanvraag."
      ctaButton="Neem persoonlijk contact op"
      aanvraag="snel"
    >
      <BAVApplicationModule initialSector="ict" compactPakketten />
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
            <p className="mt-6 text-center">
              <Link to="/kennisbank/bav-ict-zzp-risicos" className="text-accent underline underline-offset-4">Lees meer over de risico's voor ICT-zzp'ers</Link>
            </p>
          </div>
        </div>
      </section>
      <LeesMeer voorkeur={["cyberverzekering-zzp", "bav-afsluiten-als-zzper-dit-is-waarom-en-hoe-je-het-regelt", "wat-kosten-verzekeringen-voor-zzp-ers", "welke-verzekeringen-zzp", "bedrijfsaansprakelijkheidsverzekering-zzp"]} />
    </ServicePageTemplate>
  );
}

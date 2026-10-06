import { Award, ShieldCheck, Users } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { seoRoute } from "@/config/seoRoutes";
import { ServicePageTemplate } from "@/components/diensten/ServicePageTemplate";
import { faqSchema } from "@/lib/schema";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { LocalizedLink } from "@/components/LocalizedLink";
import { formatMiljoenKort, getPakket } from "@/data/bavPakketten";
import { STARTER, STARTER_VOORWAARDE_TEKST } from "@/lib/starterTarief";

import serviceVerzekeringen from "@/assets/service-verzekeringen.webp";
import teamMeeting from "@/assets/team-meeting.webp";
import officeCoffee from "@/assets/office-coffee.webp";

const PATH = "/starters";
const PAKKET = getPakket("maandelijks");
const BAV = formatMiljoenKort(PAKKET.dekkingen.bav.perGebeurtenis);
const AVB = formatMiljoenKort(PAKKET.dekkingen.avb.perGebeurtenis);

export const STARTERS_FAQS = [
  { question: "Wie kan het startertarief krijgen?", answer: `Zzp'ers met een KVK-inschrijving jonger dan 12 maanden op de ingangsdatum van de polis. Wij kijken naar de startdatum op je KVK-uittreksel. ${STARTER_VOORWAARDE_TEKST}` },
  { question: "Wat betaal ik na de eerste 12 maanden?", answer: `Na 12 maanden betaal je automatisch de gewone prijs: € ${STARTER.naMaandprijs} per maand of € ${STARTER.naJaarprijs} per jaar, inclusief kosten en assurantiebelasting. Je hoeft daarvoor niets te doen.` },
  { question: "Is de dekking anders dan bij de gewone BAV + AVB?", answer: `Nee. Het is dezelfde polis met dezelfde dekking en dezelfde voorwaarden: BAV ${BAV} en AVB ${AVB} per gebeurtenis, verzekerd bij Hiscox.` },
  { question: "Kan ik maandelijks opzeggen?", answer: "Ja. Betaal je per maand, dan is je polis maandelijks opzegbaar, net als bij de gewone maandbetaling." },
  { question: "Hoe controleren jullie mijn KVK-startdatum?", answer: "Je vult de startdatum van je KVK-inschrijving in bij je aanvraag. Een collega controleert die datum voordat je polis ingaat. Klopt de datum niet, dan geldt de gewone prijs en hoor je dat van ons." },
];

export default function Starters() {
  const SEO = seoRoute(PATH);
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        name: "Starterspakket BAV + AVB voor zzp'ers",
        provider: { "@type": "Organization", name: "ZP Zaken", url: "https://zpzaken.nl" },
        description: SEO.description,
        areaServed: "NL",
        offers: [
          { "@type": "Offer", name: "Startertarief per maand, eerste 12 maanden", price: STARTER.maandprijs, priceCurrency: "EUR", eligibleCustomerType: "Zzp'er met KVK-inschrijving jonger dan 12 maanden", description: STARTER_VOORWAARDE_TEKST },
          { "@type": "Offer", name: "Startertarief per jaar, eerste 12 maanden", price: STARTER.jaarprijs, priceCurrency: "EUR", eligibleCustomerType: "Zzp'er met KVK-inschrijving jonger dan 12 maanden", description: STARTER_VOORWAARDE_TEKST },
        ],
      },
      faqSchema(STARTERS_FAQS),
    ],
  };

  return (
    <ServicePageTemplate
      seoTitle={SEO.title}
      seoDescription={SEO.description}
      canonicalPath={PATH}
      heroImage={serviceVerzekeringen}
      badge="Voor nieuwe zzp'ers"
      title={<>Starterspakket <span className="text-accent">BAV + AVB</span></>}
      subtitle="Net begonnen als zzp'er? Regel vanaf je eerste opdracht een goede beroeps- en bedrijfsaansprakelijkheidsverzekering in één polis, met een startertarief voor het eerste jaar."
      schema={schema}
      benefits={[
        { icon: Award, title: "De bedenker van BAV + AVB in één polis", description: "ZP Zaken bracht de BAV en AVB als eerste samen in één polis voor zzp'ers en is marktleider." },
        { icon: Users, title: "13+ jaar, 5.000+ zzp'ers", description: "Al meer dan 13 jaar verzekeren wij zzp'ers. Meer dan 5.000 zzp'ers gingen je voor." },
        { icon: ShieldCheck, title: "Verzekerd bij Hiscox", description: `BAV ${BAV} en AVB ${AVB} per gebeurtenis. Zelfde polis, dekking en voorwaarden als de gewone BAV + AVB.` },
      ]}
      explainers={[
        { image: teamMeeting, title: "Zekerheid vanaf je eerste opdracht", text: "Veel opdrachtgevers vragen om een BAV. Met de BAV + AVB ben je verzekerd als een fout in je werk of een ongeluk op locatie schade veroorzaakt.", bullets: ["Beroepsaansprakelijkheid en bedrijfsaansprakelijkheid in één polis", "Certificaat direct te delen met je opdrachtgever", "Maandelijks opzegbaar bij maandbetaling"] },
        { image: officeCoffee, title: "Zo werkt het startertarief", text: `${STARTER_VOORWAARDE_TEKST} Je vult bij je aanvraag de startdatum van je KVK-inschrijving in. Wij controleren die datum voordat je polis ingaat.` },
      ]}
      ctaTitle="Vragen over het starterspakket?"
      ctaSubtitle="Wij helpen je graag verder. Bel of stuur ons een bericht."
      ctaButton="Neem contact op"
    >
      <section className="section-padding bg-background" id="prijs">
        <div className="container-wide">
          <div className="max-w-3xl mx-auto rounded-2xl border bg-card p-8 text-center shadow-sm">
            <h2 className="mb-4">Startertarief</h2>
            <p className="text-3xl font-bold">€ {STARTER.maandprijs} per maand <span className="text-muted-foreground text-xl font-medium">of</span> € {STARTER.jaarprijs} per jaar</p>
            <p className="mt-4 text-muted-foreground">{STARTER_VOORWAARDE_TEKST}</p>
            <p className="mt-2 text-sm text-muted-foreground">Na 12 maanden gaat je polis automatisch over naar de gewone prijs. Dekking en voorwaarden blijven gelijk.</p>
            <Button variant="accent" size="lg" className="mt-6" asChild>
              <LocalizedLink to="/#combinatiepolis">Vraag het starterspakket aan <ArrowRight className="h-5 w-5" /></LocalizedLink>
            </Button>
          </div>
        </div>
      </section>
      <section className="section-padding bg-background">
        <div className="container-wide">
          <div className="max-w-3xl mx-auto">
            <h2 className="mb-6 text-center">Veelgestelde vragen</h2>
            <Accordion type="single" collapsible className="w-full">
              {STARTERS_FAQS.map((f, i) => (
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

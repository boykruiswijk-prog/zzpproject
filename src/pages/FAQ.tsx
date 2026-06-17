import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { Layout } from "@/components/layout/Layout";
import { PageHero } from "@/components/layout/PageHero";
import { HelpCircle } from "lucide-react";
import { LocalizedLink } from "@/components/LocalizedLink";
import officeFlowers from "@/assets/office-flowers.jpg";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

// FAQ items stay in Dutch as content - they are domain-specific
const faqItems = [
  {
    category: "Verzekeringen",
    questions: [
      { question: "Wat is een AOV en waarom heb ik die nodig als zzp'er?", answer: "Een Arbeidsongeschiktheidsverzekering (AOV) beschermt je inkomen als je door ziekte of een ongeval niet meer kunt werken. Als zzp'er heb je geen werkgever die je doorbetaalt bij ziekte, dus een AOV zorgt ervoor dat je financieel niet in de problemen komt. De verzekering keert maandelijks een bedrag uit zolang je arbeidsongeschikt bent." },
      { question: "Wat is het verschil tussen een BAV en een AVB?", answer: "Een Beroepsaansprakelijkheidsverzekering (BAV) dekt schade die ontstaat door fouten in je werk, zoals verkeerd advies of een fout in een ontwerp. Een Aansprakelijkheidsverzekering Bedrijven (AVB) dekt schade aan personen of spullen die je per ongeluk veroorzaakt tijdens je werk, zoals een laptop die je laat vallen bij een klant. Veel zzp'ers hebben beide verzekeringen nodig." },
      { question: "Kan ik mijn verzekeringen combineren voor korting?", answer: "Ja, bij ZP Zaken bieden we een combinatiepolis aan waarbij je je BAV en AVB kunt bundelen. Je krijgt korting en houdt overzicht met één polis en één premie. Je bespaart gemiddeld 15-20% ten opzichte van losse verzekeringen." },
      { question: "Hoe snel kan ik een verzekering afsluiten?", answer: "Bij ZP Zaken kun je binnen 24 uur verzekerd zijn. Na het invullen van je gegevens ontvang je direct een offerte. Na akkoord wordt je polis dezelfde dag nog opgemaakt en ontvang je je polisblad per e-mail. In urgente gevallen kunnen we dezelfde dag nog dekking regelen." },
      { question: "Wat kost een AOV gemiddeld per maand?", answer: "De premie van een AOV hangt af van je beroep, leeftijd, gewenste uitkering en wachttijd. Gemiddeld betalen zzp'ers tussen de €150 en €400 per maand. Bij ZP Zaken zoeken we de beste prijs-kwaliteitverhouding door verschillende verzekeraars te vergelijken." },
    ]
  },
  {
    category: "Over ZP Zaken",
    questions: [
      { question: "Is ZP Zaken onafhankelijk?", answer: "Ja, ZP Zaken is volledig onafhankelijk. Wij zijn niet gebonden aan één verzekeraar en kunnen daarom adviseren welke verzekering bij je past. We vergelijken producten van verschillende aanbieders om de beste oplossing voor jou te vinden." },
      { question: "Wat kost advies bij ZP Zaken?", answer: "Een eerste adviesgesprek bij ZP Zaken is altijd gratis en vrijblijvend. We bespreken je situatie, wensen en mogelijkheden zonder dat je ergens aan vastzit. Pas als je besluit een verzekering af te sluiten, ontvangen wij een vergoeding van de verzekeraar." },
      { question: "Hoe kan ik contact opnemen met ZP Zaken?", answer: "Je kunt ons bereiken via telefoon (020 - 457 3077), e-mail (info@zpzaken.nl) of via het contactformulier op onze website. We reageren binnen 24 uur op alle berichten. Je kunt ook langskomen op ons kantoor in Schiphol-Rijk voor een persoonlijk gesprek." },
      { question: "Is ZP Zaken aangesloten bij een klachteninstantie?", answer: "Ja, ZP Zaken is aangesloten bij het Kifid (Klachteninstituut Financiële Dienstverlening). Mocht je onverhoopt een klacht hebben die we niet samen kunnen oplossen, dan kun je deze voorleggen aan het Kifid. Daarnaast staan we geregistreerd bij de AFM onder vergunningsnummer 12050636." },
    ]
  },
  {
    category: "Mijn verzekering beheren",
    questions: [
      { question: "Hoe kan ik mijn verzekering opzeggen?", answer: "Je verzekering opzeggen kan dagelijks. Start de opzeg-wizard op /mijn-zp/opzeggen en geef de reden en gewenste opzegdatum op. Wij verwerken je opzegging binnen 24 uur en sturen je een bevestiging per mail." },
      { question: "Hoe pauzeer ik mijn verzekering?", answer: "Heb je tijdelijk geen opdracht of ga je tijdelijk in loondienst? Dan kun je je verzekering eenvoudig pauzeren via de pauzeer-wizard op /mijn-zp/pauzeren. Wij verwerken je pauzering binnen 24 uur en jouw uitlooprisico blijft tijdens de pauze gewoon behouden." },
      { question: "Hoe vraag ik mijn polis op?", answer: "Heb je je polis nodig om aan een opdrachtgever te tonen? Vraag je polis op via de wizard op /mijn-zp/polis. Wij sturen je polis binnen 24 uur per mail." },
      { question: "Hoe ontvang ik kopieën van mijn polisstukken?", answer: "Heb je je polisblad, polisvoorwaarden of een ander document nodig? Vraag je documenten op via de wizard op /mijn-zp/documenten. Je ontvangt ze binnen 24 uur per mail." },
      { question: "Wat gebeurt er met mijn uitlooprisico als ik pauzeer?", answer: "Jouw uitlooprisico blijft tijdens een pauze gewoon behouden. Schades die voortvloeien uit werkzaamheden van vóór de pauze blijven gedekt. Je bent alleen niet verzekerd voor nieuwe werkzaamheden tijdens de pauze." },
    ]
  },
  {
    category: "Onze verzekering",
    questions: [
      { question: "Bieden jullie een passende oplossing voor een BV?", answer: "Ja, ook voor een besloten vennootschap (BV) hebben wij passende beroeps- en bedrijfsaansprakelijkheidsverzekeringen. Neem contact op via 020 - 457 3077 voor een persoonlijk advies." },
      { question: "Heb ik zowel een beroeps- als een bedrijfsaansprakelijkheidsverzekering nodig?", answer: "Een BAV dekt schade door fouten in je werk (verkeerd advies, fout ontwerp). Een AVB dekt schade aan personen of spullen. Voor de meeste zzp'ers zijn beide aan te raden. Onze combinatiepolis bundelt ze met korting." },
      { question: "Kan ik mijn beroep altijd verzekeren bij ZP Zaken?", answer: "Wij verzekeren een groot deel van de zakelijke dienstverlening: ICT, consultancy, HR & finance, PR & marketing, coaching en management. Voor andere beroepen overleggen we graag of dekking mogelijk is." },
      { question: "Moet ik doorgeven dat ik nieuwe opdrachten heb?", answer: "Nee. Zolang je werkzaamheden binnen je verzekerde beroep vallen, ben je automatisch gedekt voor nieuwe opdrachten. Verandert de aard van je werk substantieel, geef dit dan even door." },
      { question: "Kunnen mijn andere opdrachten ook onder deze polis?", answer: "Ja, alle zakelijke werkzaamheden binnen het verzekerde beroep vallen onder dezelfde polis — ongeacht hoeveel opdrachtgevers je hebt." },
      { question: "Hoe lang zit ik aan deze verzekering vast?", answer: "Onze verzekeringen zijn dagelijks opzegbaar. Geen jaarcontract, geen verborgen voorwaarden." },
      { question: "Wat moet ik doen als mijn bedrijf aansprakelijk wordt gesteld?", answer: "Neem direct contact op met ons via 020 - 457 3077 of info@zpzaken.nl. Wij melden de schade bij de verzekeraar en begeleiden je door het proces." },
      { question: "Wanneer begint en eindigt de verzekering?", answer: "De verzekering begint op de door jou gekozen ingangsdatum (maximaal 6 maanden vooruit) en loopt door totdat je opzegt. Dagelijks opzegbaar." },
      { question: "Mijn bedrijfsgegevens veranderen, hoe geef ik dat door?", answer: "Mail je nieuwe gegevens naar info@zpzaken.nl met je polisnummer. Wij werken je polis binnen 24 uur bij." },
      { question: "Hoeveel personen zijn er verzekerd met de BAV & AVB verzekering van ZP Zaken?", answer: "Standaard ben je als zzp'er met maximaal 3 medewerkers verzekerd binnen onze polis. Heb je meer medewerkers? Neem contact op voor een passend voorstel." },
    ]
  },
  {
    category: "Screening & Administratie",
    questions: [
      { question: "Wat is een VOG en heb ik die nodig?", answer: "Een Verklaring Omtrent het Gedrag (VOG) is een officieel document waaruit blijkt dat je geen strafbare feiten hebt gepleegd die relevant zijn voor je werk. Steeds meer opdrachtgevers vragen om een VOG, vooral in de zorg, onderwijs en financiële sector. Via ZP Zaken kun je eenvoudig een screening aanvragen." },
      { question: "Hoe lang duurt een screening?", answer: "Een standaard screening duurt gemiddeld 3-5 werkdagen. Bij spoed kunnen we dit vaak versnellen. De doorlooptijd hangt af van het type screening en de snelheid waarmee referenties reageren. Je ontvangt direct bericht zodra de screening is afgerond." },
      { question: "Biedt ZP Zaken ook hulp bij administratie?", answer: "Ja, via onze partners bieden we ondersteuning bij je financiële administratie. Dit varieert van facturatie en boekhouding tot BTW-aangiftes en jaarrekeningen. Zo heb je je administratie op orde." },
    ]
  },
];

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": faqItems.flatMap(category => 
    category.questions.map(item => ({
      "@type": "Question",
      "name": item.question,
      "acceptedAnswer": { "@type": "Answer", "text": item.answer }
    }))
  )
};

export default function FAQ() {
  const { t } = useTranslation();

  return (
    <Layout>
      <Helmet>
        <title>Veelgestelde Vragen over ZZP Verzekeringen | ZP Zaken</title>
        <meta name="description" content="Antwoorden op de meest gestelde vragen over BAV, AVB, AOV en ondernemen als zzp'er. Antwoorden van ZP Zaken." />
        <link rel="canonical" href="https://zpzaken.nl/faq" />
      </Helmet>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      <PageHero
        title={t("faq.title")}
        subtitle={t("faq.subtitle")}
        badge={{ icon: <HelpCircle className="h-4 w-4" />, text: t("faq.badge") }}
        backgroundImage={officeFlowers}
      />

      <section className="section-padding bg-background">
        <div className="container-wide max-w-4xl">
          {faqItems.map((category, categoryIndex) => (
            <div key={category.category} className="mb-12 last:mb-0">
              <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center text-sm font-bold">{categoryIndex + 1}</span>
                {category.category}
              </h2>
              <Accordion type="single" collapsible className="space-y-3">
                {category.questions.map((item, index) => (
                  <AccordionItem key={index} value={`${category.category}-${index}`} className="bg-card border border-border/50 rounded-xl px-6 data-[state=open]:shadow-md transition-shadow">
                    <AccordionTrigger className="text-left hover:no-underline py-5">
                      <span className="font-medium pr-4">{item.question}</span>
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground pb-5 leading-relaxed">{item.answer}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          ))}
        </div>
      </section>

      <section className="section-padding bg-secondary">
        <div className="container-wide text-center max-w-2xl mx-auto">
          <h2 className="text-2xl font-semibold mb-4">{t("faq.ctaTitle")}</h2>
          <p className="text-muted-foreground mb-8">{t("faq.ctaSubtitle")}</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <Button variant="accent" size="lg" asChild>
              <LocalizedLink to="/contact">{t("faq.ctaButton")}</LocalizedLink>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <a href="tel:0204573077">{t("faq.ctaPhone")}</a>
            </Button>
          </div>

          {/* Internal linking */}
          <div className="flex flex-wrap justify-center gap-3 pt-6 border-t border-border">
            <LocalizedLink to="/verzekeringen" className="text-sm text-muted-foreground hover:text-accent transition-colors">
              {t("faqLinks.viewInsurance")}
            </LocalizedLink>
            <LocalizedLink to="/kennisbank" className="text-sm text-muted-foreground hover:text-accent transition-colors">
              {t("faqLinks.knowledgeBase")}
            </LocalizedLink>
            <LocalizedLink to="/diensten" className="text-sm text-muted-foreground hover:text-accent transition-colors">
              {t("faqLinks.allServices")}
            </LocalizedLink>
          </div>
        </div>
      </section>
    </Layout>
  );
}

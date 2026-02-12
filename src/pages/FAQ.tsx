import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { Layout } from "@/components/layout/Layout";
import { PageHero } from "@/components/layout/PageHero";
import { HelpCircle } from "lucide-react";
import { Link } from "react-router-dom";
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
      { question: "Kan ik mijn verzekeringen combineren voor korting?", answer: "Ja, bij ZP Zaken bieden we een combinatiepolis aan waarbij je je BAV en AVB kunt bundelen. Dit levert niet alleen korting op, maar zorgt ook voor overzicht: één polis, één premie en één aanspreekpunt. Je bespaart gemiddeld 15-20% ten opzichte van losse verzekeringen." },
      { question: "Hoe snel kan ik een verzekering afsluiten?", answer: "Bij ZP Zaken kun je binnen 24 uur verzekerd zijn. Na het invullen van je gegevens ontvang je direct een offerte. Na akkoord wordt je polis dezelfde dag nog opgemaakt en ontvang je je polisblad per e-mail. In urgente gevallen kunnen we dezelfde dag nog dekking regelen." },
      { question: "Wat kost een AOV gemiddeld per maand?", answer: "De premie van een AOV hangt af van je beroep, leeftijd, gewenste uitkering en wachttijd. Gemiddeld betalen zzp'ers tussen de €150 en €400 per maand. Bij ZP Zaken helpen we je de beste prijs-kwaliteitverhouding te vinden door verschillende verzekeraars te vergelijken." },
    ]
  },
  {
    category: "Over ZP Zaken",
    questions: [
      { question: "Is ZP Zaken onafhankelijk?", answer: "Ja, ZP Zaken is volledig onafhankelijk. Wij zijn niet gebonden aan één verzekeraar en kunnen daarom objectief adviseren welke verzekering het beste bij jouw situatie past. We vergelijken producten van verschillende aanbieders om de beste oplossing voor jou te vinden." },
      { question: "Wat kost advies bij ZP Zaken?", answer: "Een eerste adviesgesprek bij ZP Zaken is altijd gratis en vrijblijvend. We bespreken je situatie, wensen en mogelijkheden zonder dat je ergens aan vastzit. Pas als je besluit een verzekering af te sluiten, ontvangen wij een vergoeding van de verzekeraar." },
      { question: "Hoe kan ik contact opnemen met ZP Zaken?", answer: "Je kunt ons bereiken via telefoon (023 - 201 0502), e-mail (info@zpzaken.nl) of via het contactformulier op onze website. We reageren binnen 24 uur op alle berichten. Je kunt ook langskomen op ons kantoor in Schiphol-Rijk voor een persoonlijk gesprek." },
      { question: "Is ZP Zaken aangesloten bij een klachteninstantie?", answer: "Ja, ZP Zaken is aangesloten bij het Kifid (Klachteninstituut Financiële Dienstverlening). Mocht je onverhoopt een klacht hebben die we niet samen kunnen oplossen, dan kun je deze voorleggen aan het Kifid. Daarnaast staan we geregistreerd bij de AFM onder vergunningsnummer 12050636." },
    ]
  },
  {
    category: "Voor zzp'ers",
    questions: [
      { question: "Welke verzekeringen zijn verplicht als zzp'er?", answer: "Er zijn geen verzekeringen wettelijk verplicht voor zzp'ers, maar opdrachtgevers eisen vaak een BAV en/of AVB. Daarnaast is een zorgverzekering verplicht voor iedereen in Nederland. Een AOV is niet verplicht maar wel sterk aan te raden om je inkomen te beschermen bij arbeidsongeschiktheid." },
      { question: "Moet ik een KvK-nummer hebben om me te verzekeren?", answer: "Voor zakelijke verzekeringen zoals een BAV of AVB heb je inderdaad een KvK-inschrijving nodig. Dit bewijst dat je als ondernemer actief bent. Voor persoonlijke verzekeringen zoals een AOV is dit niet altijd noodzakelijk, maar wel gebruikelijk." },
      { question: "Kan ik mijn premie aftrekken van de belasting?", answer: "Ja, de premie voor zakelijke verzekeringen zoals een BAV en AVB zijn volledig aftrekbaar als bedrijfskosten. De premie voor een AOV is deels aftrekbaar in box 1 als uitgave voor inkomensvoorziening. We adviseren je om met je boekhouder te overleggen over de exacte fiscale behandeling." },
      { question: "Wat gebeurt er met mijn verzekering als ik in loondienst ga?", answer: "Als je (tijdelijk) in loondienst gaat, kun je je zakelijke verzekeringen vaak pauzeren of opzeggen. Bij een AOV hangt het af van de voorwaarden of je de verzekering kunt voortzetten. We helpen je graag met het aanpassen van je verzekeringspakket aan je nieuwe situatie." },
    ]
  },
  {
    category: "Screening & Administratie",
    questions: [
      { question: "Wat is een VOG en heb ik die nodig?", answer: "Een Verklaring Omtrent het Gedrag (VOG) is een officieel document waaruit blijkt dat je geen strafbare feiten hebt gepleegd die relevant zijn voor je werk. Steeds meer opdrachtgevers vragen om een VOG, vooral in de zorg, onderwijs en financiële sector. Via ZP Zaken kun je eenvoudig een screening aanvragen." },
      { question: "Hoe lang duurt een screening?", answer: "Een standaard screening duurt gemiddeld 3-5 werkdagen. Bij spoed kunnen we dit vaak versnellen. De doorlooptijd hangt af van het type screening en de snelheid waarmee referenties reageren. Je ontvangt direct bericht zodra de screening is afgerond." },
      { question: "Biedt ZP Zaken ook hulp bij administratie?", answer: "Ja, via onze partners bieden we ondersteuning bij je financiële administratie. Dit varieert van facturatie en boekhouding tot BTW-aangiftes en jaarrekeningen. Zo kun jij je focussen op je werk terwijl wij zorgen dat je administratie op orde is." },
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
        <title>{t("faq.title")} | ZP Zaken</title>
        <meta name="description" content={t("faq.subtitle")} />
        <link rel="canonical" href="https://zpzaken.nl/faq" />
      </Helmet>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      <PageHero
        title={t("faq.title")}
        subtitle={t("faq.subtitle")}
        badge={{ icon: <HelpCircle className="h-4 w-4" />, text: t("faq.badge") }}
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
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="accent" size="lg" asChild>
              <Link to="/contact">{t("faq.ctaButton")}</Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <a href="tel:0232010502">{t("faq.ctaPhone")}</a>
            </Button>
          </div>
        </div>
      </section>
    </Layout>
  );
}

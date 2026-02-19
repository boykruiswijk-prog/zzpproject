import { LocalizedLink } from "@/components/LocalizedLink";
import { Layout } from "@/components/layout/Layout";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { ArrowRight, BookOpen, HelpCircle, FileText, ChevronDown } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const articles = [
  {
    title: "Welke verzekeringen zijn verplicht voor zzp'ers?",
    excerpt: "Een overzicht van verzekeringen die verplicht of sterk aanbevolen zijn, afhankelijk van je beroep.",
    category: "Basis",
  },
  {
    title: "AOV kiezen: waar moet je op letten?",
    excerpt: "De arbeidsongeschiktheidsverzekering is complex. Wij leggen uit waar je op moet letten.",
    category: "AOV",
  },
  {
    title: "Beroepsaansprakelijkheid vs bedrijfsaansprakelijkheid",
    excerpt: "Wat is het verschil en welke heb je nodig? Een heldere uitleg.",
    category: "Aansprakelijkheid",
  },
  {
    title: "Verzekeringen en de Belastingdienst",
    excerpt: "Welke premies zijn aftrekbaar en hoe geef je dit op in je aangifte?",
    category: "Fiscaal",
  },
];

const faqs = [
  {
    question: "Heb ik als zzp'er verzekeringen nodig?",
    answer: "Dat hangt af van je beroep en situatie. Een beroepsaansprakelijkheidsverzekering is vaak verplicht of sterk aanbevolen, vooral in de IT, zorg en consultancy. Een arbeidsongeschiktheidsverzekering is niet verplicht, maar wel verstandig omdat je als zzp'er geen WIA opbouwt.",
  },
  {
    question: "Wat kost een adviesgesprek?",
    answer: "Het eerste kennismakingsgesprek is altijd gratis en vrijblijvend. We bespreken je situatie en geven een eerste indicatie van welke verzekeringen relevant zijn. Er zijn geen verborgen kosten.",
  },
  {
    question: "Hoe snel kan ik verzekerd zijn?",
    answer: "Na goedkeuring van je aanvraag kun je meestal dezelfde dag nog verzekerd zijn. De polis ontvang je digitaal in je mailbox.",
  },
  {
    question: "Kan ik mijn huidige verzekeringen laten checken?",
    answer: "Ja, dat kan! We kijken graag naar je huidige polissen en adviseren of de dekking nog past bij je situatie. Soms kun je besparen of juist beter gedekt worden.",
  },
  {
    question: "Zijn jullie onafhankelijk?",
    answer: "Ja, wij zijn volledig onafhankelijk en niet gebonden aan één verzekeraar. We vergelijken aanbiedingen van verschillende verzekeraars en adviseren wat het beste bij jou past.",
  },
  {
    question: "Wat als mijn situatie verandert?",
    answer: "Neem dan contact met ons op. We passen je dekking aan als dat nodig is. Bijvoorbeeld bij een nieuwe opdrachtgever, uitbreiding van je werkzaamheden of verandering in je inkomen.",
  },
];

export default function Kennis() {
  return (
    <Layout>
      <SEOHead
        title="Kennis & Advies voor ZZP'ers | ZP Zaken"
        description="Handige informatie over verzekeringen, ondernemerschap en alles wat je als zzp'er moet weten. Geen jargon, wel duidelijke taal."
      />
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary via-primary to-primary/90 text-primary-foreground py-16 md:py-24">
        <div className="container-wide">
          <div className="max-w-3xl">
            <h1 className="mb-6">
              Kennis & advies
            </h1>
            <p className="text-lg md:text-xl text-primary-foreground/80 mb-8">
              Handige informatie over verzekeringen, ondernemerschap en alles wat je als 
              zzp'er moet weten. Geen jargon, wel duidelijke taal.
            </p>
          </div>
        </div>
      </section>

      {/* Articles */}
      <section className="section-padding bg-background">
        <div className="container-wide">
          <div className="flex items-center gap-3 mb-8">
            <BookOpen className="h-6 w-6 text-accent" />
            <h2 className="text-2xl font-semibold">Artikelen</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-12">
            {articles.map((article) => (
              <article
                key={article.title}
                className="bg-card rounded-2xl p-8 shadow-card border border-border/50 hover:shadow-card-hover hover:border-accent/30 transition-all duration-300 group cursor-pointer"
              >
                <span className="inline-block px-3 py-1 bg-accent/10 text-accent text-sm font-medium rounded-full mb-4">
                  {article.category}
                </span>
                <h3 className="text-xl font-semibold mb-3 group-hover:text-accent transition-colors">
                  {article.title}
                </h3>
                <p className="text-muted-foreground mb-4">{article.excerpt}</p>
                <span className="inline-flex items-center gap-2 text-sm font-medium text-primary group-hover:text-accent transition-colors">
                  Lees meer
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </span>
              </article>
            ))}
          </div>

          <div className="text-center">
            <p className="text-muted-foreground mb-4">
              Meer artikelen worden binnenkort toegevoegd.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="section-padding bg-secondary">
        <div className="container-wide">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-3 mb-8">
              <HelpCircle className="h-6 w-6 text-accent" />
              <h2 className="text-2xl font-semibold">Veelgestelde vragen</h2>
            </div>

            <Accordion type="single" collapsible className="space-y-4">
              {faqs.map((faq, index) => (
                <AccordionItem
                  key={index}
                  value={`item-${index}`}
                  className="bg-card rounded-xl px-6 border border-border/50 shadow-sm"
                >
                  <AccordionTrigger className="text-left font-medium hover:no-underline py-6">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground pb-6">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section-padding bg-background">
        <div className="container-wide">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="mb-4">Vraag niet beantwoord?</h2>
            <p className="text-lg text-muted-foreground mb-8">
              Neem contact met ons op. We helpen je graag met al je vragen over 
              verzekeringen en ondernemerschap.
            </p>
            <Button variant="accent" size="lg" asChild>
              <LocalizedLink to="/contact">
                Stel je vraag
                <ArrowRight className="h-5 w-5" />
              </LocalizedLink>
            </Button>
          </div>
        </div>
      </section>
    </Layout>
  );
}

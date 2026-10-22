import { useState } from "react";
import { AovAanmeldStap } from "@/components/shared/AovAanmeldStap";
import type { AovDoel } from "@/lib/aovDoorverwijzing";
import { SEOHead } from "@/components/SEOHead";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { LocalizedLink } from "@/components/LocalizedLink";
import { LeesMeer } from "@/components/kennisbank/LeesMeer";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowRight, ExternalLink, CheckCircle } from "lucide-react";
import { STARTER_VOORWAARDE_TEKST } from "@/lib/starterTarief";
import {
  AOV_ADVISEUR_URL, AOV_AFM_URL, AOV_REKENTOOL_TEKST, AOV_REKENTOOL_URL, AOV_NIEUW_PUBLIEK, AOV_VERMELDING_AFM, AOV_VERMELDING_NA, AOV_VERMELDING_VOOR,
} from "@/config/aovPagina";

export const AOV_SEO = {
  title: "AOV zzp: Movir Momentum afsluiten of met advies | ZP Zaken",
  description:
    "AOV voor zzp'ers: sluit de Movir Momentum zelf online af of met advies van Tjepkema. Lees wat de premie bepaalt en wat het plan voor een verplichte AOV is.",
};

export const AOV_FAQ = [
  { q: "Wat kost een AOV als zzp'er?", a: "Dat verschilt per persoon. De premie hangt af van je leeftijd en beroep, en deels van je eigen keuzes zoals het verzekerd bedrag en de eigenrisicotermijn. Je berekent je premie bij de adviseur." },
  { q: "Wat is een eigenrisicotermijn?", a: "Dat is de periode waarin je bij arbeidsongeschiktheid nog geen uitkering krijgt, bijvoorbeeld 30 dagen of 1 jaar. Kies je een langere termijn, dan is de premie lager, maar start de uitkering later." },
  { q: "Kan ik de AOV zelf afsluiten of heb ik advies nodig?", a: "Allebei kan. Zonder advies kies je zelf, doe je een kennis- en ervaringstoets en betaal je afsluitkosten; je bent dan zelf verantwoordelijk dat de AOV bij je situatie blijft passen. Met advies kijkt een adviseur mee en betaal je advieskosten." },
  { q: "Is de premie van een AOV aftrekbaar?", a: "De premie is vaak aftrekbaar in box 1. Of en hoeveel hangt af van je eigen situatie." },
  { q: "Tot welke leeftijd kan ik een AOV afsluiten?", a: "Bij de Movir Momentum kun je afsluiten tot maximaal 66 jaar, bij een looptijd tot 68 jaar. Je kiest zelf een eindleeftijd, bijvoorbeeld gekoppeld aan je pensioenleeftijd." },
  { q: "Komt er een verplichte AOV voor zzp'ers?", a: "Het kabinet wil een verplichte AOV voor zelfstandigen invoeren; dat plan staat in het coalitieakkoord van 30 januari 2026. Het is nog geen wet en de uitwerking kan veranderen." },
  { q: "Wie is mijn adviseur?", a: "Advies en afsluiten van de Movir Momentum AOV lopen via Tjepkema Assurantie & Advies B.V." },
];

const schema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Service",
      name: "Advies en afsluiten Movir Momentum AOV voor zzp'ers",
      serviceType: "Arbeidsongeschiktheidsverzekering",
      areaServed: "NL",
      url: AOV_ADVISEUR_URL,
      provider: {
        "@type": "Organization",
        name: "Tjepkema Assurantie & Advies B.V.",
        address: { "@type": "PostalAddress", streetAddress: "Middenweg 344", postalCode: "1097 TZ", addressLocality: "Amsterdam", addressCountry: "NL" },
      },
    },
    {
      "@type": "FAQPage",
      mainEntity: AOV_FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
  ],
};

export function Vermelding({ id }: { id?: string }) {
  return (
    <p id={id} className="text-sm text-muted-foreground leading-relaxed rounded-xl border border-border bg-card p-4">
      {AOV_VERMELDING_VOOR}
      <a href={AOV_AFM_URL} target="_blank" rel="noopener" className="underline underline-offset-2 text-foreground">{AOV_VERMELDING_AFM}</a>
      {AOV_VERMELDING_NA}
    </p>
  );
}

const feiten = [
  "De premie hangt af van je leeftijd en beroep, en deels van je eigen keuzes.",
  "Je kiest zelf het verzekerd bedrag.",
  "Je kiest een eigenrisicotermijn, bijvoorbeeld 30 dagen of 1 jaar. Langer betekent een lagere premie, maar de uitkering start later.",
  "Standaard krijg je een uitkering vanaf 25% arbeidsongeschiktheid. Je kunt dat ophogen naar 45%.",
  "Je kiest een eindleeftijd, bijvoorbeeld gekoppeld aan je pensioenleeftijd.",
  "Indexatie van het verzekerd bedrag is mogelijk.",
  "Je kiest een contract van 1 of 3 jaar. Bij 3 jaar krijg je 3% korting.",
  "Afsluiten kan tot maximaal 66 jaar, bij een looptijd tot 68 jaar.",
  "De premie is vaak aftrekbaar in box 1.",
];

export function Rekentool({ doel, setDoel }: { doel: AovDoel; setDoel: (d: AovDoel) => void }) {
  return (
    <section id="premie" className="section-padding bg-background scroll-mt-24">
      <div className="container-wide max-w-3xl">
        <h2 className="mb-4">Bereken je premie en sluit af bij de adviseur</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">Meld je eerst kort aan bij ZP Zaken. Daarna ga je verder naar de adviseur. Daar kies je je beroep, het verzekerd bedrag en de eigenrisicotermijn, doe je een kennis- en ervaringstoets en rond je je aanvraag af.</p>
        <p className="text-sm text-muted-foreground leading-relaxed rounded-xl border border-border bg-card p-4 mb-5">{AOV_REKENTOOL_TEKST}</p>
        <div role="group" aria-label="Kies je route" className="flex flex-wrap gap-2 mb-4">
          <Button type="button" size="sm" variant={doel === "rekentool" ? "default" : "outline"} aria-pressed={doel === "rekentool"} onClick={() => setDoel("rekentool")}>Rekentool</Button>
          <Button type="button" size="sm" variant={doel === "advies" ? "default" : "outline"} aria-pressed={doel === "advies"} onClick={() => setDoel("advies")}>Persoonlijk advies</Button>
        </div>
        <AovAanmeldStap key={doel} doel={doel} />
      </div>
    </section>
  );
}

export default function AOVMovir() {
  const [doel, setDoel] = useState<AovDoel>("rekentool");
  return (
    <Layout zonderGegevensPopups>
      <SEOHead title={AOV_SEO.title} description={AOV_SEO.description} canonical="https://zpzaken.nl/aov" exactTitle noindex={!AOV_NIEUW_PUBLIEK}>
        <script type="application/ld+json">{JSON.stringify(schema)}</script>
      </SEOHead>

      <section className="bg-secondary pt-28 pb-14 md:pt-36 md:pb-20">
        <div className="container-wide max-w-4xl">
          <p className="text-sm font-medium text-accent mb-3">Je komt van NN? Hier sluit je de Movir Momentum AOV af.</p>
          <h1 className="text-3xl md:text-5xl font-bold leading-tight mb-5">AOV voor zzp'ers: Movir Momentum online afsluiten of met advies</h1>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl">
            Word je ziek of arbeidsongeschikt, dan valt je inkomen als zelfstandige weg. Een AOV keert dan maandelijks uit. Je sluit de Movir Momentum zelf online af of met hulp van een adviseur.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <Button variant="accent" size="lg" asChild><a href="#premie" onClick={() => setDoel("rekentool")}>Bereken je premie <ArrowRight className="h-5 w-5" /></a></Button>
            <Button variant="outline" size="lg" asChild><a href="#premie" onClick={() => setDoel("advies")}>Liever persoonlijk advies</a></Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Advies en afsluiten via Tjepkema Assurantie & Advies B.V. (AFM 12050654). ZP Zaken geeft geen advies.{" "}
            <a href="#adviseur" className="underline underline-offset-2">Volledige vermelding</a>
          </p>
        </div>
      </section>

      <Rekentool doel={doel} setDoel={setDoel} />

      <section className="section-padding bg-background border-t border-border">
        <div className="container-wide max-w-5xl">
          <h2 className="mb-3">Zelf afsluiten of met advies?</h2>
          <p className="text-muted-foreground mb-8 max-w-2xl">Je kiest zelf hoe je de AOV afsluit. Beide routes lopen via de adviseur.</p>
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div className="rounded-2xl border border-border bg-card p-6">
              <h3 className="text-xl font-semibold mb-3">Zelf online afsluiten (zonder advies)</h3>
              <p className="text-muted-foreground leading-relaxed mb-4">Je kiest je beroep, het verzekerd bedrag en de eigenrisicotermijn, doet een kennis- en ervaringstoets en rondt af. Je betaalt afsluitkosten en bent zelf verantwoordelijk dat de AOV bij je situatie blijft passen.</p>
              <p className="text-sm">Afsluitkosten: € XXX</p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-6">
              <h3 className="text-xl font-semibold mb-3">Met advies</h3>
              <p className="text-muted-foreground leading-relaxed mb-4">Een adviseur kijkt met je mee naar je situatie en je keuzes. Daar horen advieskosten bij.</p>
              <p className="text-sm">Advieskosten: € XXX</p>
            </div>
          </div>
          <p className="mb-4 font-medium">Je adviseur: Michiel Tjepkema</p>
          <Vermelding />
        </div>
      </section>

      <section className="section-padding bg-secondary">
        <div className="container-wide max-w-4xl">
          <h2 className="mb-3">Hoe werkt de Movir Momentum AOV?</h2>
          <p className="text-muted-foreground mb-6">Je stelt de verzekering zelf samen. De verzekeraar beoordeelt je aanvraag. Stand oktober 2026, bron movir.nl.</p>
          <ul className="space-y-3">
            {feiten.map((f) => (
              <li key={f} className="flex items-start gap-3"><CheckCircle className="h-5 w-5 text-accent mt-0.5 flex-shrink-0" aria-hidden="true" /><span>{f}</span></li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section-padding bg-background">
        <div className="container-wide max-w-4xl">
          <h2 className="mb-3">Komt er een verplichte AOV voor zzp'ers?</h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            Het kabinet wil een verplichte AOV voor zelfstandigen invoeren. Dat plan staat in het coalitieakkoord van 30 januari 2026. Het is nog geen wet: hoe en wanneer het precies gaat gelden, kan nog veranderen.
          </p>
          <LocalizedLink to="/kennisbank/verplichte-aov-voor-zzp" className="inline-flex items-center gap-2 text-accent font-medium">
            Lees meer over de verplichte AOV <ArrowRight className="h-4 w-4" />
          </LocalizedLink>
        </div>
      </section>

      <section className="section-padding bg-secondary">
        <div className="container-wide max-w-3xl">
          <h2 className="mb-6">Veelgestelde vragen over de AOV</h2>
          <Accordion type="single" collapsible className="space-y-3">
            {AOV_FAQ.map((f, i) => (
              <AccordionItem key={f.q} value={`faq-${i}`} className="bg-card border border-border rounded-xl px-6">
                <AccordionTrigger className="text-left font-semibold hover:no-underline">{f.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      <section className="section-padding bg-background">
        <div className="container-wide max-w-4xl rounded-2xl border border-border bg-card p-6 md:p-10">
          <h2 className="mb-3">Bescherm ook je bedrijf</h2>
          <p className="text-muted-foreground leading-relaxed mb-3">BAV + AVB in één polis, € 55 per maand of € 600 per jaar, inclusief kosten en assurantiebelasting, binnen 24 uur geregeld.</p>
          <p className="text-sm text-muted-foreground mb-6">Starter? {STARTER_VOORWAARDE_TEKST}</p>
          <Button variant="outline" size="lg" asChild>
            <LocalizedLink to="/verzekeringen">Bekijk BAV + AVB <ArrowRight className="h-5 w-5" /></LocalizedLink>
          </Button>
        </div>
      </section>

      <LeesMeer voorkeur={["aov-arbeidsongeschiktheidsverzekering", "verplichte-aov-voor-zzp", "wat-kosten-verzekeringen-voor-zzp-ers", "welke-verzekeringen-zzp", "voor-en-nadelen-broodfonds-of-schenkkring"]} />

      <section className="py-10 bg-background border-t border-border">
        <div className="container-wide max-w-4xl">
          <Vermelding id="adviseur" />
        </div>
      </section>

      <div className="md:hidden fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom))] z-40 border-t border-border bg-background/95 p-3 backdrop-blur">
        <Button variant="accent" size="lg" asChild className="w-full"><a href="#premie" onClick={() => setDoel("rekentool")}>Bereken je premie bij de adviseur</a></Button>
      </div>
      <div className="md:hidden h-20" aria-hidden="true" />
    </Layout>
  );
}

import { useState } from "react";
import { AovAanmeldStap } from "@/components/shared/AovAanmeldStap";
import type { AovDoel } from "@/lib/aovDoorverwijzing";
import { SEOHead } from "@/components/SEOHead";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { LocalizedLink } from "@/components/LocalizedLink";
import { LeesMeer } from "@/components/kennisbank/LeesMeer";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowRight, CheckCircle, ClipboardList, ExternalLink, ShieldCheck, Star, Users, CalendarCheck } from "lucide-react";
import { STARTER_VOORWAARDE_TEKST } from "@/lib/starterTarief";
import { SITE_CONFIG } from "@/config/site";
import movirLogo from "@/assets/partner-movir.webp";
import {
  AOV_ADVISEUR_URL, AOV_AFM_URL, AOV_GEEN_VERGOEDING, AOV_REKENTOOL_TEKST, AOV_NIEUW_PUBLIEK, AOV_VERMELDING_AFM, AOV_VERMELDING_NA, AOV_VERMELDING_VOOR,
} from "@/config/aovPagina";

export const AOV_SEO = {
  title: "AOV zzp: Movir AOV via onze externe adviseur | ZP Zaken",
  description:
    "AOV zzp: lees hoe de Movir AOV (Momentum) werkt en bereken je premie via onze externe adviseur. ZP Zaken ontvangt geen vergoeding.",
};

export const AOV_H1 = "AOV voor zzp'ers: de Movir AOV in gewone taal";

export const AOV_FAQ = [
  { q: "Wat is een AOV voor zzp'ers?", a: "Een arbeidsongeschiktheidsverzekering (AOV) keert maandelijks uit als je door ziekte of een ongeval niet of minder kunt werken. Als zzp'er heb je geen werkgever die je loon doorbetaalt. Of een AOV bij jou past, hangt af van je situatie; daarover praat je met onze externe adviseur." },
  { q: "Wat is de Movir Momentum AOV?", a: "Een AOV van Movir voor zelfstandigen. Je stelt hem zelf samen: je kiest onder meer het verzekerd bedrag, de eigenrisicotermijn en de eindleeftijd. Movir beoordeelt je aanvraag." },
  { q: "Hoe sluit ik de Movir AOV af via zpzaken.nl?", a: "Je laat bij ZP Zaken je naam, e-mailadres en eventueel telefoonnummer achter, met toestemming om die door te geven. Daarna verschijnt op deze pagina de rekentool en aanvraagstraat van onze externe adviseur. Berekenen en aanvragen gebeurt in die tool; advies en afsluiten lopen volledig via de externe adviseur. Wat je in de tool invult, ontvangt ZP Zaken niet." },
  { q: "Wat kost een AOV als zzp'er?", a: "Dat verschilt per persoon. De premie hangt af van je leeftijd en beroep, en van je eigen keuzes zoals het verzekerd bedrag en de eigenrisicotermijn. Je ziet je premie in de rekentool van onze externe adviseur." },
  { q: "Is de premie van een AOV aftrekbaar?", a: "De premie is vaak aftrekbaar in box 1. Of en hoeveel hangt af van je eigen situatie." },
  { q: "Geeft ZP Zaken advies over de AOV of krijgt ZP Zaken een vergoeding?", a: `Nee. ZP Zaken geeft geen advies en bemiddelt niet in de AOV. ${AOV_GEEN_VERGOEDING}` },
];

const schema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      name: AOV_H1,
      url: "https://zpzaken.nl/aov",
      about: [{ "@type": "Thing", name: "AOV zzp" }, { "@type": "Thing", name: "Movir AOV" }],
    },
    {
      "@type": "FAQPage",
      mainEntity: AOV_FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
  ],
};

export function Vermelding({ id }: { id?: string }) {
  return (
    <div id={id} className="text-sm text-muted-foreground leading-relaxed rounded-xl border border-border bg-card p-4 space-y-2">
      <p>
        {AOV_VERMELDING_VOOR}
        <a href={AOV_AFM_URL} target="_blank" rel="noopener" className="underline underline-offset-2 text-foreground">{AOV_VERMELDING_AFM}</a>
        {AOV_VERMELDING_NA}
      </p>
      <p>{AOV_GEEN_VERGOEDING}</p>
    </div>
  );
}

const vertrouwen = [
  { icon: CalendarCheck, label: "13+ jaar voor zzp'ers" },
  { icon: Users, label: `${SITE_CONFIG.klantenAantal} zzp'ers` },
  { icon: Star, label: "5,0/5 Google Reviews" },
  { icon: ShieldCheck, label: "AFM 12050636" },
];

const stappen = [
  { icon: ClipboardList, titel: "Je gegevens bij ZP Zaken", tekst: "Je laat je naam, e-mailadres en eventueel telefoonnummer achter, met toestemming om ze door te geven. Ben je ingelogd in Mijn ZP, dan is dit één klik." },
  { icon: ExternalLink, titel: "De rekentool op deze pagina", tekst: "Na je aanmelding verschijnt hier de rekentool van onze externe adviseur. Daar bereken je je premie en doe je je aanvraag. Je kiest je beroep, het verzekerd bedrag en de eigenrisicotermijn." },
  { icon: ShieldCheck, titel: "Advies en afsluiten bij de externe adviseur", tekst: "Het team van de externe adviseur helpt je verder met advies, de berekening en het afsluiten. Wat je daar invult, ontvangt ZP Zaken niet." },
];

const feiten = [
  "Je kiest zelf het verzekerd bedrag.",
  "Je kiest een eigenrisicotermijn, bijvoorbeeld 30 dagen of 1 jaar. Langer betekent een lagere premie, maar de uitkering start later.",
  "Standaard begint een uitkering vanaf 25% arbeidsongeschiktheid. Je kunt dat ophogen naar 45%.",
  "Je kiest een eindleeftijd, bijvoorbeeld gekoppeld aan je pensioenleeftijd.",
  "Indexatie van het verzekerd bedrag is mogelijk.",
  "Je kiest een contract van 1 of 3 jaar. Bij 3 jaar krijg je 3% korting.",
  "Afsluiten kan tot maximaal 66 jaar, bij een looptijd tot 68 jaar.",
];

function Aanmelden({ doel, setDoel }: { doel: AovDoel; setDoel: (d: AovDoel) => void }) {
  return (
    <section id="premie" className="section-padding bg-secondary scroll-mt-24">
      <div className="container-wide">
        <p className="text-sm font-semibold uppercase tracking-wide text-accent mb-2">Stap 1</p>
        <h2 className="mb-4">Meld je aan en ga door naar de rekentool</h2>
        <p className="text-sm text-muted-foreground leading-relaxed rounded-xl border border-border bg-card p-4 mb-5">{AOV_REKENTOOL_TEKST}</p>
        <div role="group" aria-label="Kies je route" className="flex flex-wrap gap-2 mb-4">
          <Button type="button" size="sm" variant={doel === "rekentool" ? "default" : "outline"} aria-pressed={doel === "rekentool"} onClick={() => setDoel("rekentool")}>Rekentool</Button>
          <Button type="button" size="sm" variant={doel === "advies" ? "default" : "outline"} aria-pressed={doel === "advies"} onClick={() => setDoel("advies")}>Liever persoonlijk contact met de externe adviseur</Button>
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

      <section className="relative overflow-hidden bg-secondary pt-28 pb-14 md:pt-36 md:pb-20">
        <div className="container-wide grid gap-10 md:grid-cols-[1.4fr_1fr] md:items-center">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-sm font-medium mb-5">
              <span className="h-2 w-2 rounded-full bg-accent" aria-hidden="true" /> AOV zzp
            </p>
            <h1 className="text-3xl md:text-5xl font-bold leading-tight mb-5">{AOV_H1}</h1>
            <p className="text-lg text-muted-foreground mb-8 max-w-xl">
              Kun je door ziekte of een ongeval niet werken, dan valt je inkomen als zelfstandige weg. Lees hier hoe de Movir Momentum AOV werkt en bereken je premie in een paar minuten via onze externe adviseur.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mb-5">
              <Button variant="accent" size="lg" asChild><a href="#premie" onClick={() => setDoel("rekentool")}>Bereken je premie <ArrowRight className="h-5 w-5" /></a></Button>
              <Button variant="outline" size="lg" asChild><a href="#zo-werkt-het">Zo werkt het</a></Button>
            </div>
            <p className="text-sm text-muted-foreground">
              ZP Zaken geeft geen advies over de AOV. <a href="#vermelding" className="underline underline-offset-2">Volledige vermelding</a>
            </p>
          </div>
          <div className="rounded-3xl border border-border bg-card p-8 shadow-sm">
            <img src={movirLogo} alt="Movir" width={150} height={100} className="h-24 w-auto -ml-4 mb-2" />
            <p className="font-semibold mb-3">Movir Momentum AOV</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {["Je stelt hem zelf samen", "Premie berekenen bij onze externe adviseur", "Advies en afsluiten bij de externe adviseur"].map((t) => (
                <li key={t} className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" aria-hidden="true" />{t}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section aria-label="Over ZP Zaken" className="border-y border-border bg-background py-5">
        <ul className="container-wide grid grid-cols-2 gap-4 md:flex md:justify-center md:gap-10 text-sm">
          {vertrouwen.map((v) => (
            <li key={v.label} className="inline-flex items-center gap-2 font-medium"><v.icon className="h-4 w-4 text-accent" aria-hidden="true" />{v.label}</li>
          ))}
        </ul>
      </section>

      <section id="zo-werkt-het" className="section-padding bg-background scroll-mt-24">
        <div className="container-wide max-w-5xl">
          <h2 className="mb-3">Zo werkt het</h2>
          <p className="text-muted-foreground mb-8 max-w-2xl">Drie stappen. Alleen de eerste stap is bij ZP Zaken.</p>
          <ol className="grid gap-6 md:grid-cols-3">
            {stappen.map((s, i) => (
              <li key={s.titel} className="rounded-2xl border border-border bg-card p-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-accent-foreground font-bold">{i + 1}</span>
                  <s.icon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{s.titel}</h3>
                <p className="text-muted-foreground leading-relaxed text-sm">{s.tekst}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <Aanmelden doel={doel} setDoel={setDoel} />

      <section className="section-padding bg-background">
        <div className="container-wide max-w-5xl grid gap-10 md:grid-cols-[1fr_2fr]">
          <div>
            <img src={movirLogo} alt="Movir" width={150} height={100} loading="lazy" className="h-14 w-auto mb-4" />
            <h2 className="mb-3">Hoe werkt de Movir Momentum AOV?</h2>
            <p className="text-muted-foreground">Je stelt de verzekering zelf samen. Movir beoordeelt je aanvraag en bepaalt de voorwaarden. Stand oktober 2026, bron movir.nl.</p>
          </div>
          <ul className="space-y-3">
            <li className="flex items-start gap-3"><CheckCircle className="h-5 w-5 text-accent mt-0.5 flex-shrink-0" aria-hidden="true" /><span>De premie hangt af van je leeftijd en beroep, en van je eigen keuzes.</span></li>
            {feiten.map((f) => (
              <li key={f} className="flex items-start gap-3"><CheckCircle className="h-5 w-5 text-accent mt-0.5 flex-shrink-0" aria-hidden="true" /><span>{f}</span></li>
            ))}
            <li className="text-sm text-muted-foreground pt-2">Wat precies verzekerd is, staat in de voorwaarden van Movir. Die krijg je bij de externe adviseur.</li>
          </ul>
        </div>
      </section>

      <section className="section-padding bg-secondary">
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

      <section className="section-padding bg-background">
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

      <section className="section-padding bg-secondary">
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
          <h2 className="text-lg font-semibold mb-3">Verplichte vermeldingen</h2>
          <Vermelding id="vermelding" />
          <p className="mt-3 text-sm text-muted-foreground">Website van onze externe adviseur: <a href={AOV_ADVISEUR_URL} target="_blank" rel="noopener" className="underline underline-offset-2">wijzijnaov.nl</a></p>
        </div>
      </section>

      <div className="md:hidden fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom))] z-40 border-t border-border bg-background/95 p-3 backdrop-blur">
        <Button variant="accent" size="lg" asChild className="w-full"><a href="#premie" onClick={() => setDoel("rekentool")}>Bereken je premie</a></Button>
      </div>
      <div className="md:hidden h-20" aria-hidden="true" />
    </Layout>
  );
}

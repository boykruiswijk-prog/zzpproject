import { CYBER_DEKKING, CYBER_HULP, CYBER_POLISVOORWAARDEN, CYBER_LOOPTIJD } from "../../supabase/functions/_shared/cyber";
import { seoRoute } from "@/config/seoRoutes";
import { Layout } from "@/components/layout/Layout";
import { SEOHead } from "@/components/SEOHead";
import { LocalizedLink } from "@/components/LocalizedLink";
import { Button } from "@/components/ui/button";
import { SITE_CONFIG } from "@/config/site";
import { faqSchema, organizationRef } from "@/lib/schema";
import { getPakket } from "@/data/bavPakketten";
import {
  bavVergelijking, bavVergelijkingFaq, YEZZER_URL,
  VERGELIJKING_GECONTROLEERD_OP, VERGELIJKING_GECONTROLEERD_LABEL, type BavAanbieder,
} from "@/data/bavVergelijking";
import { ArrowRight, CheckCircle, ExternalLink, Phone } from "lucide-react";

const PAD = "/bav-zzp-vergelijken";
const SEO = seoRoute(PAD);
const eur = (n: number) => `€ ${n.toLocaleString("nl-NL")}`;

const KOLOMMEN: { key: keyof BavAanbieder; label: string }[] = [
  { key: "watJeKrijgt", label: "Wat je krijgt" },
  { key: "vanafPrijs", label: "Vanaf-prijs" },
  { key: "verzekerdBedrag", label: "Verzekerd bedrag" },
  { key: "eigenRisico", label: "Eigen risico" },
  { key: "opzeggen", label: "Opzeggen" },
];

function BronLink({ a }: { a: BavAanbieder }) {
  if (a.eigen) return <LocalizedLink to={a.bronUrl} className="text-accent underline underline-offset-2">zpzaken.nl/verzekeringen</LocalizedLink>;
  const host = new URL(a.bronUrl).hostname.replace(/^www\./, "");
  return (
    <a href={a.bronUrl} target="_blank" rel="nofollow noopener" className="inline-flex items-center gap-1 text-accent underline underline-offset-2 break-all">
      {host}<ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
    </a>
  );
}

const Sectie = ({ id, titel, children, alt = false }: { id: string; titel: string; children: React.ReactNode; alt?: boolean }) => (
  <section id={id} className={`section-padding scroll-mt-24 ${alt ? "bg-secondary" : "bg-background"}`}>
    <div className="container-wide">
      <div className="mx-auto max-w-3xl">
        <h2 className="mb-6 text-2xl font-bold md:text-3xl">{titel}</h2>
        <div className="space-y-4 leading-relaxed text-muted-foreground">{children}</div>
      </div>
    </div>
  </section>
);

function Ctas({ center = false }: { center?: boolean }) {
  return (
    <div className={`flex flex-col gap-3 sm:flex-row ${center ? "sm:justify-center" : ""}`}>
      <Button variant="accent" size="lg" asChild>
        <LocalizedLink to="/verzekeringen#combinatiepolis">Bekijk de verzekering en sluit direct af<ArrowRight className="h-4 w-4" /></LocalizedLink>
      </Button>
      <Button variant="outline" size="lg" asChild>
        <LocalizedLink to="/offerte">Vraag een offerte aan</LocalizedLink>
      </Button>
    </div>
  );
}

export default function BavZzpVergelijken() {
  const maand = getPakket("maandelijks");
  const jaar = getPakket("jaarlijks");
  const bav = eur(maand.dekkingen.bav.perGebeurtenis);
  const avb = eur(maand.dekkingen.avb.perGebeurtenis);
  const faq = bavVergelijkingFaq();
  const url = `${SITE_CONFIG.url}${PAD}`;
  const article = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "BAV zzp vergelijken 2026: prijzen, dekking en eigen risico naast elkaar",
    description: SEO.description,
    datePublished: VERGELIJKING_GECONTROLEERD_OP,
    dateModified: VERGELIJKING_GECONTROLEERD_OP,
    author: organizationRef(),
    publisher: organizationRef(),
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    inLanguage: "nl-NL",
  };

  return (
    <Layout>
      <SEOHead title={SEO.title} description={SEO.description} ogType="article">
        <script type="application/ld+json">{JSON.stringify(article)}</script>
        <script type="application/ld+json">{JSON.stringify(faqSchema(faq))}</script>
      </SEOHead>

      <section className="bg-secondary pb-12 pt-28 md:pb-16 md:pt-36">
        <div className="container-wide">
          <div className="mx-auto max-w-3xl">
            <p className="mb-3 text-sm font-medium text-accent">Gecontroleerd op {VERGELIJKING_GECONTROLEERD_LABEL}</p>
            <h1 className="mb-6 text-3xl font-bold md:text-5xl">BAV zzp vergelijken 2026</h1>
            <p className="mb-8 text-lg leading-relaxed text-muted-foreground">
              Vergelijk een beroepsaansprakelijkheidsverzekering (BAV) nooit alleen op de laagste prijs. Kijk ook naar het verzekerd bedrag, het eigen risico, of de bedrijfsaansprakelijkheidsverzekering (AVB) erbij zit en hoe snel je kunt opzeggen. ZP Zaken biedt BAV en AVB in één polis via Hiscox, vanaf {eur(maand.prijs)} per maand, met {bav} BAV-dekking, {avb} AVB-dekking per aanspraak en geen eigen risico.
            </p>
            <Ctas />
          </div>
        </div>
      </section>

      <Sectie id="cyber" titel="Cyber bij je BAV + AVB"><p>Met cyber betaal je €82,50 per maand of €850 per jaar, inclusief kosten en assurantiebelasting. Cyber is niet los af te sluiten.</p><p>{CYBER_DEKKING} {CYBER_HULP}</p><p>{CYBER_LOOPTIJD}</p><p>{CYBER_POLISVOORWAARDEN}</p></Sectie>
      <Sectie id="waar-op-letten" titel="Waar let je op bij het vergelijken">
        <p><strong className="text-foreground">Verzekerd bedrag</strong> Dit is het maximum dat de verzekeraar uitkeert. Veel goedkope polissen starten bij € 250.000 per aanspraak. Kijk ook of er een maximum per jaar geldt. Vraagt je opdrachtgever een bepaald bedrag? Check dan of de polis dat haalt.</p>
        <p><strong className="text-foreground">Eigen risico</strong> Dit deel van de schade betaal je zelf. Bij sommige aanbieders kies je zelf een bedrag tussen € 250 en € 2.500. Een hoog eigen risico maakt de premie lager, maar je betaalt meer bij een claim.</p>
        <p><strong className="text-foreground">AVB erbij of apart</strong> Een BAV dekt financiële schade door een fout in je werk, zoals verkeerd advies. Een AVB dekt schade aan personen en spullen. De meeste aanbieders verkopen de AVB als losse verzekering. Tel dan beide premies op als je vergelijkt.</p>
        <p><strong className="text-foreground">Opzegtermijn en contractduur</strong> Kun je dagelijks opzeggen, of zit je een jaar vast? Voor zzp'ers met wisselende opdrachten is dagelijks opzegbaar vaak prettig.</p>
        <p><strong className="text-foreground">Dekking voor je beroep</strong> Niet elke polis is er voor elk beroep. Sommige aanbieders sluiten beroepen uit, zoals advocaten, notarissen of accountants. Check of jouw werk onder de dekking valt.</p>
        <p><strong className="text-foreground">Inloop en uitloop:</strong> bij ZP Zaken loopt de dekking vanaf de ingangsdatum die je zelf kiest bij je aanmelding. Fouten van voor die datum vallen niet onder de verzekering. Uitloopdekking is er niet: stop je de verzekering, dan stopt ook de dekking. Kijk bij het vergelijken altijd hoe andere aanbieders dit regelen.</p>
        <p><strong className="text-foreground">Premie per maand of per jaar</strong> Sommige aanbieders noemen een prijs per maand, andere per jaar. Reken alles om naar hetzelfde. Kijk ook of assurantiebelasting en kosten in de prijs zitten.</p>
      </Sectie>

      <section id="vergelijking" className="section-padding scroll-mt-24 bg-secondary">
        <div className="container-wide">
          <h2 className="mx-auto mb-6 max-w-3xl text-2xl font-bold md:text-3xl">Vergelijking BAV voor zzp'ers 2026</h2>

          {/* Desktop: tabel */}
          <div className="hidden overflow-hidden rounded-xl border border-border bg-card lg:block">
            <table className="w-full table-fixed text-left text-sm">
              <thead className="bg-muted/60">
                <tr>
                  <th scope="col" className="w-[14%] p-3 font-semibold">Aanbieder</th>
                  {KOLOMMEN.map((k) => <th key={k.key} scope="col" className="p-3 font-semibold">{k.label}</th>)}
                  <th scope="col" className="w-[12%] p-3 font-semibold">Bron</th>
                </tr>
              </thead>
              <tbody>
                {bavVergelijking.map((a) => (
                  <tr key={a.aanbieder} className={`border-t border-border align-top ${a.eigen ? "bg-accent/5" : ""}`}>
                    <th scope="row" className="p-3 font-semibold text-foreground">{a.aanbieder}</th>
                    {KOLOMMEN.map((k) => <td key={k.key} className="p-3 text-muted-foreground">{String(a[k.key])}</td>)}
                    <td className="p-3"><BronLink a={a} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobiel/tablet: kaart per aanbieder */}
          <ul className="grid gap-4 md:grid-cols-2 lg:hidden">
            {bavVergelijking.map((a) => (
              <li key={a.aanbieder} className={`min-w-0 rounded-xl border bg-card p-4 ${a.eigen ? "border-accent" : "border-border"}`}>
                <h3 className="mb-3 text-lg font-semibold">{a.aanbieder}</h3>
                <dl className="space-y-2 text-sm">
                  {KOLOMMEN.map((k) => (
                    <div key={k.key}>
                      <dt className="font-medium text-foreground">{k.label}</dt>
                      <dd className="break-words text-muted-foreground">{String(a[k.key])}</dd>
                    </div>
                  ))}
                  <div><dt className="font-medium text-foreground">Bron</dt><dd><BronLink a={a} /></dd></div>
                </dl>
              </li>
            ))}
          </ul>

          <div className="mx-auto mt-6 max-w-3xl space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>Prijzen gecontroleerd op {VERGELIJKING_GECONTROLEERD_LABEL}; je premie hangt af van beroep en omzet. "Niet vermeld" betekent dat we het gegeven niet op de productpagina van de aanbieder konden vinden. Het kan wel in de polisvoorwaarden staan.</p>
            <p><strong className="text-foreground">Liever veel aanbieders tegelijk zien?</strong> Vergelijkingssite <a href={YEZZER_URL} target="_blank" rel="nofollow noopener" className="text-accent underline underline-offset-2">Yezzer</a> vergelijkt onder meer Hiscox, Markel, AIG, HDI en Liberty en noemt premies vanaf € 20 per maand.</p>
          </div>
        </div>
      </section>

      <Sectie id="goedkoopste" titel="Wat is de goedkoopste BAV voor zzp'ers?">
        <p>Op papier zijn Knab (vanaf € 27,22 per maand) en De Goudse (voorbeeld € 29,17 per maand, zonder assurantiebelasting) het goedkoopst voor alleen een BAV. Ook als je bij Knab of Insify een losse AVB erbij neemt, kom je op papier lager uit dan {eur(maand.prijs)} per maand.</p>
        <p>Meer weten over alle premies? Lees <LocalizedLink to="/kennisbank/wat-kosten-verzekeringen-voor-zzp-ers" className="text-accent underline underline-offset-2">wat verzekeringen voor zzp'ers in 2026 kosten</LocalizedLink>.</p>
        <p>Het verschil zit in wat je ervoor krijgt:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li><strong className="text-foreground">Lager verzekerd bedrag.</strong> Knab dekt € 250.000 of € 500.000 per claim. De Goudse gaat tot € 1.000.000 per aanspraak. ZP Zaken dekt {bav} BAV per aanspraak.</li>
          <li><strong className="text-foreground">Eigen risico.</strong> Bij De Goudse betaal je € 750 per aanspraak zelf, bij Insify € 250 tot € 2.500. Bij ZP Zaken is er geen eigen risico op BAV + AVB. Voor cyber geldt € 500, of € 1.000 bij cyberfraude.</li>
          <li><strong className="text-foreground">AVB niet inbegrepen.</strong> Bij de meeste aanbieders betaal je de AVB apart. Bij ZP Zaken zitten BAV en AVB in één polis.</li>
        </ul>
        <p>Heb je weinig risico en vraagt je opdrachtgever geen hoge dekking? Dan kan een goedkopere BAV met lagere dekking voldoende zijn. Wil je hoge dekking, geen eigen risico en BAV en AVB in één keer geregeld? Dan past ZP Zaken beter.</p>
      </Sectie>

      <Sectie id="waarom-zp-zaken" titel="Waarom zzp'ers voor ZP Zaken kiezen" alt>
        <ul className="space-y-3">
          {[
            [`BAV en AVB in één polis.`, `ZP Zaken bedacht de BAV + AVB in één polis voor zzp'ers en is daarin marktleider. De verzekeraar is Hiscox.`],
            [`Hoge dekking.`, `BAV ${bav} en AVB ${avb} per aanspraak.`],
            [`BAV + AVB: geen eigen risico.`, ``],
            [`Vaste prijs.`, `Vanaf ${eur(maand.prijs)} per maand, of ${eur(jaar.prijs)} per jaar.`],
            [`BAV + AVB dagelijks opzegbaar.`, `Cyber heeft een vaste looptijd van 12 maanden.`],
            [`Snel geregeld.`, `Je sluit online af, het is binnen 24 uur geregeld en je krijgt het certificaat in je mailbox.`],
          ].map(([kop, tekst]) => (
            <li key={kop} className="flex gap-3">
              <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
              <span><strong className="text-foreground">{kop}</strong>{tekst ? ` ${tekst}` : ""}</span>
            </li>
          ))}
        </ul>
        <p>
          Liever even bellen? Bel ons op{" "}
          <a href={`tel:${SITE_CONFIG.phoneTel}`} className="inline-flex items-center gap-1 font-medium text-accent underline underline-offset-2">
            <Phone className="h-4 w-4" aria-hidden="true" />{SITE_CONFIG.phoneDisplay}
          </a>.
        </p>
        <div className="pt-2"><Ctas /></div>
      </Sectie>

      <Sectie id="veelgestelde-vragen" titel="Veelgestelde vragen">
        <div className="space-y-6">
          {faq.map((f) => (
            <div key={f.question}>
              <h3 className="mb-2 text-lg font-semibold text-foreground">{f.question}</h3>
              <p>{f.answer}</p>
            </div>
          ))}
        </div>
      </Sectie>

      <Sectie id="disclaimer" titel="Disclaimer" alt>
        <p className="text-sm">Deze pagina geeft algemene informatie en is geen persoonlijk advies. De gegevens van andere aanbieders komen van hun eigen websites en zijn gecontroleerd op {VERGELIJKING_GECONTROLEERD_LABEL}. Prijzen en voorwaarden kunnen sindsdien veranderd zijn. Voor elke verzekering zijn de polisvoorwaarden van de verzekeraar leidend. ZP Zaken heeft een vergunning van de AFM (nummer {SITE_CONFIG.registrations.afm}).</p>
      </Sectie>
    </Layout>
  );
}

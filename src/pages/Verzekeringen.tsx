import { WaarLetJeOpBav } from "@/components/diensten/WaarLetJeOpBav";
import { openTerugbelKlik } from "@/components/shared/TerugbelDialog";
import { seoRoute } from "@/config/seoRoutes";
import { SEOHead } from "@/components/SEOHead";
import { bavPakketten } from "@/data/bavPakketten";
import { productSchema, faqSchema } from "@/lib/schema";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { BeroepspaginaTekst } from "@/components/diensten/BeroepspaginaTekst";
import { LocalizedLink } from "@/components/LocalizedLink";
import { BAVApplicationModule } from "@/components/home/BAVApplicationModule";
import { useTranslation } from "react-i18next";
import { Layout } from "@/components/layout/Layout";
import { PageHero } from "@/components/layout/PageHero";
import { Button } from "@/components/ui/button";
import { scrollNaarAanvraag } from "@/lib/scrollNaarAanvraag";
import { Shield, Heart, Scale, ArrowRight, CheckCircle, Globe, Sparkles, Euro, Star } from "lucide-react";

import { TrustBar } from "@/components/shared/TrustBar";
import { QualificationCheck } from "@/components/shared/QualificationCheck";
import { StepsProcess } from "@/components/shared/StepsProcess";
import { WhyAffordable } from "@/components/shared/WhyAffordable";
import { MiniSocialProof } from "@/components/shared/MiniSocialProof";
import { ThreeOptionCTA } from "@/components/shared/ThreeOptionCTA";
import { LeesMeer } from "@/components/kennisbank/LeesMeer";
import { HiscoxTrustStrip } from "@/components/home/HiscoxTrustStrip";
import teamBoyCalling from "@/assets/team-boy-calling.webp";
import officeFlowers from "@/assets/office-flowers.webp";

const SEO = seoRoute("/verzekeringen");

export const verzekeringenFaqs = [
  { question: "Is een BAV verplicht voor zzp'ers?", answer: "Voor de meeste zzp'ers niet. Voor advocaten, notarissen, accountants en financieel adviseurs is een BAV wel verplicht, door de wet of door de beroepsorganisatie. Opdrachtgevers en bemiddelaars eisen een BAV vaak in hun contract.", link: "/kennisbank/is-bav-verplicht-zzp", linkLabel: "Lees meer" },
  { question: "Wat kost een BAV en AVB per maand?", answer: "Bij ZP Zaken € 55 per maand of € 600 per jaar, inclusief kosten en assurantiebelasting, voor de BAV en AVB samen in één polis, zonder eigen risico. Met een KVK-inschrijving jonger dan 12 maanden betaal je met het starterspakket de eerste 12 maanden € 45 per maand of € 495 per jaar, daarna € 55 per maand of € 600 per jaar, inclusief kosten en assurantiebelasting, onder voorbehoud van controle van je KVK-inschrijvingsdatum.", link: "/starters", linkLabel: "starterspakket" },
  { question: "Wat is het verschil tussen een BAV en een AVB?", answer: "Een BAV is bedoeld voor claims over financiële schade bij je opdrachtgever door een fout in je werk. Een AVB is bedoeld voor schade aan personen of spullen van anderen. Bij ZP Zaken zitten ze samen in één polis: BAV € 5.000.000 en AVB € 2.500.000 per aanspraak.", link: "/kennisbank/verschil-bav-avb-zzp", linkLabel: "Lees meer" },
  { question: "Wat valt niet onder de BAV + AVB?", answer: "Je eigen schade valt er niet onder, zoals uren die je onbetaald overdoet of omzet die je misloopt. Schade door opzet en boetes die je zelf krijgt vallen er in de regel ook niet onder, net als fouten van voor je ingangsdatum. Wat precies gedekt is, staat in de polisvoorwaarden.", link: "/voorwaarden", linkLabel: "polisvoorwaarden" },
  { question: "Hoe snel is de BAV + AVB geregeld?", answer: "Je vraagt online aan en kiest zelf de ingangsdatum, vroegst de dag na je aanvraag. Binnen 24 uur is het geregeld en staat je certificaat in je mailbox, dat je naar je opdrachtgever stuurt. ZP Zaken beoordeelt je aanvraag." },
];

export default function Verzekeringen() {
  const { t } = useTranslation();

  const insurances = [
    { id: "bav-avb-combinatiepolis", icon: Shield, title: t("insuranceData.combiTitle"), subtitle: t("insuranceData.combiSubtitle"), description: t("insuranceData.combiDesc"), features: t("insuranceData.combiFeatures", { returnObjects: true }) as string[], forWho: t("insuranceData.combiForWho"), price: t("insuranceData.combiPrice"), canApplyOnline: true, isMostChosen: true },
    { id: "arbeidsongeschiktheid", icon: Heart, title: t("insuranceData.aovTitle"), subtitle: t("insuranceData.aovSubtitle"), description: t("insuranceData.aovDesc"), features: t("insuranceData.aovFeatures", { returnObjects: true }) as string[], forWho: t("insuranceData.aovForWho"), price: t("insuranceData.aovPrice"), canApplyOnline: false },
    { id: "rechtsbijstand", icon: Scale, title: t("insuranceData.rechtsbijstandTitle"), subtitle: t("insuranceData.rechtsbijstandSubtitle"), description: t("insuranceData.rechtsbijstandDesc"), features: t("insuranceData.rechtsbijstandFeatures", { returnObjects: true }) as string[], forWho: t("insuranceData.rechtsbijstandForWho"), price: t("insuranceData.rechtsbijstandPrice"), canApplyOnline: false },
  ];
  

  // Product + Offer per pakket, uitsluitend uit bavPakketten.ts.
  const productJsonLd = bavPakketten.map((pakket) => productSchema(pakket));

  return (
    <Layout>
      <SEOHead
        title={SEO.title}
        description={SEO.description}
      >
        {productJsonLd.map((schema, i) => (
          <script key={i} type="application/ld+json">{JSON.stringify(schema)}</script>
        ))}
        <script type="application/ld+json">{JSON.stringify(faqSchema(verzekeringenFaqs))}</script>
      </SEOHead>

      <PageHero
        title={<>BAV &amp; AVB: <span className="text-accent">de combinatiepolis voor zzp'ers</span></>}
        subtitle={t("verzekeringenPage.subtitle")}
        badge={{ icon: <Sparkles className="h-4 w-4" />, text: t("verzekeringenPage.badge") }}
        backgroundImage={teamBoyCalling}
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button variant="accent" size="lg" asChild>
            <a href="#combinatiepolis" onClick={(e) => scrollNaarAanvraag(e)}>Online aanvragen<ArrowRight className="h-5 w-5" /></a>
          </Button>
          <Button variant="heroOutline" size="lg" asChild>
            <LocalizedLink to="/contact" onClick={openTerugbelKlik}>Persoonlijk contact</LocalizedLink>
          </Button>
        </div>
      </PageHero>

      {/* BAV Wizard */}
      <BAVApplicationModule />

      <WaarLetJeOpBav />

      <section className="section-padding bg-background">
        <div className="container-wide max-w-3xl">
          <h2 className="mb-6">De BAV + AVB in cijfers</h2>
          <dl className="divide-y divide-border">
            {[
              ["BAV per aanspraak", "€ 5.000.000"],
              ["AVB per aanspraak", "€ 2.500.000"],
              ["Eigen risico BAV + AVB", "Geen"],
              ["Prijs", "€ 55 per maand of € 600 per jaar, inclusief kosten en assurantiebelasting"],
              ["Contract", "Geen jaarcontract, dagelijks opzegbaar"],
              ["Geregeld", "Binnen 24 uur, certificaat per mail"],
              ["Verzekeraar", "Hiscox"],
            ].map(([label, waarde]) => (
              <div key={label} className="grid gap-2 py-4 sm:grid-cols-2">
                <dt className="font-semibold">{label}</dt><dd className="text-muted-foreground">{waarde}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-6 text-muted-foreground">Wat precies gedekt is, staat in de <LocalizedLink to="/voorwaarden" className="underline underline-offset-4">polisvoorwaarden</LocalizedLink>.</p>
        </div>
      </section>

      {/* Drie-keuze CTA */}
      <section className="section-padding bg-secondary border-y border-border">
        <div className="container-wide">
          <div className="text-center mb-8 max-w-2xl mx-auto">
            <h2 className="mb-3">Liever overleg of een offerte op maat?</h2>
            <p className="text-muted-foreground">Kies hoe je verder wilt.</p>
          </div>
          <ThreeOptionCTA />
        </div>
      </section>


      {/* Trust bar */}
      <div className="bg-secondary border-b border-border py-4">
        <TrustBar />
      </div>

      {/* 3-stappen + kwalificatiecheck */}
      <section className="section-padding bg-background">
        <div className="container-wide">
          <StepsProcess />

          <div className="max-w-2xl mx-auto mt-12">
            <QualificationCheck />
          </div>
        </div>
      </section>

      {/* Verzekeringen */}
      <section className="section-padding bg-secondary">
        <div className="container-wide">
          <div className="space-y-16">
            {insurances.map((insurance, index) => (
              <div key={insurance.id} id={insurance.id} className="scroll-mt-24">
                {insurance.isMostChosen && (
                  <div className="inline-flex items-center gap-2 bg-accent text-accent-foreground px-4 py-1.5 rounded-t-xl text-sm font-semibold">
                    <Star className="h-4 w-4" />
                    {t("insuranceData.mostChosen")}
                  </div>
                )}
                <div className={`${insurance.isMostChosen ? "border-2 border-accent rounded-b-2xl rounded-tr-2xl p-6 md:p-8 bg-card" : ""}`}>
                  <div className={`grid lg:grid-cols-5 gap-8 lg:gap-12 items-start ${index % 2 === 1 ? 'lg:grid-flow-col-dense' : ''}`}>
                    <div className={`lg:col-span-3 ${index % 2 === 1 ? 'lg:col-start-3' : ''}`}>
                      <div className="flex items-center gap-4 mb-6">
                        <div className="h-14 w-14 rounded-xl bg-accent/10 flex items-center justify-center">
                          <insurance.icon className="h-7 w-7 text-accent" />
                        </div>
                        <div>
                          <h2 className="text-2xl md:text-3xl">{insurance.title}</h2>
                          <p className="text-muted-foreground">{insurance.subtitle}</p>
                        </div>
                      </div>
                      <p className="text-lg text-muted-foreground mb-6">{insurance.description}</p>
                      <div className="flex flex-wrap gap-2 mb-6">
                        {insurance.features.map((feature) => (
                          <span key={feature} className="inline-flex items-center gap-2 bg-accent/10 border border-accent/20 text-foreground px-3 py-1.5 rounded-lg text-sm">
                            <CheckCircle className="h-3.5 w-3.5 text-accent" />{feature}
                          </span>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-3 mb-6">
                        <div className="inline-flex items-center gap-2 bg-card border border-border/50 shadow-sm px-4 py-2.5 rounded-xl">
                          <Shield className="h-4 w-4 text-accent" />
                          <div>
                            <span className="text-xs text-muted-foreground">{t("verzekeringenPage.suitableFor")}</span>
                            <p className="text-sm font-medium">{insurance.forWho}</p>
                          </div>
                        </div>
                        <div className="inline-flex items-center gap-2 bg-accent/10 border border-accent/20 px-4 py-2.5 rounded-xl">
                          <Euro className="h-4 w-4 text-accent" />
                          <div>
                            {!insurance.canApplyOnline && /\d/.test(insurance.price) && <span className="text-xs text-muted-foreground">{t("verzekeringenPage.indication")}</span>}
                            <p className="text-sm font-medium text-accent">{insurance.price}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        {insurance.canApplyOnline && (
                          <Button variant="accent" asChild>
                            <a href="#combinatiepolis" onClick={(e) => scrollNaarAanvraag(e)}>
                              <Globe className="h-4 w-4" />{t("verzekeringenPage.onlineApply")}
                            </a>
                          </Button>
                        )}
                        <Button variant={insurance.canApplyOnline ? "outline" : "accent"} asChild>
                          <LocalizedLink to={insurance.id === "arbeidsongeschiktheid" ? "/aov" : "/contact"}>{t(insurance.id === "arbeidsongeschiktheid" ? "insuranceData.aovCta" : "verzekeringenPage.askAdvice")}<ArrowRight className="h-4 w-4" /></LocalizedLink>
                        </Button>
                        {insurance.isMostChosen && <MiniSocialProof className="ml-2 hidden md:flex" />}
                      </div>
                    </div>
                    <div className={`lg:col-span-2 ${index % 2 === 1 ? 'lg:col-start-1 lg:row-start-1' : ''}`}>
                      <div className="bg-accent/10 border border-accent/20 rounded-xl p-6">
                        <div className="flex items-center gap-2 mb-3">
                          <Shield className="h-5 w-5 text-accent" />
                          <p className="font-semibold text-accent">{t("verzekeringenPage.didYouKnow")}</p>
                        </div>
                        <p className="text-sm text-muted-foreground">{t("verzekeringenPage.taxDeductible")}</p>
                      </div>
                    </div>
                  </div>
                </div>
                {index < insurances.length - 1 && !insurance.isMostChosen && <div className="border-t border-border mt-16" />}
                {insurance.isMostChosen && <div className="mt-16" />}
              </div>
            ))}
          </div>
          <p className="mt-10 text-center">
            <LocalizedLink to="/bav-zzp-vergelijken" className="inline-flex items-center gap-2 font-semibold text-accent underline underline-offset-4">
              BAV vergelijken met andere aanbieders<ArrowRight className="h-4 w-4" />
            </LocalizedLink>
          </p>
          <p className="mt-4 text-center">
            <LocalizedLink to="/starters" className="inline-flex items-center gap-2 font-semibold text-accent underline underline-offset-4">
              Net begonnen als zzp'er? Bekijk het starterspakket<ArrowRight className="h-4 w-4" />
            </LocalizedLink>
          </p>
          <p className="mt-4 text-center">
            <LocalizedLink to="/beroepsaansprakelijkheidsverzekering" className="inline-flex items-center gap-2 font-semibold text-accent underline underline-offset-4">
              Meer over de beroepsaansprakelijkheidsverzekering<ArrowRight className="h-4 w-4" />
            </LocalizedLink>
          </p>
          <p className="mt-4 text-center">
            <LocalizedLink to="/bav-zzp" className="inline-flex items-center gap-2 font-semibold text-accent underline underline-offset-4">
              Meer over de BAV voor zzp'ers<ArrowRight className="h-4 w-4" />
            </LocalizedLink>
          </p>
        </div>
      </section>

      {/* Waarom zo voordelig */}
      <section className="section-padding bg-background">
        <div className="container-wide max-w-3xl mx-auto">
          <WhyAffordable />
        </div>
      </section>

      <section className="section-padding text-white relative overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img loading="lazy" decoding="async" src={officeFlowers} alt="" className="w-full h-full object-cover bg-person" aria-hidden="true" />
          <div className="absolute inset-0 bg-gradient-to-r from-accent/95 via-accent/90 to-accent/85" />
        </div>
        <div className="container-wide relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="mb-4 text-white">{t("verzekeringenPage.ctaTitle")}</h2>
            <p className="text-lg text-white/80 mb-6">{t("verzekeringenPage.ctaSubtitle")}</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
              <Button size="lg" asChild className="bg-white text-accent hover:bg-white/90 shadow-lg">
                <LocalizedLink to="/contact">{t("verzekeringenPage.ctaButton")}<ArrowRight className="h-5 w-5" /></LocalizedLink>
              </Button>
              <a
                href="tel:0204573077"
                className="inline-flex items-center justify-center gap-2 text-white border border-white/40 rounded-lg px-4 py-2 hover:bg-white/10 transition-all font-medium"
              >
                📞 020 - 457 3077
              </a>
            </div>
            <MiniSocialProof variant="dark" className="justify-center" />
          </div>
        </div>
      </section>

      <HiscoxTrustStrip />
      <p className="container-wide pb-2 text-center text-sm text-muted-foreground">
        <LocalizedLink className="font-medium text-accent underline underline-offset-2" to="/kennisbank/wat-kosten-verzekeringen-voor-zzp-ers">
          Wat kosten verzekeringen voor zzp'ers in 2026?
        </LocalizedLink>
      </p>
      <section className="section-padding bg-background">
        <div className="container-wide max-w-3xl">
          <h2 className="mb-6">Veelgestelde vragen</h2>
          <Accordion type="single" collapsible>
            {verzekeringenFaqs.map((faq, i) => (
              <AccordionItem key={faq.question} value={`verzekering-faq-${i}`}>
                <AccordionTrigger className="text-left">{faq.question}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  <div data-faq-answer><BeroepspaginaTekst tekst={faq.answer} links={faq.link && faq.linkLabel !== "Lees meer" ? { [faq.linkLabel]: faq.link } : undefined} /></div>
                  {faq.link && faq.linkLabel === "Lees meer" && <LocalizedLink to={faq.link} className="mt-3 inline-block underline underline-offset-4">Lees meer</LocalizedLink>}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          <p className="mt-6 text-sm text-muted-foreground">Bijgewerkt: 10 november 2026</p>
        </div>
      </section>
      <LeesMeer voorkeur={["bav-afsluiten-als-zzper-dit-is-waarom-en-hoe-je-het-regelt", "bedrijfsaansprakelijkheidsverzekering-zzp", "wat-kosten-verzekeringen-voor-zzp-ers", "welke-verzekeringen-zzp", "cyberverzekering-zzp"]} />
    </Layout>
  );
}

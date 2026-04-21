import { SEOHead } from "@/components/SEOHead";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { LocalizedLink } from "@/components/LocalizedLink";
import { ArrowRight, Shield, Users, KeyRound, CheckCircle } from "lucide-react";
import { motion } from "framer-motion";
import { MiniSocialProof } from "@/components/shared/MiniSocialProof";
import { SavingsCalculator } from "@/components/waarom/SavingsCalculator";
import { EyeopenerBanner } from "@/components/waarom/EyeopenerBanner";
import { IntermediaryCards } from "@/components/waarom/IntermediaryCards";
import { BemiddelingSection } from "@/components/waarom/BemiddelingSection";
import { FAQSection, faqSchema } from "@/components/waarom/FAQSection";
import teamHero from "@/assets/team-hero.jpg";

const schema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "name": "Waarom betaal je een tussenpersoon voor jouw verzekering? | ZP Zaken",
      "description": "ZP Zaken was de verzekeringsspecialist achter grote intermediairs. Nu sluit je direct bij ons af. Bereken hoeveel je bespaart — vaak meer dan €600 per jaar.",
      "url": "https://zpzaken.nl/waarom-zp-zaken",
      "provider": { "@type": "Organization", "name": "ZP Zaken", "url": "https://zpzaken.nl" },
    },
    faqSchema,
  ],
};

const fade = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.21, 0.47, 0.32, 0.98] } },
};

const packages = [
  { name: "Combi Basis", price: 30, eventCoverage: "€ 500.000", yearCoverage: "€ 1.000.000", features: ["BAV + AVB gecombineerd", "Geen eigen risico", "Dagelijks opzegbaar"] },
  { name: "Combi Uitgebreid", price: 45, eventCoverage: "€ 2.500.000", yearCoverage: "€ 5.000.000", features: ["BAV + AVB gecombineerd", "Geen eigen risico", "Dagelijks opzegbaar", "Rechtsbijstand bij claims"], popular: true },
  { name: "Combi Compleet", price: 65, eventCoverage: "€ 5.000.000", yearCoverage: "€ 10.000.000", features: ["BAV + AVB gecombineerd", "Geen eigen risico", "Dagelijks opzegbaar", "Rechtsbijstand bij claims", "Cyberdekking"] },
];

const diffBlocks = [
  {
    icon: Shield,
    title: "Verzekerd ook als je even niet werkt",
    text: "Een intermediair koppelt je dekking aan een lopende opdracht. Tussen twee opdrachten in? Dan ben je onverzekerd — precies op het moment dat je kwetsbaar bent. Bij ZP Zaken loop je een vaste maandpolis. Dagelijks opzegbaar, maar nooit automatisch gestopt. Jij bepaalt wanneer je stopt, niet je opdrachtgever.",
  },
  {
    icon: Users,
    title: "5.000+ zzp'ers delen de premie — jij profiteert",
    text: "ZP Zaken werkt met een mantelovereenkomst. Dat betekent dat het verzekerde bedrag gedeeld wordt over duizenden zelfstandigen tegelijk. Daardoor kan de premie structureel laag blijven — niet als tijdelijke aanbieding, maar als permanent voordeel. Een intermediair koopt individueel in en telt zijn marge bovenop. Dat verschil betaal jij.",
  },
  {
    icon: KeyRound,
    title: "Jij beheert je polis — niemand anders",
    text: "Via een intermediair zit je verzekeringsrelatie ingebed in een groter contract. Aanpassen, opzeggen of upgraden? Dat gaat via hun administratie, op hun tijdlijn. Bij ZP Zaken log je direct in op Mijn ZP Zaken en regel je alles zelf — direct, zonder tussenkomst.",
  },
];

export default function WaaromZpZaken() {
  return (
    <Layout>
      <SEOHead
        title="Waarom ZP Zaken? | Onafhankelijk Verzekerd Zonder Tussenkomst"
        description="ZP Zaken werkt direct voor jou als zzp'er, zonder platform of tussenpersoon. Vergelijk wat je betaalt via een intermediair versus direct bij ZP Zaken."
      >
        <script type="application/ld+json">{JSON.stringify(schema)}</script>
      </SEOHead>

      {/* ── HERO ── */}
      <section className="relative min-h-[50vh] flex items-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img src={teamHero} alt="" className="w-full h-full object-cover" aria-hidden="true" />
          <div className="absolute inset-0 bg-gradient-to-r from-foreground/95 via-foreground/90 to-foreground/80" />
        </div>
        <div className="container-wide relative z-10 py-20 md:py-28">
          <motion.div initial="hidden" animate="visible" variants={fade} className="max-w-3xl">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-primary-foreground leading-tight mb-6"
            >
              Onafhankelijk verzekerd.{" "}
              <span className="text-accent">Zonder tussenkomst.</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="text-lg md:text-xl text-primary-foreground/80 mb-8 max-w-2xl"
            >
              Als zzp'er betaal je vaak meer dan je denkt. Niet aan je verzekering, maar aan de partij die hem voor jou regelt. ZP Zaken is de enige AFM-gecertificeerde specialist die direct met jou werkt — zonder platform, zonder opslag, zonder afhankelijkheid.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="flex flex-wrap gap-4"
            >
              <Button variant="accent" size="lg" asChild className="shadow-lg">
                <a href="#rekentool">Bereken jouw besparing <ArrowRight className="h-5 w-5" /></a>
              </Button>
              <Button variant="heroOutline" size="lg" asChild>
                <LocalizedLink to="/verzekeringen">Direct afsluiten</LocalizedLink>
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── EYEOPENER BANNER ── */}
      <EyeopenerBanner />

      {/* ── REKENMODEL ── */}
      <section id="rekentool" className="section-padding bg-background scroll-mt-20">
        <div className="container-wide">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fade} className="text-center mb-12 max-w-3xl mx-auto">
            <h2 className="mb-4">Wat kost een platform jou per jaar?</h2>
            <p className="text-muted-foreground">
              Grote platforms en intermediairs bundelen verzekeringen in hun servicepakketten. Handig — maar niet gratis. Bereken hieronder wat jij werkelijk betaalt en wat je overhoudt als je direct bij de bron afsluit.
            </p>
          </motion.div>
          <SavingsCalculator />
        </div>
      </section>

      {/* ── DE DRIE GROTE ── */}
      <IntermediaryCards />

      {/* ── BEMIDDELING ── */}
      <BemiddelingSection />

      {/* ── HET ECHTE VERSCHIL ── */}
      <section className="section-padding bg-secondary">
        <div className="container-wide">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fade} className="text-center mb-12">
            <h2 className="mb-4">Meer dan prijs alleen — dit is wat je terugwint</h2>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {diffBlocks.map((block, i) => (
              <motion.div
                key={block.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="bg-card rounded-2xl p-8 border border-border shadow-sm"
              >
                <div className="h-12 w-12 rounded-xl bg-accent/10 flex items-center justify-center mb-5">
                  <block.icon className="h-6 w-6 text-accent" />
                </div>
                <h3 className="text-lg font-bold mb-3">{block.title}</h3>
                <p className="text-muted-foreground leading-relaxed text-sm">{block.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PAKKETVERGELIJKING ── */}
      <section className="section-padding bg-background">
        <div className="container-wide">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fade} className="text-center mb-12">
            <h2 className="mb-4">Onze pakketten — transparant en compleet</h2>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-8">
            {packages.map((pkg, i) => (
              <motion.div
                key={pkg.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className={`relative bg-card rounded-2xl p-8 border-2 transition-shadow ${pkg.popular ? "border-accent shadow-lg" : "border-border"}`}
              >
                {pkg.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-accent-foreground text-xs font-bold px-4 py-1 rounded-full">
                    Meest gekozen
                  </span>
                )}
                <h3 className="text-lg font-bold mb-1">{pkg.name}</h3>
                <p className="text-3xl font-bold text-accent mb-1">€{pkg.price}<span className="text-sm font-normal text-muted-foreground">/maand</span></p>
                <div className="text-xs text-muted-foreground mb-6 space-y-0.5">
                  <p>{pkg.eventCoverage} per gebeurtenis</p>
                  <p>{pkg.yearCoverage} per jaar</p>
                </div>
                <ul className="space-y-2">
                  {pkg.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fade} className="text-center">
            <p className="text-muted-foreground mb-6">Geen eigen risico. Geen medische keuring. Dagelijks opzegbaar. Direct gedekt.</p>
            <Button variant="accent" size="lg" asChild>
              <LocalizedLink to="/verzekeringen">Sluit nu direct af <ArrowRight className="h-5 w-5" /></LocalizedLink>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <FAQSection />

      {/* ── FIGHTER AFSLUITER ── */}
      <section className="section-padding bg-[hsl(0,0%,10%)]">
        <div className="container-wide">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fade} className="max-w-3xl mx-auto text-center mb-12">
            <blockquote className="text-2xl md:text-3xl font-bold text-white leading-snug mb-2">
              "Onafhankelijk advies betekent dat wij werken voor jou — niet voor het platform, niet voor de verzekeraar, niet voor de opdrachtgever. Gewoon voor jou."
            </blockquote>
          </motion.div>

          <div className="grid grid-cols-3 gap-6 max-w-2xl mx-auto mb-12">
            {[
              { number: "13+", label: "jaar specialist in zzp-verzekeringen" },
              { number: "5.000+", label: "tevreden zzp'ers" },
              { number: "€0", label: "eigen risico" },
            ].map((stat, i) => (
              <motion.div
                key={stat.number}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center"
              >
                <p className="text-3xl md:text-4xl font-bold text-accent">{stat.number}</p>
                <p className="text-xs md:text-sm text-white/60 mt-1">{stat.label}</p>
              </motion.div>
            ))}
          </div>

          <div className="text-center">
            <Button size="lg" asChild className="bg-white text-accent hover:bg-white/90 shadow-lg font-bold">
              <LocalizedLink to="/verzekeringen">Start vandaag <ArrowRight className="h-5 w-5" /></LocalizedLink>
            </Button>
            <div className="mt-6">
              <MiniSocialProof variant="dark" className="justify-center" />
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}

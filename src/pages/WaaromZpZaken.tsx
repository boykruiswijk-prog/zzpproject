import { SEOHead } from "@/components/SEOHead";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { LocalizedLink } from "@/components/LocalizedLink";
import { ArrowRight, X, CheckCircle, Star, Shield, Quote } from "lucide-react";
import { motion } from "framer-motion";
import { MiniSocialProof } from "@/components/shared/MiniSocialProof";
import teamHero from "@/assets/team-hero.jpg";
import teamCheers from "@/assets/team-cheers.jpg";
import teamWalking from "@/assets/team-walking.jpg";

const schema = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "Direct verzekerd via de bron | Geen intermediair | ZP Zaken",
  "description": "ZP Zaken leverde de verzekeringsproposities achter grote intermediairs. Nu sluit je direct bij ons af. Zelfde kwaliteit, lagere prijs, altijd onafhankelijk.",
  "url": "https://zpzaken.nl/waarom-zp-zaken",
  "provider": { "@type": "Organization", "name": "ZP Zaken", "url": "https://zpzaken.nl" },
};

const comparisonRows = [
  {
    label: "Herkomst",
    intermediair: "Verzekering ingekocht bij een specialist",
    zpzaken: "Wij zijn die specialist — rechtstreeks aan jou",
  },
  {
    label: "Prijs",
    intermediair: "Basisprijs + marge intermediair",
    zpzaken: "Laagste prijs, geen tussenpersoon",
  },
  {
    label: "Dekking",
    intermediair: "Stopt als jouw opdracht stopt",
    zpzaken: "Altijd verzekerd, ongeacht opdrachtgever",
  },
  {
    label: "Vrijheid",
    intermediair: "Gebonden aan hun pakket en hun verzekeraar",
    zpzaken: "Dagelijks opzegbaar, geen eigen risico",
  },
  {
    label: "Transparantie",
    intermediair: "Zij ontvangen commissie over jouw premie",
    zpzaken: "Geen verborgen kosten, directe relatie",
  },
  {
    label: "Expertise",
    intermediair: "Verzekering als bijproduct van bemiddeling",
    zpzaken: "10+ jaar specialist in zzp-verzekeringen",
  },
];

const testimonials = [
  { name: "Thomas de Wit", role: "Testmanager", content: "De combinatiepolis van beroeps- en bedrijfsaansprakelijkheid scheelt me honderden euro's per jaar. Slim geregeld." },
  { name: "Michelle Groot", role: "Interimmanager", content: "Na jaren bij een grote verzekeraar eindelijk persoonlijk contact. Ze kennen mijn situatie en denken proactief mee." },
  { name: "Fatima El Amrani", role: "Changemanager", content: "In de zorg is goede verzekering essentieel. ZP Zaken begreep direct wat ik nodig had. Zeer tevreden met het advies." },
];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.21, 0.47, 0.32, 0.98] } },
};

export default function WaaromZpZaken() {
  return (
    <Layout>
      <SEOHead
        title="Direct verzekerd via de bron | Geen intermediair | ZP Zaken"
        description="ZP Zaken leverde de verzekeringsproposities achter grote intermediairs. Nu sluit je direct bij ons af. Zelfde kwaliteit, lagere prijs, altijd onafhankelijk."
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
          <motion.div initial="hidden" animate="visible" variants={fadeUp} className="max-w-3xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="inline-flex items-center gap-2 bg-accent/20 backdrop-blur-sm border border-accent/30 text-white px-4 py-2 rounded-full mb-6"
            >
              <Shield className="h-4 w-4" />
              <span className="text-sm font-medium">Rechtstreeks van de bron</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="text-primary-foreground leading-tight mb-6"
            >
              Wij waren de bron.{" "}
              <span className="text-accent">Nu ben jij de winnaar.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="text-lg md:text-xl text-primary-foreground/80 mb-8 max-w-2xl"
            >
              ZP Zaken leverde jarenlang de verzekeringsproposities achter de schermen bij grote intermediairs. Nu doe je het direct bij ons — zonder tussenpersoon, zonder opslag.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
            >
              <Button variant="accent" size="lg" asChild className="shadow-lg">
                <LocalizedLink to="/verzekeringen">
                  Sluit direct af bij ZP Zaken <ArrowRight className="h-5 w-5" />
                </LocalizedLink>
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── ONTHULLING ── */}
      <section className="section-padding bg-secondary">
        <div className="container-wide max-w-3xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
            <h2 className="mb-6">Het open geheim van de intermediair</h2>
            <p className="text-lg text-muted-foreground leading-relaxed mb-6">
              Grote intermediairs bieden zzp'ers verzekeringen aan als onderdeel van hun servicepakket. Handig, zo lijkt het. Maar wat ze niet vertellen: die verzekeringen werden geleverd door gespecialiseerde partijen zoals ZP Zaken. Wij waren de bron achter hun propositie.
            </p>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Het verschil? Als jij via een intermediair een verzekering afsloot, betaalde je hun marge bovenop onze prijs. Nu je rechtstreeks bij ons komt, vervalt die opslag volledig. Zelfde product. Zelfde expertise. Lagere prijs.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── VERGELIJKINGSTABEL ── */}
      <section className="section-padding bg-background">
        <div className="container-wide">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center mb-12">
            <h2 className="mb-4">Jij verdient de beste deal — zonder omweg</h2>
          </motion.div>

          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="grid grid-cols-[1fr_1fr_1fr] gap-4 mb-2">
              <div />
              <div className="bg-muted rounded-t-xl px-4 py-3 text-center">
                <p className="text-sm font-semibold text-muted-foreground">Via een intermediair</p>
              </div>
              <div className="bg-accent/10 border border-accent/20 rounded-t-xl px-4 py-3 text-center">
                <p className="text-sm font-semibold text-accent">Direct via ZP Zaken</p>
              </div>
            </div>

            {/* Rows */}
            {comparisonRows.map((row, i) => (
              <motion.div
                key={row.label}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.07 }}
                className={`grid grid-cols-[1fr_1fr_1fr] gap-4 ${i % 2 === 0 ? "bg-secondary/50" : ""} ${i === comparisonRows.length - 1 ? "rounded-b-xl" : ""}`}
              >
                <div className="px-4 py-4 flex items-center">
                  <p className="font-semibold text-sm">{row.label}</p>
                </div>
                <div className="px-4 py-4 flex items-start gap-2">
                  <X className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">{row.intermediair}</p>
                </div>
                <div className="px-4 py-4 flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
                  <p className="text-sm font-medium">{row.zpzaken}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FIGHTER TEKST ── */}
      <section className="section-padding relative overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img src={teamWalking} alt="" className="w-full h-full object-cover" aria-hidden="true" />
          <div className="absolute inset-0 bg-gradient-to-r from-foreground/97 via-foreground/95 to-foreground/90" />
        </div>
        <div className="container-wide relative z-10 max-w-3xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
            <h2 className="text-primary-foreground mb-8">Jij bent geen bijproduct van een opdracht</h2>
            <div className="space-y-6 text-primary-foreground/80 text-lg leading-relaxed">
              <p>
                Intermediairs bieden verzekeringen aan als 'service module' bij een opdracht. Klinkt handig. Maar ze verdienen commissie over elke module die jij afneemt. Jouw verzekering is hun verdienmodel — niet jouw belang.
              </p>
              <p>
                Als jouw opdracht stopt, stopt jouw dekking. Precies op het moment dat je het meest kwetsbaar bent. Dat is geen service — dat is afhankelijkheid.
              </p>
              <p>
                ZP Zaken werkt andersom. Wij bestaan alleen voor jou als zzp'er. Geen opdracht nodig. Geen tussenpersoon. Gewoon de beste dekking, rechtstreeks van de bron.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── SOCIAL PROOF ── */}
      <section className="section-padding bg-secondary">
        <div className="container-wide">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center mb-12">
            <h2 className="mb-4">2.500+ zzp'ers kozen voor onafhankelijkheid</h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-12">
            {testimonials.map((t, i) => (
              <motion.div
                key={t.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="bg-card rounded-xl p-6 shadow-sm border border-border relative hover:shadow-md transition-shadow"
              >
                <Quote className="absolute top-5 right-5 h-6 w-6 text-primary/10" />
                <div className="flex gap-0.5 mb-3">
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} className="h-4 w-4 fill-accent text-accent" />
                  ))}
                </div>
                <p className="text-foreground text-sm mb-5 leading-relaxed">"{t.content}"</p>
                <div>
                  <p className="font-medium text-foreground text-sm">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.role}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
            className="flex flex-wrap justify-center items-center gap-8 pt-8 border-t border-border"
          >
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="h-10 w-10 rounded-lg bg-card border border-border flex items-center justify-center font-bold text-xs text-primary">AFM</div>
              <span className="text-sm">Vergunning 12050636</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="h-10 w-10 rounded-lg bg-card border border-border flex items-center justify-center font-bold text-xs text-primary">Kifid</div>
              <span className="text-sm">Kifid aangesloten</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="h-10 w-10 rounded-lg bg-card border border-border flex items-center justify-center">
                <Star className="h-5 w-5 fill-accent text-accent" />
              </div>
              <span className="text-sm">10+ jaar ervaring</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── FINALE CTA ── */}
      <section className="section-padding relative overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img src={teamCheers} alt="" className="w-full h-full object-cover" aria-hidden="true" />
          <div className="absolute inset-0 bg-gradient-to-r from-accent/95 via-accent/90 to-accent/85" />
        </div>
        <div className="container-wide relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="mb-4 text-white"
            >
              Stop met betalen voor de tussenpersoon
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-lg text-white/80 mb-8"
            >
              Sluit vandaag direct af. In 5 stappen geregeld. Zelfde kwaliteit — rechtstreeks van de bron.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="flex flex-col sm:flex-row gap-4 justify-center items-center"
            >
              <Button size="lg" asChild className="bg-white text-accent hover:bg-white/90 shadow-lg">
                <LocalizedLink to="/verzekeringen">
                  Start direct <ArrowRight className="h-5 w-5" />
                </LocalizedLink>
              </Button>
              <a
                href="tel:0232010502"
                className="inline-flex items-center gap-2 text-white border border-white/40 rounded-lg px-5 py-3 hover:bg-white/10 transition-all font-medium"
              >
                📞 023 - 201 0502
              </a>
            </motion.div>
            <div className="mt-6">
              <MiniSocialProof variant="dark" className="justify-center" />
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}

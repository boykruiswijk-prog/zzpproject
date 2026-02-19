import { Helmet } from "react-helmet-async";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LocalizedLink } from "@/components/LocalizedLink";
import { AnimatedSection, StaggerContainer, StaggerItem } from "@/components/ui/animated-section";
import { motion } from "framer-motion";
import { trackCTA } from "@/lib/tracking";
import {
  Shield,
  ArrowRight,
  Calendar,
  AlertTriangle,
  Heart,
  Lock,
  Clock,
  ShieldCheck,
  CreditCard,
  Eye,
  Users,
  CheckCircle2,
  Ban,
  XCircle,
  Building2,
  Globe,
  Briefcase,
  Laptop,
  Stethoscope,
  Landmark,
  Sparkles,
  Phone,
} from "lucide-react";
import creditcontrolHero from "@/assets/creditcontrol-hero.jpg";
import teamBoyCalling from "@/assets/team-boy-calling.jpg";

export default function CreditControl() {
  const usps = [
    {
      icon: Lock,
      title: "Tussenrekening (Geldbescherming)",
      description:
        "Het geld van jouw factuur wordt gestort op een afgescheiden tussenrekening.",
      points: [
        "Niemand kan eraan komen",
        "Het valt niet in een failliete boedel",
        "Het staat juridisch afgescheiden",
        "Alleen jij hebt afroeprecht",
      ],
    },
    {
      icon: Clock,
      title: "Afroepbaar wanneer jij wilt",
      description:
        "Je bepaalt zelf wanneer je uitbetaling aanvraagt. Niet wanneer een broker dat nodig vindt.",
      points: [],
    },
    {
      icon: ShieldCheck,
      title: "Bescherming bij faillissement",
      description:
        "Bij dreigend of aankomend faillissement van een bemiddelaar of broker:",
      points: [
        "Staat jouw geld veilig",
        "Is het niet onderdeel van discussie",
        "Blijft het volledig voor jou beschikbaar",
      ],
    },
    {
      icon: CreditCard,
      title: "Kredietverzekering",
      description:
        "ZP Zaken heeft een gespecialiseerde kredietverzekering afgesloten:",
      points: [
        "Volledige dekking voor deze doelgroep",
        "Altijd verzekerd",
        "Altijd uitkeerbaar",
        "Maximale zekerheid",
      ],
    },
    {
      icon: Eye,
      title: "Transparantie",
      description:
        "Geen verborgen kosten. Geen schaduwfinanciering. Geen constructies buiten jouw zicht.",
      points: [],
    },
  ];

  const problems = [
    "Brokers en bemiddelaars factoreren facturen van opdrachtgevers.",
    "Omzet wordt naar voren gehaald om eigen financieringsdoelen te realiseren.",
    "Facturen van ZZP'ers worden gebruikt als werkkapitaal.",
    "ZZP'ers weten vaak niet eens dat hun factuur is gefactord.",
    "Bij financiële problemen of faillissementen ontstaat onzekerheid.",
    "Betalingen komen onder druk te staan of worden vertraagd.",
  ];

  const beliefs = [
    { icon: Heart, text: "Eerlijke betaling" },
    { icon: Eye, text: "Transparantie" },
    { icon: Briefcase, text: "Financiële autonomie" },
    { icon: Users, text: "Ondernemersregie" },
    { icon: Shield, text: "Veiligheid boven alles" },
  ];

  const cases = [
    {
      title: "Failliete broker",
      text: "Een bemiddelaar factureert bij de opdrachtgever, factorert de omzet, gebruikt het geld als werkkapitaal en gaat vervolgens failliet. ZZP'ers wachten maanden — of verliezen hun geld volledig.",
    },
    {
      title: "Dubbele afhankelijkheid",
      text: "De opdrachtgever betaalt tijdig, maar de bemiddelaar heeft liquiditeitsproblemen. De ZZP'er wordt vertraagd uitbetaald ondanks correcte betaling door opdrachtgever.",
    },
    {
      title: "Onzichtbare factoring",
      text: "ZZP'er ontdekt pas achteraf dat facturen structureel zijn gefactord tegen hoge kosten — zonder inspraak of transparantie.",
    },
  ];

  const benefits = [
    "Directe liquiditeit wanneer jij dat wilt",
    "Geen afhankelijkheid van broker cashflow",
    "Volledige transparantie in factuurstatus",
    "Bescherming tegen systeemrisico",
    "Geen verrassing bij financiële problemen in de keten",
    "Echte ondernemersregie",
  ];

  const targetAudience = [
    { icon: Users, text: "ZZP'ers die via brokers werken" },
    { icon: Briefcase, text: "Interim professionals" },
    { icon: Laptop, text: "IT, finance, zorg, overheid" },
    { icon: Globe, text: "Internationale contractors" },
    { icon: CreditCard, text: "Ondernemers die cashflowzekerheid willen" },
  ];

  const schema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "ZP Zaken CreditControl",
    description:
      "Een veilige, transparante en eerlijke oplossing voor eerder betalen én volledige zekerheid rondom betaling voor ZZP'ers.",
    brand: { "@type": "Organization", name: "ZP Zaken", url: "https://zpzaken.nl" },
    url: "https://zpzaken.nl/creditcontrol",
  };

  return (
    <Layout>
      <Helmet>
        <title>CreditControl — Eerder betaald, volledige zekerheid | ZP Zaken</title>
        <meta
          name="description"
          content="ZP Zaken CreditControl: eerder betaald worden als ZZP'er met volledige zekerheid. Bescherming tegen faillissement, transparante factoring en 100% regie."
        />
        <link rel="canonical" href="https://zpzaken.nl/creditcontrol" />
        <script type="application/ld+json">{JSON.stringify(schema)}</script>
      </Helmet>

      {/* ─── 1. HERO ─── */}
      <section className="relative min-h-[70vh] flex items-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img src={creditcontrolHero} alt="" className="w-full h-full object-cover" aria-hidden="true" />
          <div className="absolute inset-0 bg-gradient-to-r from-foreground/95 via-foreground/90 to-foreground/75" />
        </div>
        <div className="container-wide relative z-10 py-20 md:py-32">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.21, 0.47, 0.32, 0.98] }}
            className="max-w-3xl"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 bg-accent/20 backdrop-blur-sm border border-accent/30 text-primary-foreground px-4 py-2 rounded-full mb-6"
            >
              <Shield className="h-4 w-4" />
              <span className="text-sm font-medium">
                Eerder betaald. Volledige zekerheid. 100% regie bij de ZZP'er.
              </span>
            </motion.div>
            <h1 className="text-primary-foreground mb-6 leading-tight">
              Jouw factuur. Jouw geld.{" "}
              <span className="text-accent">Jouw moment van uitbetaling.</span>
            </h1>
            <p className="text-lg md:text-xl text-primary-foreground/80 mb-10 max-w-2xl">
              ZP Zaken introduceert CreditControl: een veilige, transparante en eerlijke
              oplossing voor eerder betalen én volledige zekerheid rondom betaling.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                size="xl"
                variant="accent"
                asChild
                className="hover:scale-105 transition-transform duration-200"
                onClick={() => trackCTA("cc_ontdek")}
              >
                <a href="#hoe-het-werkt">
                  <Sparkles className="h-5 w-5" />
                  Ontdek hoe het werkt
                  <ArrowRight className="h-5 w-5" />
                </a>
              </Button>
              <Button
                size="xl"
                variant="heroOutline"
                asChild
                className="hover:scale-105 transition-transform duration-200"
                onClick={() => trackCTA("cc_toegang")}
              >
                <LocalizedLink to="/contact">
                  <Calendar className="h-5 w-5" />
                  Vraag direct toegang aan
                </LocalizedLink>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── 2. HET PROBLEEM ─── */}
      <section className="section-padding bg-secondary">
        <div className="container-wide">
          <AnimatedSection className="max-w-3xl mx-auto text-center mb-12">
            <span className="inline-flex items-center gap-2 text-primary font-semibold text-sm mb-4">
              <AlertTriangle className="h-4 w-4" />
              De praktijk
            </span>
            <h2 className="mb-4">
              Wat er <span className="text-primary">misgaat</span> in de markt
            </h2>
            <p className="text-muted-foreground text-lg">
              In de praktijk zien we al jaren een structureel probleem:
            </p>
          </AnimatedSection>

          <StaggerContainer className="max-w-3xl mx-auto space-y-3" staggerDelay={0.08}>
            {problems.map((problem, i) => (
              <StaggerItem key={i}>
                <div className="flex items-start gap-3 bg-card p-4 rounded-lg border border-border/50 shadow-sm">
                  <XCircle className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <p className="text-foreground">{problem}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>

          <AnimatedSection delay={0.5} className="max-w-3xl mx-auto mt-8">
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-6">
                <p className="font-semibold text-foreground mb-2">Gevolg:</p>
                <p className="text-muted-foreground">
                  De ondernemer die het werk uitvoert, loopt het risico. De partij die bemiddelt,
                  houdt de controle.{" "}
                  <span className="font-semibold text-primary">
                    Dat vinden wij fundamenteel onjuist.
                  </span>
                </p>
              </CardContent>
            </Card>
          </AnimatedSection>
        </div>
      </section>

      {/* ─── 3. ONZE OVERTUIGING ─── */}
      <section className="section-padding">
        <div className="container-wide">
          <AnimatedSection className="max-w-3xl mx-auto text-center mb-12">
            <h2 className="mb-4">
              Onze <span className="text-accent">overtuiging</span>
            </h2>
            <p className="text-muted-foreground text-lg">ZP Zaken gelooft in:</p>
          </AnimatedSection>

          <StaggerContainer className="grid grid-cols-2 md:grid-cols-5 gap-4 max-w-4xl mx-auto" staggerDelay={0.1}>
            {beliefs.map((b, i) => (
              <StaggerItem key={i}>
                <Card className="text-center card-hover h-full">
                  <CardContent className="p-6 flex flex-col items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center">
                      <b.icon className="h-6 w-6 text-accent" />
                    </div>
                    <p className="font-semibold text-sm">{b.text}</p>
                  </CardContent>
                </Card>
              </StaggerItem>
            ))}
          </StaggerContainer>

          <AnimatedSection delay={0.5} className="text-center mt-8">
            <p className="text-muted-foreground max-w-xl mx-auto">
              De ZZP'er hoort regie te hebben over zijn of haar facturen.{" "}
              <span className="font-semibold text-foreground">Niet een derde partij.</span>
            </p>
          </AnimatedSection>
        </div>
      </section>

      {/* ─── 4. DE OPLOSSING ─── */}
      <section id="hoe-het-werkt" className="section-padding bg-secondary scroll-mt-20">
        <div className="container-wide">
          <AnimatedSection className="max-w-3xl mx-auto text-center mb-12">
            <span className="inline-flex items-center gap-2 text-accent font-semibold text-sm mb-4">
              <Shield className="h-4 w-4" />
              De oplossing
            </span>
            <h2 className="mb-4">
              ZP Zaken <span className="text-accent">CreditControl</span>
            </h2>
            <p className="text-lg text-muted-foreground mb-2 font-medium">
              Factoring vóór en dóór ondernemers
            </p>
            <p className="text-muted-foreground">
              Met CreditControl bepaalt de ZZP'er zelf:
            </p>
          </AnimatedSection>

          <AnimatedSection delay={0.2} className="max-w-2xl mx-auto mb-8">
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                "Of een factuur wordt gefactord",
                "Wanneer deze wordt uitbetaald",
                "Tegen welke voorwaarden",
              ].map((item, i) => (
                <Card key={i} className="border-accent/20 bg-accent/5">
                  <CardContent className="p-5 text-center">
                    <CheckCircle2 className="h-6 w-6 text-accent mx-auto mb-2" />
                    <p className="font-medium text-sm">{item}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </AnimatedSection>

          <AnimatedSection delay={0.3} className="text-center">
            <Card className="max-w-xl mx-auto border-accent/30 bg-accent/10">
              <CardContent className="p-6">
                <Ban className="h-8 w-8 text-accent mx-auto mb-3" />
                <p className="font-semibold text-foreground">
                  Geen enkele derde partij kan jouw factuur meer gebruiken voor eigen financiering.
                </p>
              </CardContent>
            </Card>
          </AnimatedSection>
        </div>
      </section>

      {/* ─── 5. USP'S ─── */}
      <section className="section-padding">
        <div className="container-wide">
          <AnimatedSection className="text-center mb-12">
            <h2 className="mb-4">
              Onze unieke <span className="text-accent">structuur</span>
            </h2>
          </AnimatedSection>

          <div className="max-w-4xl mx-auto space-y-6">
            {usps.map((usp, i) => (
              <AnimatedSection key={i} delay={i * 0.1}>
                <Card className="card-hover overflow-hidden">
                  <CardContent className="p-6 md:p-8">
                    <div className="flex items-start gap-4">
                      <div className="h-12 w-12 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                        <usp.icon className="h-6 w-6 text-accent" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold mb-2">{usp.title}</h3>
                        <p className="text-muted-foreground mb-3">{usp.description}</p>
                        {usp.points.length > 0 && (
                          <ul className="space-y-1.5">
                            {usp.points.map((p, j) => (
                              <li key={j} className="flex items-center gap-2 text-sm text-foreground">
                                <CheckCircle2 className="h-4 w-4 text-accent shrink-0" />
                                {p}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 6. CASUSSEN ─── */}
      <section className="section-padding bg-secondary">
        <div className="container-wide">
          <AnimatedSection className="max-w-3xl mx-auto text-center mb-12">
            <span className="inline-flex items-center gap-2 text-primary font-semibold text-sm mb-4">
              <AlertTriangle className="h-4 w-4" />
              Uit de praktijk
            </span>
            <h2 className="mb-4">
              Problematische <span className="text-primary">casussen</span>
            </h2>
            <p className="text-muted-foreground">
              Zonder namen te noemen zien we structureel terugkerende patronen:
            </p>
          </AnimatedSection>

          <StaggerContainer className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto" staggerDelay={0.15}>
            {cases.map((c, i) => (
              <StaggerItem key={i}>
                <Card className="h-full border-primary/10">
                  <CardContent className="p-6">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                      <span className="text-primary font-bold text-sm">#{i + 1}</span>
                    </div>
                    <h3 className="font-bold mb-3">{c.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">{c.text}</p>
                  </CardContent>
                </Card>
              </StaggerItem>
            ))}
          </StaggerContainer>

          <AnimatedSection delay={0.5} className="max-w-3xl mx-auto mt-8">
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-6 text-center">
                <p className="text-muted-foreground mb-2">
                  Het systeem is gebouwd rondom financiering van tussenpartijen. Niet rondom
                  zekerheid van de ondernemer.
                </p>
                <p className="font-bold text-primary">ZP Zaken doorbreekt dit model.</p>
              </CardContent>
            </Card>
          </AnimatedSection>
        </div>
      </section>

      {/* ─── 7. WAT DIT BETEKENT ─── */}
      <section className="section-padding">
        <div className="container-wide">
          <AnimatedSection className="max-w-3xl mx-auto text-center mb-12">
            <h2 className="mb-4">
              Wat dit concreet voor <span className="text-accent">jou</span> betekent
            </h2>
          </AnimatedSection>

          <StaggerContainer className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto" staggerDelay={0.08}>
            {benefits.map((b, i) => (
              <StaggerItem key={i}>
                <div className="flex items-center gap-3 bg-card p-4 rounded-lg border border-border/50 shadow-sm">
                  <CheckCircle2 className="h-5 w-5 text-accent shrink-0" />
                  <span className="font-medium text-sm">{b}</span>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* ─── 8. VOOR WIE ─── */}
      <section className="section-padding bg-secondary">
        <div className="container-wide">
          <AnimatedSection className="max-w-3xl mx-auto text-center mb-12">
            <h2 className="mb-4">
              Voor wie is <span className="text-accent">CreditControl</span>?
            </h2>
          </AnimatedSection>

          <StaggerContainer className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 max-w-5xl mx-auto" staggerDelay={0.1}>
            {targetAudience.map((t, i) => (
              <StaggerItem key={i}>
                <Card className="text-center card-hover h-full">
                  <CardContent className="p-5 flex flex-col items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-accent/10 flex items-center justify-center">
                      <t.icon className="h-5 w-5 text-accent" />
                    </div>
                    <p className="font-medium text-sm">{t.text}</p>
                  </CardContent>
                </Card>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* ─── 9. WAAROM ZP ZAKEN ─── */}
      <section className="section-padding">
        <div className="container-wide">
          <div className="max-w-3xl mx-auto">
            <AnimatedSection className="text-center mb-10">
              <h2 className="mb-4">
                Waarom <span className="text-primary">ZP Zaken</span>?
              </h2>
              <p className="text-muted-foreground text-lg">
                ZP Zaken bouwt dagelijks aan een eerlijk ecosysteem voor ZZP'ers in Nederland en
                internationaal.
              </p>
            </AnimatedSection>

            <StaggerContainer className="grid sm:grid-cols-2 gap-4" staggerDelay={0.1}>
              {[
                "Transparantie voorop stelt",
                "De ondernemer centraal zet",
                "Oneerlijke constructies doorbreekt",
                "Een echte game changer wil zijn",
              ].map((item, i) => (
                <StaggerItem key={i}>
                  <div className="flex items-center gap-3 bg-card p-4 rounded-lg border border-border/50 shadow-sm">
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                    <span className="font-medium text-sm">{item}</span>
                  </div>
                </StaggerItem>
              ))}
            </StaggerContainer>

            <AnimatedSection delay={0.4} className="text-center mt-8">
              <p className="text-muted-foreground font-medium">
                CreditControl is daarin een volgende stap.
              </p>
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* ─── 10. KERNBELOFTE ─── */}
      <section className="section-padding bg-foreground text-primary-foreground">
        <div className="container-wide">
          <AnimatedSection className="max-w-2xl mx-auto text-center">
            <div className="flex justify-center gap-4 mb-8">
              <div className="h-14 w-14 rounded-full bg-accent/20 flex items-center justify-center">
                <Shield className="h-7 w-7 text-accent" />
              </div>
              <div className="h-14 w-14 rounded-full bg-accent/20 flex items-center justify-center">
                <Eye className="h-7 w-7 text-accent" />
              </div>
              <div className="h-14 w-14 rounded-full bg-accent/20 flex items-center justify-center">
                <Users className="h-7 w-7 text-accent" />
              </div>
            </div>
            <h2 className="mb-6 text-primary-foreground">
              Veiligheid. Transparantie. Regie.
            </h2>
            <p className="text-primary-foreground/60 text-lg leading-relaxed">
              Niet de broker.<br />
              Niet de factor.<br />
              Niet de tussenpartij.<br />
              <span className="text-accent font-bold text-xl mt-2 inline-block">Maar jij.</span>
            </p>
          </AnimatedSection>
        </div>
      </section>

      {/* ─── 11. FINAL CTA ─── */}
      <section className="relative section-padding overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img src={teamBoyCalling} alt="" className="w-full h-full object-cover" aria-hidden="true" />
          <div className="absolute inset-0 bg-gradient-to-r from-primary/95 via-primary/90 to-primary/85" />
        </div>
        <div className="container-wide relative z-10">
          <AnimatedSection className="max-w-2xl mx-auto text-center text-primary-foreground">
            <h2 className="mb-4 text-primary-foreground">
              Wil jij eerder betaald worden zonder risico?
            </h2>
            <p className="text-primary-foreground/85 text-lg mb-8">
              Wil jij zeker weten dat jouw geld altijd veilig staat?
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button
                size="xl"
                className="bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg hover:scale-105 transition-transform duration-200"
                asChild
                onClick={() => trackCTA("cc_cta_toegang")}
              >
                <LocalizedLink to="/contact">
                  <Shield className="h-5 w-5" />
                  Vraag toegang tot CreditControl
                  <ArrowRight className="h-5 w-5" />
                </LocalizedLink>
              </Button>
              <Button
                size="xl"
                variant="heroOutline"
                asChild
                className="hover:scale-105 transition-transform duration-200"
                onClick={() => trackCTA("cc_cta_gesprek")}
              >
                <LocalizedLink to="/contact">
                  <Calendar className="h-5 w-5" />
                  Plan een gesprek
                </LocalizedLink>
              </Button>
            </div>
          </AnimatedSection>
        </div>
      </section>
    </Layout>
  );
}

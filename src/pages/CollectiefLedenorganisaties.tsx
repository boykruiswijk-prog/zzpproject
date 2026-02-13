import { useState, useRef } from "react";
import { Helmet } from "react-helmet-async";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { motion, useScroll, useTransform, useInView } from "framer-motion";
import {
  Shield, Users, Handshake, Network, CheckCircle, Settings,
  HeadphonesIcon, ArrowRight, ArrowDown, Phone, Clock, BadgeCheck,
  Scale, Lock, Heart, BarChart3, Search, Briefcase, Building2,
  Banknote, Zap, TrendingUp, UserCheck, Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";
import teamHero from "@/assets/team-hero.jpg";

/* ─── Validation ─── */
const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const isValidPhone = (phone: string) => /^[0-9]{10}$/.test(phone.replace(/[\s\-]/g, ""));
type FormErrors = Record<string, string>;
function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-sm text-destructive mt-1">{msg}</p>;
}

/* ─── Animated Counter ─── */
function AnimatedCounter({ value, suffix = "", prefix = "" }: { value: number; suffix?: string; prefix?: string }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  return (
    <motion.span
      ref={ref}
      initial={{ opacity: 0 }}
      animate={isInView ? { opacity: 1 } : {}}
    >
      {isInView && (
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {prefix}
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            {value}
          </motion.span>
          {suffix}
        </motion.span>
      )}
    </motion.span>
  );
}

/* ─── Floating Particle ─── */
function FloatingParticle({ delay, x, y, size }: { delay: number; x: string; y: string; size: number }) {
  return (
    <motion.div
      className="absolute rounded-full pointer-events-none"
      style={{ left: x, top: y, width: size, height: size, background: "hsl(213 60% 60% / 0.15)" }}
      animate={{ y: [0, -20, 0], opacity: [0.3, 0.7, 0.3] }}
      transition={{ duration: 4, delay, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

/* ─── Data ─── */
const doelgroepen = [
  { icon: Users, title: "Brancheverenigingen", desc: "Collectief voordeel als concreet ledenvoordeel.", color: "hsl(213 60% 45%)" },
  { icon: Shield, title: "Beroepsorganisaties", desc: "Professionele zekerheid voor iedere aangesloten professional.", color: "hsl(250 60% 55%)" },
  { icon: Network, title: "Netwerken voor zzp'ers", desc: "Versterk je netwerk met meetbaar financieel voordeel.", color: "hsl(180 60% 40%)" },
  { icon: Handshake, title: "Franchise- & ondernemersverenigingen", desc: "Lagere premies voor alle aangesloten ondernemers.", color: "hsl(340 60% 50%)" },
  { icon: Briefcase, title: "Intermediairs & dienstverleners", desc: "Bied je klanten verzekeringen aan met collectieve tarieven.", color: "hsl(30 70% 50%)" },
  { icon: Building2, title: "Detacheerders", desc: "Zorg dat je gedetacheerden goed en voordelig verzekerd zijn.", color: "hsl(160 50% 40%)" },
];

const usps = [
  { icon: Shield, title: "Collectieve korting op BAV", desc: "Directe premiekorting voor jouw leden — tot 25% voordeliger dan individuele tarieven.", nr: "01" },
  { icon: CheckCircle, title: "Onafhankelijk en transparant", desc: "Geen verplichte bundels. Eerlijk advies, altijd in het belang van jouw leden.", nr: "02" },
  { icon: HeadphonesIcon, title: "Persoonlijke ondersteuning", desc: "Elke lid krijgt een vaste adviseur — geen callcenters, altijd een mens aan de lijn.", nr: "03" },
  { icon: Settings, title: "Volledige ontzorging", desc: "Van communicatie tot onboarding: wij nemen het werk uit handen.", nr: "04" },
];

const extraProducts = [
  { icon: Handshake, name: "Bedrijfsaansprakelijkheid (AVB)" },
  { icon: Scale, name: "Rechtsbijstand zakelijk" },
  { icon: Lock, name: "Cyberverzekering" },
  { icon: Heart, name: "Arbeidsongeschiktheidsverzekering" },
  { icon: BarChart3, name: "Pensioenoplossingen" },
  { icon: Search, name: "Zakelijke verzekeringsscan" },
];

const factoringVoordelen = [
  { icon: Zap, title: "Binnen 24 uur betaald", desc: "Leden ontvangen hun factuurbedrag binnen één werkdag." },
  { icon: TrendingUp, title: "Stabiele cashflow", desc: "Voorspelbaar inkomen maakt ondernemen eenvoudiger." },
  { icon: UserCheck, title: "Debiteurenbeheer inbegrepen", desc: "Wij nemen het debiteurenbeheer over, inclusief insolventiedekking." },
  { icon: Banknote, title: "Exclusief collectief tarief", desc: "Leden profiteren van lagere kosten dankzij collectief volume." },
];

const stappen = [
  { nr: 1, title: "Kennismaking", desc: "We leren jouw organisatie kennen, bespreken de behoeften van je leden en verkennen de mogelijkheden.", emoji: "🤝" },
  { nr: 2, title: "Voorstel op maat", desc: "Een collectief voorstel met concrete kortingen en diensten, afgestemd op jouw achterban.", emoji: "📋" },
  { nr: 3, title: "Implementatie", desc: "Wij verzorgen alle communicatie richting leden, onboarding en bieden doorlopende persoonlijke support.", emoji: "🚀" },
];

const faqs = [
  { q: "Is er een minimum aantal leden?", a: "Nee, er is geen strikt minimum. We kijken samen naar de beste aanpak, ongeacht de grootte van je organisatie." },
  { q: "Zit er exclusiviteit aan vast?", a: "Nee, er zijn geen exclusiviteitsverplichtingen. Je leden zijn altijd vrij om hun eigen keuzes te maken." },
  { q: "Hoe snel kan het starten?", a: "Na de kennismaking en akkoord op het voorstel kan de implementatie binnen 2 weken starten." },
  { q: "Wat kost de samenwerking voor onze organisatie?", a: "Niets. De samenwerking is kosteloos voor jouw organisatie. Wij worden vergoed door de verzekeraars." },
  { q: "Kunnen leden ook factoring afnemen?", a: "Ja, leden krijgen toegang tot onze factoring-oplossing met een exclusief collectief tarief: binnen 24 uur betaald." },
];

/* ─── Page Component ─── */
export default function CollectiefLedenorganisaties() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    organisatienaam: "", aantalLeden: "", branche: "",
    contactpersoon: "", telefoon: "", email: "", opmerking: "",
  });

  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => { const n = { ...prev }; delete n[name]; return n; });
  };

  const validate = (): boolean => {
    const errs: FormErrors = {};
    if (!formData.organisatienaam.trim()) errs.organisatienaam = "Verplicht";
    if (!formData.aantalLeden.trim()) errs.aantalLeden = "Verplicht";
    if (!formData.branche.trim()) errs.branche = "Verplicht";
    if (!formData.contactpersoon.trim()) errs.contactpersoon = "Verplicht";
    if (!formData.telefoon.trim()) errs.telefoon = "Verplicht";
    else if (!isValidPhone(formData.telefoon)) errs.telefoon = "Telefoonnummer moet 10 cijfers zijn";
    if (!formData.email.trim()) errs.email = "Verplicht";
    else if (!isValidEmail(formData.email)) errs.email = "Ongeldig e-mailadres";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("leads").insert({
        type: "contact" as const,
        voornaam: formData.contactpersoon.split(" ")[0] || formData.contactpersoon,
        achternaam: formData.contactpersoon.split(" ").slice(1).join(" ") || "-",
        email: formData.email,
        telefoon: formData.telefoon,
        bedrijfsnaam: formData.organisatienaam,
        beroep: formData.branche,
        opmerkingen: `Aantal leden: ${formData.aantalLeden}. ${formData.opmerking}`,
        bron: "website" as const,
      });
      if (error) throw error;
      toast({ title: "Aanvraag verzonden!", description: "We nemen binnen 24 uur contact met je op." });
      setFormData({ organisatienaam: "", aantalLeden: "", branche: "", contactpersoon: "", telefoon: "", email: "", opmerking: "" });
    } catch {
      toast({ title: "Er ging iets mis", description: "Probeer het later opnieuw.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const scrollToForm = () => document.getElementById("collectief-form")?.scrollIntoView({ behavior: "smooth" });
  const scrollToContent = () => document.getElementById("voor-wie")?.scrollIntoView({ behavior: "smooth" });

  return (
    <Layout>
      <Helmet>
        <title>Collectieve BAV en verzekeringen voor ledenorganisaties | ZP Zaken</title>
        <meta name="description" content="Bied jouw leden collectieve korting op BAV, verzekeringen en factoring. Ontzorgd geregeld via zpzaken.nl. Vraag een voorstel aan." />
        <link rel="canonical" href="https://zzpproject.lovable.app/collectief-ledenorganisaties" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqs.map(f => ({
            "@type": "Question", name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        })}</script>
      </Helmet>

      {/* ════════════════ 1. IMMERSIVE HERO ════════════════ */}
      <section ref={heroRef} className="relative min-h-screen flex items-center overflow-hidden">
        {/* Parallax background */}
        <motion.div className="absolute inset-0" style={{ y: heroY }}>
          <img src={teamHero} alt="" className="w-full h-full object-cover scale-110" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/80" />
        </motion.div>

        {/* Floating particles */}
        <FloatingParticle delay={0} x="10%" y="20%" size={8} />
        <FloatingParticle delay={1} x="80%" y="30%" size={6} />
        <FloatingParticle delay={2} x="60%" y="70%" size={10} />
        <FloatingParticle delay={0.5} x="25%" y="60%" size={5} />
        <FloatingParticle delay={1.5} x="90%" y="80%" size={7} />

        {/* Gradient mesh overlay */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: "radial-gradient(ellipse at 20% 50%, hsl(213 80% 40% / 0.3) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, hsl(250 60% 50% / 0.15) 0%, transparent 50%)"
        }} />

        <motion.div style={{ opacity: heroOpacity }} className="container-wide relative z-10 py-20">
          <div className="max-w-4xl">
            {/* Animated badge */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <span className="inline-flex items-center gap-2 text-xs font-bold tracking-[0.2em] uppercase px-5 py-2.5 rounded-full border border-white/20 backdrop-blur-md"
                style={{ background: "hsl(213 60% 45% / 0.2)", color: "hsl(213 60% 85%)" }}>
                <Sparkles className="h-3.5 w-3.5" />
                Voor organisaties & hun leden
              </span>
            </motion.div>

            {/* Big headline with staggered reveal */}
            <motion.h1
              className="mt-8 text-4xl md:text-5xl lg:text-7xl font-black text-white leading-[1.05] tracking-tight"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              Collectieve korting
              <br />
              <span className="bg-clip-text text-transparent" style={{
                backgroundImage: "linear-gradient(135deg, hsl(213 70% 65%), hsl(250 60% 70%), hsl(213 70% 55%))"
              }}>
                op verzekeringen
              </span>
              <br />
              <span className="text-white/60 text-3xl md:text-4xl lg:text-5xl font-medium">
                én eerder betaald worden
              </span>
            </motion.h1>

            <motion.p
              className="mt-8 text-lg md:text-xl text-white/60 max-w-2xl leading-relaxed"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.8 }}
            >
              Bied jouw leden direct financieel voordeel: lagere premies op zakelijke verzekeringen én snellere betaling van facturen. Persoonlijk, transparant en zonder extra werkdruk.
            </motion.p>

            {/* Animated USP pills */}
            <motion.div
              className="mt-8 flex flex-wrap gap-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2 }}
            >
              {["Collectieve korting op BAV", "Binnen 24 uur betaald", "Persoonlijke adviseur", "Volledig ontzorgd"].map((item, i) => (
                <motion.span
                  key={item}
                  className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-full border border-white/10 backdrop-blur-sm text-white/80"
                  style={{ background: "hsl(0 0% 100% / 0.06)" }}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.3 + i * 0.15, duration: 0.5 }}
                  whileHover={{ scale: 1.05, background: "hsl(0 0% 100% / 0.12)" }}
                >
                  <CheckCircle className="h-3.5 w-3.5" style={{ color: "hsl(142 60% 55%)" }} />
                  {item}
                </motion.span>
              ))}
            </motion.div>

            {/* CTAs */}
            <motion.div
              className="mt-10 flex flex-wrap gap-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.8, duration: 0.6 }}
            >
              <Button size="lg" onClick={scrollToForm}
                className="text-white font-bold text-base px-8 py-6 rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105"
                style={{ background: "linear-gradient(135deg, hsl(213 60% 45%), hsl(250 50% 50%))" }}>
                Plan een kennismaking <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
              <Button size="lg" onClick={scrollToForm}
                className="font-bold text-base px-8 py-6 rounded-xl backdrop-blur-md border-white/20 text-white hover:bg-white/20 transition-all"
                variant="outline">
                Vraag een collectief voorstel aan
              </Button>
            </motion.div>
          </div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.button
          onClick={scrollToContent}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2 text-white/40 hover:text-white/70 transition-colors"
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <span className="text-xs tracking-widest uppercase">Ontdek meer</span>
          <ArrowDown className="h-5 w-5" />
        </motion.button>
      </section>

      {/* ════════════════ 2. VOOR WIE — Bento Grid ════════════════ */}
      <section id="voor-wie" className="py-24 md:py-32 relative overflow-hidden" style={{ background: "hsl(220 20% 98%)" }}>
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: "linear-gradient(hsl(213 60% 30%) 1px, transparent 1px), linear-gradient(90deg, hsl(213 60% 30%) 1px, transparent 1px)",
          backgroundSize: "60px 60px"
        }} />

        <div className="container-wide max-w-6xl relative">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
          >
            <span className="inline-block text-xs font-bold tracking-[0.25em] uppercase mb-4 px-4 py-2 rounded-full"
              style={{ background: "hsl(213 60% 45% / 0.08)", color: "hsl(213 60% 40%)" }}>
              Voor wie
            </span>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-foreground leading-tight">
              Voor organisaties die hun leden
              <br />
              <span className="bg-clip-text text-transparent" style={{
                backgroundImage: "linear-gradient(135deg, hsl(213 60% 45%), hsl(250 50% 55%))"
              }}>écht voordeel</span> willen bieden
            </h2>
          </motion.div>

          {/* Bento grid */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {doelgroepen.map((d, i) => (
              <motion.div
                key={d.title}
                className={cn(
                  "group relative rounded-3xl p-6 md:p-8 cursor-default overflow-hidden",
                  i === 0 && "lg:col-span-2 lg:row-span-1"
                )}
                style={{ background: "white" }}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.6, delay: i * 0.1 }}
                whileHover={{ y: -4 }}
              >
                {/* Accent gradient on hover */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-3xl"
                  style={{ background: `linear-gradient(135deg, ${d.color}08, ${d.color}15)` }} />

                <div className="relative z-10">
                  <motion.div
                    className="w-14 h-14 rounded-2xl mb-5 flex items-center justify-center"
                    style={{ background: `${d.color}12` }}
                    whileHover={{ rotate: [0, -5, 5, 0], scale: 1.1 }}
                    transition={{ duration: 0.4 }}
                  >
                    <d.icon className="h-7 w-7" style={{ color: d.color }} />
                  </motion.div>
                  <h3 className="font-bold text-foreground text-lg mb-2">{d.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{d.desc}</p>
                </div>

                {/* Border effect */}
                <div className="absolute inset-0 rounded-3xl border border-black/5 group-hover:border-black/10 transition-colors" />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════ 3. WAAROM ZPZAKEN — Editorial ════════════════ */}
      <section className="py-24 md:py-32 relative overflow-hidden" style={{ background: "hsl(213 35% 12%)" }}>
        {/* Ambient glow */}
        <div className="absolute top-0 right-0 w-1/2 h-1/2 pointer-events-none" style={{
          background: "radial-gradient(ellipse, hsl(213 60% 40% / 0.15) 0%, transparent 70%)"
        }} />

        <div className="container-wide max-w-6xl relative">
          <motion.div
            className="mb-20"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
          >
            <span className="text-xs font-bold tracking-[0.25em] uppercase mb-4 block" style={{ color: "hsl(213 60% 65%)" }}>
              Waarom ZP Zaken
            </span>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-white leading-tight max-w-3xl">
              Geen beloftes,
              <br />
              <span className="bg-clip-text text-transparent" style={{
                backgroundImage: "linear-gradient(135deg, hsl(213 60% 65%), hsl(250 50% 70%))"
              }}>meetbaar voordeel</span>
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6">
            {usps.map((u, i) => (
              <motion.div
                key={u.title}
                className="group relative p-8 md:p-10 rounded-3xl border border-white/5 hover:border-white/15 transition-all duration-500 cursor-default overflow-hidden"
                style={{ background: "hsl(213 30% 16%)" }}
                initial={{ opacity: 0, x: i % 2 === 0 ? -30 : 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.7, delay: i * 0.15 }}
                whileHover={{ scale: 1.02 }}
              >
                <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700" style={{
                  background: "radial-gradient(ellipse at top right, hsl(213 60% 50% / 0.1), transparent 70%)",
                  width: "200px", height: "200px"
                }} />

                <div className="relative z-10 flex gap-6">
                  <span className="text-5xl font-black leading-none" style={{ color: "hsl(213 60% 50% / 0.15)" }}>{u.nr}</span>
                  <div>
                    <div className="w-12 h-12 rounded-xl mb-4 flex items-center justify-center" style={{ background: "hsl(213 60% 50% / 0.12)" }}>
                      <u.icon className="h-6 w-6" style={{ color: "hsl(213 60% 65%)" }} />
                    </div>
                    <h3 className="font-bold text-white text-xl mb-3">{u.title}</h3>
                    <p className="text-white/50 leading-relaxed">{u.desc}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════ 4. FACTORING — Split Feature ════════════════ */}
      <section className="py-24 md:py-32 relative overflow-hidden" style={{ background: "hsl(220 20% 98%)" }}>
        <div className="container-wide max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8 }}
            >
              <motion.span
                className="inline-flex items-center gap-2 text-xs font-bold tracking-[0.2em] uppercase mb-6 px-4 py-2 rounded-full"
                style={{ background: "hsl(142 50% 45% / 0.1)", color: "hsl(142 50% 35%)" }}
                whileHover={{ scale: 1.05 }}
              >
                <Zap className="h-3.5 w-3.5" />
                Exclusief voor leden
              </motion.span>
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-foreground leading-tight mb-6">
                Leden worden
                <br />
                <span className="bg-clip-text text-transparent" style={{
                  backgroundImage: "linear-gradient(135deg, hsl(213 60% 45%), hsl(142 50% 40%))"
                }}>binnen 24 uur</span>
                <br />
                betaald
              </h2>
              <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                Naast collectieve korting op verzekeringen bieden wij leden ook onze eigen factoring-oplossing aan. Geen weken wachten op betaling — leden ontvangen hun factuurbedrag dezelfde dag. Inclusief debiteurenbeheer en insolventiedekking.
              </p>
              <Button onClick={scrollToForm} size="lg"
                className="text-white font-bold rounded-xl px-8 py-6 shadow-lg hover:shadow-xl transition-all hover:scale-105"
                style={{ background: "linear-gradient(135deg, hsl(213 60% 45%), hsl(250 50% 50%))" }}>
                Vraag een voorstel aan <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
            </motion.div>

            <div className="grid grid-cols-2 gap-4">
              {factoringVoordelen.map((v, i) => (
                <motion.div
                  key={v.title}
                  className="group bg-white rounded-3xl p-6 border border-black/5 hover:border-black/10 transition-all cursor-default"
                  initial={{ opacity: 0, y: 30, rotate: i % 2 === 0 ? -2 : 2 }}
                  whileInView={{ opacity: 1, y: 0, rotate: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.6, delay: i * 0.15 }}
                  whileHover={{ y: -6, scale: 1.03 }}
                >
                  <motion.div
                    className="w-12 h-12 rounded-xl mb-4 flex items-center justify-center"
                    style={{ background: "hsl(213 60% 45% / 0.08)" }}
                    whileHover={{ rotate: 10, scale: 1.1 }}
                  >
                    <v.icon className="h-6 w-6" style={{ color: "hsl(213 60% 45%)" }} />
                  </motion.div>
                  <h3 className="font-bold text-foreground mb-2">{v.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{v.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════ 5. PRODUCTEN — Scroll Reveal ════════════════ */}
      <section className="py-24 md:py-32 bg-white relative">
        <div className="container-wide max-w-5xl">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
          >
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-foreground">
              Meer dan alleen{" "}
              <span className="bg-clip-text text-transparent" style={{
                backgroundImage: "linear-gradient(135deg, hsl(213 60% 45%), hsl(250 50% 55%))"
              }}>BAV</span>
            </h2>
            <p className="text-muted-foreground mt-4 max-w-xl mx-auto text-lg">
              BAV is ons kernproduct, maar we bieden leden een compleet pakket aan zakelijke zekerheid.
            </p>
          </motion.div>

          {/* Featured BAV */}
          <motion.div
            className="mb-12 rounded-3xl p-8 md:p-10 flex flex-col md:flex-row items-center gap-8 relative overflow-hidden"
            style={{ background: "linear-gradient(135deg, hsl(213 50% 15%), hsl(213 40% 20%))" }}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <div className="absolute inset-0 pointer-events-none" style={{
              background: "radial-gradient(ellipse at bottom right, hsl(213 60% 50% / 0.2), transparent 60%)"
            }} />
            <motion.div
              className="w-20 h-20 rounded-2xl flex items-center justify-center flex-shrink-0 relative z-10"
              style={{ background: "linear-gradient(135deg, hsl(213 60% 45%), hsl(250 50% 50%))" }}
              whileHover={{ rotate: [0, -10, 10, 0] }}
              transition={{ duration: 0.5 }}
            >
              <Shield className="h-10 w-10 text-white" />
            </motion.div>
            <div className="flex-1 text-center md:text-left relative z-10">
              <h3 className="text-2xl font-black text-white mb-3">BAV + AVB Combinatiepolis</h3>
              <p className="text-white/60 text-lg">De enige gecombineerde beroeps- en bedrijfsaansprakelijkheidsverzekering in Nederland — met exclusieve collectieve korting.</p>
            </div>
            <Button onClick={scrollToForm}
              className="text-white flex-shrink-0 font-bold rounded-xl px-6 py-5 relative z-10 border border-white/20 hover:bg-white/10 transition-all"
              variant="ghost">
              Collectief voorstel <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </motion.div>

          {/* Extra products — pill style */}
          <div className="flex flex-wrap justify-center gap-3">
            {extraProducts.map((p, i) => (
              <motion.div
                key={p.name}
                className="inline-flex items-center gap-3 bg-white rounded-full border border-black/5 px-5 py-3 hover:shadow-md hover:border-black/10 transition-all cursor-default"
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.4 }}
                whileHover={{ scale: 1.05 }}
              >
                <p.icon className="h-4 w-4" style={{ color: "hsl(213 60% 45%)" }} />
                <span className="text-sm font-medium text-foreground">{p.name}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════ 6. HOE WERKT HET — Interactive Steps ════════════════ */}
      <section className="py-24 md:py-32 relative overflow-hidden" style={{ background: "hsl(213 35% 12%)" }}>
        <div className="absolute inset-0 pointer-events-none" style={{
          background: "radial-gradient(ellipse at center, hsl(213 60% 30% / 0.15) 0%, transparent 60%)"
        }} />

        <div className="container-wide max-w-4xl relative">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-white">
              In{" "}
              <span className="bg-clip-text text-transparent" style={{
                backgroundImage: "linear-gradient(135deg, hsl(213 60% 65%), hsl(250 50% 70%))"
              }}>3 stappen</span>
              {" "}van start
            </h2>
          </motion.div>

          <div className="space-y-6">
            {stappen.map((s, i) => (
              <motion.div
                key={s.nr}
                className={cn(
                  "rounded-3xl p-8 md:p-10 border cursor-pointer transition-all duration-500",
                  activeStep === i
                    ? "border-white/20 bg-white/5"
                    : "border-white/5 bg-white/[0.02] hover:border-white/10"
                )}
                initial={{ opacity: 0, x: i % 2 === 0 ? -30 : 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.2 }}
                onClick={() => setActiveStep(activeStep === i ? null : i)}
                whileHover={{ scale: 1.01 }}
              >
                <div className="flex items-start gap-6">
                  <span className="text-5xl">{s.emoji}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-4 mb-2">
                      <span className="text-xs font-bold tracking-[0.2em] uppercase" style={{ color: "hsl(213 60% 65%)" }}>
                        Stap {s.nr}
                      </span>
                    </div>
                    <h3 className="text-xl md:text-2xl font-bold text-white mb-2">{s.title}</h3>
                    <motion.div
                      initial={false}
                      animate={{ height: activeStep === i ? "auto" : 0, opacity: activeStep === i ? 1 : 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <p className="text-white/50 leading-relaxed pt-2">{s.desc}</p>
                    </motion.div>
                    {activeStep !== i && (
                      <p className="text-white/30 text-sm mt-1">Klik om te lezen</p>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════ 7. FORMULIER — Glass Morphism ════════════════ */}
      <section id="collectief-form" className="py-24 md:py-32 relative overflow-hidden" style={{
        background: "linear-gradient(135deg, hsl(213 40% 15%) 0%, hsl(250 30% 18%) 100%)"
      }}>
        {/* Background effects */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: "radial-gradient(ellipse at 30% 50%, hsl(213 60% 40% / 0.2) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, hsl(250 50% 50% / 0.1) 0%, transparent 40%)"
        }} />

        <div className="container-wide max-w-5xl relative">
          <div className="grid lg:grid-cols-2 gap-12 items-start">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-white leading-tight mb-6">
                Ontdek wat wij voor jouw leden
                <br />
                <span className="bg-clip-text text-transparent" style={{
                  backgroundImage: "linear-gradient(135deg, hsl(213 60% 65%), hsl(250 50% 70%))"
                }}>kunnen betekenen</span>
              </h2>
              <p className="text-white/50 mb-10 text-lg leading-relaxed">
                Plan vrijblijvend een kennismaking. Wij komen graag langs of bellen om de mogelijkheden te bespreken — persoonlijk en zonder verplichtingen.
              </p>
              <div className="space-y-5">
                {[
                  { icon: Clock, text: "Binnen 24 uur reactie" },
                  { icon: BadgeCheck, text: "AFM geregistreerd (12050636)" },
                  { icon: Phone, text: "Persoonlijk contact: 023 - 201 0502" },
                  { icon: CheckCircle, text: "Kosteloos voor jouw organisatie" },
                ].map((t, i) => (
                  <motion.div
                    key={t.text}
                    className="flex items-center gap-4 text-white/80"
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.15 }}
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "hsl(213 60% 50% / 0.15)" }}>
                      <t.icon className="h-5 w-5" style={{ color: "hsl(213 60% 65%)" }} />
                    </div>
                    <span className="font-medium">{t.text}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <form onSubmit={handleSubmit} className="rounded-3xl p-6 md:p-8 space-y-4 border border-white/10 backdrop-blur-xl shadow-2xl"
                style={{ background: "hsl(0 0% 100% / 0.06)" }}>
                <h3 className="text-xl font-bold text-white mb-4">Ontvang collectief voorstel</h3>
                <div>
                  <Label htmlFor="organisatienaam" className="text-white/70">Organisatienaam *</Label>
                  <Input id="organisatienaam" name="organisatienaam" value={formData.organisatienaam} onChange={handleChange}
                    className={cn("bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-white/30 rounded-xl", errors.organisatienaam && "border-destructive")} />
                  <FieldError msg={errors.organisatienaam} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="aantalLeden" className="text-white/70">Aantal leden *</Label>
                    <Input id="aantalLeden" name="aantalLeden" type="number" min="1" value={formData.aantalLeden} onChange={handleChange}
                      className={cn("bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-white/30 rounded-xl", errors.aantalLeden && "border-destructive")} />
                    <FieldError msg={errors.aantalLeden} />
                  </div>
                  <div>
                    <Label htmlFor="branche" className="text-white/70">Branche *</Label>
                    <Input id="branche" name="branche" value={formData.branche} onChange={handleChange}
                      className={cn("bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-white/30 rounded-xl", errors.branche && "border-destructive")} />
                    <FieldError msg={errors.branche} />
                  </div>
                </div>
                <div>
                  <Label htmlFor="contactpersoon" className="text-white/70">Contactpersoon *</Label>
                  <Input id="contactpersoon" name="contactpersoon" value={formData.contactpersoon} onChange={handleChange}
                    className={cn("bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-white/30 rounded-xl", errors.contactpersoon && "border-destructive")} />
                  <FieldError msg={errors.contactpersoon} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="telefoon" className="text-white/70">Telefoonnummer *</Label>
                    <Input id="telefoon" name="telefoon" type="tel" value={formData.telefoon} onChange={handleChange} placeholder="0612345678"
                      className={cn("bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-white/30 rounded-xl", errors.telefoon && "border-destructive")} />
                    <FieldError msg={errors.telefoon} />
                  </div>
                  <div>
                    <Label htmlFor="email" className="text-white/70">E-mail *</Label>
                    <Input id="email" name="email" type="email" value={formData.email} onChange={handleChange} placeholder="info@organisatie.nl"
                      className={cn("bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-white/30 rounded-xl", errors.email && "border-destructive")} />
                    <FieldError msg={errors.email} />
                  </div>
                </div>
                <div>
                  <Label htmlFor="opmerking" className="text-white/70">Opmerking (optioneel)</Label>
                  <Textarea id="opmerking" name="opmerking" value={formData.opmerking} onChange={handleChange} rows={3}
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-white/30 rounded-xl" />
                </div>
                <Button type="submit" size="lg" disabled={isSubmitting}
                  className="w-full text-white font-bold rounded-xl py-6 shadow-lg hover:shadow-xl transition-all"
                  style={{ background: "linear-gradient(135deg, hsl(213 60% 45%), hsl(250 50% 50%))" }}>
                  {isSubmitting ? "Verzenden..." : "Ontvang collectief voorstel"}
                  <ArrowRight className="h-5 w-5 ml-2" />
                </Button>
              </form>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ════════════════ 8. FAQ — Minimal ════════════════ */}
      <section className="py-24 md:py-32 bg-white">
        <div className="container-wide max-w-3xl">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-black text-foreground">Veelgestelde vragen</h2>
          </motion.div>
          <Accordion type="single" collapsible className="space-y-3">
            {faqs.map((faq, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
              >
                <AccordionItem value={`faq-${i}`} className="rounded-2xl border border-black/5 px-6 hover:border-black/10 transition-colors">
                  <AccordionTrigger className="text-foreground font-semibold hover:no-underline text-left">{faq.q}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground leading-relaxed">{faq.a}</AccordionContent>
                </AccordionItem>
              </motion.div>
            ))}
          </Accordion>
        </div>
      </section>
    </Layout>
  );
}

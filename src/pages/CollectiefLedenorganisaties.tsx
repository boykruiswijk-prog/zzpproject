import { useState } from "react";
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
import { AnimatedSection } from "@/components/ui/animated-section";
import {
  Shield, Users, Handshake, Network, CheckCircle, Settings,
  HeadphonesIcon, ArrowRight, Phone, Clock, BadgeCheck,
  Scale, Lock, Heart, BarChart3, Search, Briefcase, Building2,
  Banknote, Zap, TrendingUp, UserCheck
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

/* ─── Data ─── */
const doelgroepen = [
  { icon: Users, title: "Brancheverenigingen", desc: "Collectief voordeel als concreet ledenvoordeel." },
  { icon: Shield, title: "Beroepsorganisaties", desc: "Professionele zekerheid voor iedere aangesloten professional." },
  { icon: Network, title: "Netwerken voor zzp'ers", desc: "Versterk je netwerk met meetbaar financieel voordeel." },
  { icon: Handshake, title: "Franchise- & ondernemersverenigingen", desc: "Lagere premies voor alle aangesloten ondernemers." },
  { icon: Briefcase, title: "Intermediairs & dienstverleners", desc: "Bied je klanten verzekeringen aan met collectieve tarieven." },
  { icon: Building2, title: "Detacheerders", desc: "Zorg dat je gedetacheerden goed en voordelig verzekerd zijn." },
];

const usps = [
  { icon: Shield, title: "Collectieve korting op BAV", desc: "Directe premiekorting voor jouw leden — tot 25% voordeliger dan individuele tarieven." },
  { icon: CheckCircle, title: "Onafhankelijk en transparant", desc: "Geen verplichte bundels. Eerlijk advies, altijd in het belang van jouw leden." },
  { icon: HeadphonesIcon, title: "Persoonlijke ondersteuning", desc: "Elke lid krijgt een vaste adviseur — geen callcenters, altijd een mens aan de lijn." },
  { icon: Settings, title: "Volledige ontzorging", desc: "Van communicatie tot onboarding: wij nemen het werk uit handen." },
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
  { icon: Zap, title: "Binnen 24 uur betaald", desc: "Leden ontvangen hun factuurbedrag binnen één werkdag — geen weken wachten op betaling." },
  { icon: TrendingUp, title: "Stabiele cashflow", desc: "Voorspelbaar inkomen maakt ondernemen eenvoudiger en zekerder." },
  { icon: UserCheck, title: "Debiteurenbeheer inbegrepen", desc: "Wij nemen het debiteurenbeheer over, inclusief insolventiedekking." },
  { icon: Banknote, title: "Exclusief collectief tarief", desc: "Leden profiteren van lagere kosten dankzij het collectieve volume." },
];

const stappen = [
  { nr: 1, title: "Kennismaking", desc: "We leren jouw organisatie kennen, bespreken de behoeften van je leden en verkennen de mogelijkheden." },
  { nr: 2, title: "Voorstel op maat", desc: "Een collectief voorstel met concrete kortingen en diensten, afgestemd op jouw achterban." },
  { nr: 3, title: "Implementatie", desc: "Wij verzorgen alle communicatie richting leden, onboarding en bieden doorlopende persoonlijke support." },
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
  const [formData, setFormData] = useState({
    organisatienaam: "", aantalLeden: "", branche: "",
    contactpersoon: "", telefoon: "", email: "", opmerking: "",
  });

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

      {/* ─── 1. HERO ─── */}
      <section className="relative overflow-hidden min-h-[600px]">
        {/* Background image with overlay */}
        <div className="absolute inset-0">
          <img src={teamHero} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, hsl(213 40% 15% / 0.88) 0%, hsl(213 40% 22% / 0.82) 100%)" }} />
        </div>
        
        <div className="container-wide py-20 md:py-28 lg:py-32 relative z-10">
          <div className="max-w-3xl">
            <AnimatedSection>
              <span className="inline-block text-sm font-semibold tracking-wider uppercase mb-4 px-4 py-1.5 rounded-full" style={{ background: "hsl(213 60% 45% / 0.2)", color: "hsl(213 60% 75%)" }}>
                Voor organisaties & hun leden
              </span>
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white leading-tight mb-6">
                Collectieve korting op verzekeringen{" "}
                <span style={{ color: "hsl(213 60% 75%)" }}>én eerder betaald worden</span>{" "}
                voor jouw leden
              </h1>
              <p className="text-lg text-white/80 mb-8 max-w-2xl">
                Bied jouw leden direct financieel voordeel: lagere premies op zakelijke verzekeringen én snellere betaling van facturen. Persoonlijk, transparant en zonder extra werkdruk voor jouw organisatie.
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  "Collectieve korting op BAV en zakelijke verzekeringen",
                  "Factoring: leden worden binnen 24 uur betaald",
                  "Persoonlijke adviseur voor ieder lid",
                  "Volledig ontzorgde implementatie"
                ].map(item => (
                  <li key={item} className="flex items-center gap-3 text-white/90">
                    <CheckCircle className="h-5 w-5 flex-shrink-0" style={{ color: "hsl(142 60% 55%)" }} />
                    <span className="font-medium">{item}</span>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-4">
                <Button size="lg" onClick={scrollToForm} className="text-white font-semibold" style={{ background: "hsl(213 60% 45%)" }}>
                  Plan een kennismaking <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
                <Button size="lg" onClick={scrollToForm} className="font-semibold" style={{ background: "hsl(0 0% 100%)", color: "hsl(213 40% 18%)" }}>
                  Vraag een collectief voorstel aan
                </Button>
              </div>
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* ─── 2. VOOR WIE ─── */}
      <section className="py-16 md:py-24 bg-background">
        <div className="container-wide max-w-6xl">
          <AnimatedSection className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
              Voor organisaties die hun leden <span style={{ color: "hsl(213 60% 45%)" }}>écht voordeel</span> willen bieden
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Wij werken samen met organisaties die concreet ledenvoordeel willen bieden — zonder extra werkdruk.
            </p>
          </AnimatedSection>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {doelgroepen.map((d, i) => (
              <AnimatedSection key={d.title} delay={i * 0.08}>
                <div className="bg-card rounded-2xl border border-border p-6 shadow-[var(--card-shadow)] hover:shadow-[var(--card-shadow-hover)] transition-all hover:-translate-y-1 h-full">
                  <div className="w-14 h-14 rounded-xl mb-4 flex items-center justify-center" style={{ background: "hsl(213 60% 45% / 0.1)" }}>
                    <d.icon className="h-7 w-7" style={{ color: "hsl(213 60% 45%)" }} />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">{d.title}</h3>
                  <p className="text-sm text-muted-foreground">{d.desc}</p>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 3. LEDENKORTING HIGHLIGHT ─── */}
      <section className="py-16 md:py-24 bg-secondary">
        <div className="container-wide max-w-5xl">
          <AnimatedSection className="text-center mb-4">
            <span className="inline-block text-sm font-semibold tracking-wider uppercase mb-4 px-4 py-1.5 rounded-full" style={{ background: "hsl(213 60% 45% / 0.1)", color: "hsl(213 60% 45%)" }}>
              Concrete ledenvoordelen
            </span>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
              Waarom organisaties kiezen voor <span style={{ color: "hsl(213 60% 45%)" }}>ZP Zaken</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Geen beloftes, maar meetbaar voordeel voor jouw leden. Dit is wat wij leveren:
            </p>
          </AnimatedSection>



          <div className="grid sm:grid-cols-2 gap-6">
            {usps.map((u, i) => (
              <AnimatedSection key={u.title} delay={i * 0.1}>
                <div className="bg-card rounded-2xl border border-border p-6 shadow-[var(--card-shadow)] hover:shadow-[var(--card-shadow-hover)] transition-shadow h-full flex gap-4">
                  <div className="w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center" style={{ background: "hsl(213 60% 45% / 0.1)" }}>
                    <u.icon className="h-6 w-6" style={{ color: "hsl(213 60% 45%)" }} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">{u.title}</h3>
                    <p className="text-sm text-muted-foreground">{u.desc}</p>
                  </div>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 4. FACTORING / EERDER BETALEN ─── */}
      <section className="py-16 md:py-24 bg-background">
        <div className="container-wide max-w-5xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <AnimatedSection>
              <span className="inline-block text-sm font-semibold tracking-wider uppercase mb-4 px-4 py-1.5 rounded-full" style={{ background: "hsl(142 60% 45% / 0.1)", color: "hsl(142 60% 35%)" }}>
                Exclusief voor leden
              </span>
              <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
                Leden worden <span style={{ color: "hsl(213 60% 45%)" }}>binnen 24 uur</span> betaald
              </h2>
              <p className="text-muted-foreground mb-6">
                Naast collectieve korting op verzekeringen bieden wij leden ook onze eigen factoring-oplossing aan. Geen weken wachten op betaling — leden ontvangen hun factuurbedrag dezelfde dag. Inclusief debiteurenbeheer en insolventiedekking.
              </p>
              <Button onClick={scrollToForm} variant="outline" className="border-2" style={{ borderColor: "hsl(213 60% 45%)", color: "hsl(213 60% 45%)" }}>
                Meer weten? Vraag een voorstel aan <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </AnimatedSection>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {factoringVoordelen.map((v, i) => (
                <AnimatedSection key={v.title} delay={i * 0.1}>
                  <div className="bg-card rounded-2xl border border-border p-5 shadow-[var(--card-shadow)] hover:shadow-[var(--card-shadow-hover)] transition-shadow h-full">
                    <div className="w-10 h-10 rounded-lg mb-3 flex items-center justify-center" style={{ background: "hsl(213 60% 45% / 0.1)" }}>
                      <v.icon className="h-5 w-5" style={{ color: "hsl(213 60% 45%)" }} />
                    </div>
                    <h3 className="font-semibold text-foreground text-sm mb-1">{v.title}</h3>
                    <p className="text-xs text-muted-foreground">{v.desc}</p>
                  </div>
                </AnimatedSection>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── 5. PRODUCTEN ─── */}
      <section className="py-16 md:py-24 bg-secondary">
        <div className="container-wide max-w-5xl">
          <AnimatedSection className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
              Meer dan alleen <span style={{ color: "hsl(213 60% 45%)" }}>BAV</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              BAV is ons kernproduct, maar we bieden leden een compleet pakket aan zakelijke zekerheid.
            </p>
          </AnimatedSection>

          {/* Featured BAV */}
          <AnimatedSection className="mb-10">
            <div className="rounded-2xl border-2 p-8 flex flex-col md:flex-row items-center gap-6" style={{ borderColor: "hsl(213 60% 45%)", background: "hsl(213 60% 97%)" }}>
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: "hsl(213 60% 45%)" }}>
                <Shield className="h-10 w-10 text-white" />
              </div>
              <div className="flex-1 text-center md:text-left">
                <h3 className="text-xl font-bold text-foreground mb-2">Beroepsaansprakelijkheidsverzekering (BAV + AVB)</h3>
                <p className="text-muted-foreground">De enige gecombineerde beroeps- en bedrijfsaansprakelijkheidsverzekering in Nederland — met exclusieve collectieve korting.</p>
              </div>
              <Button onClick={scrollToForm} className="text-white flex-shrink-0" style={{ background: "hsl(213 60% 45%)" }}>
                Collectief voorstel <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </AnimatedSection>

          {/* Extra products grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {extraProducts.map((p, i) => (
              <AnimatedSection key={p.name} delay={i * 0.08}>
                <div className="bg-card rounded-xl border border-border p-5 flex items-center gap-4 shadow-[var(--card-shadow)] hover:shadow-[var(--card-shadow-hover)] transition-shadow">
                  <p.icon className="h-5 w-5 flex-shrink-0" style={{ color: "hsl(213 60% 45%)" }} />
                  <span className="font-medium text-foreground text-sm">{p.name}</span>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 6. HOE WERKT HET ─── */}
      <section className="py-16 md:py-24 bg-background">
        <div className="container-wide max-w-4xl">
          <AnimatedSection className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
              In <span style={{ color: "hsl(213 60% 45%)" }}>3 eenvoudige</span> stappen
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Van kennismaking tot implementatie — wij ontzorgen het hele traject.
            </p>
          </AnimatedSection>
          <div className="grid md:grid-cols-3 gap-8">
            {stappen.map((s, i) => (
              <AnimatedSection key={s.nr} delay={i * 0.15}>
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center text-white text-2xl font-bold" style={{ background: "hsl(213 60% 45%)" }}>
                    {s.nr}
                  </div>
                  <h3 className="font-semibold text-foreground text-lg mb-2">{s.title}</h3>
                  <p className="text-sm text-muted-foreground">{s.desc}</p>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 7. FORMULIER + CTA ─── */}
      <section id="collectief-form" className="py-16 md:py-24" style={{ background: "hsl(213 40% 18%)" }}>
        <div className="container-wide max-w-5xl">
          <div className="grid lg:grid-cols-2 gap-12 items-start">
            <AnimatedSection>
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
                Ontdek wat wij voor jouw leden kunnen betekenen
              </h2>
              <p className="text-white/70 mb-8">
                Plan vrijblijvend een kennismaking. Wij komen graag langs of bellen om de mogelijkheden te bespreken — persoonlijk en zonder verplichtingen.
              </p>
              <ul className="space-y-4 mb-8">
                {[
                  { icon: Clock, text: "Binnen 24 uur reactie" },
                  { icon: BadgeCheck, text: "AFM geregistreerd (12050636)" },
                  { icon: Phone, text: "Persoonlijk contact: 023 - 201 0502" },
                  { icon: CheckCircle, text: "Kosteloos voor jouw organisatie" },
                ].map(t => (
                  <li key={t.text} className="flex items-center gap-3 text-white/90">
                    <t.icon className="h-5 w-5 flex-shrink-0" style={{ color: "hsl(213 60% 65%)" }} />
                    <span>{t.text}</span>
                  </li>
                ))}
              </ul>
            </AnimatedSection>

            <AnimatedSection delay={0.2}>
              <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 md:p-8 shadow-lg space-y-4">
                <h3 className="text-lg font-bold text-foreground mb-2">Ontvang collectief voorstel</h3>
                <div>
                  <Label htmlFor="organisatienaam">Organisatienaam *</Label>
                  <Input id="organisatienaam" name="organisatienaam" value={formData.organisatienaam} onChange={handleChange} className={cn(errors.organisatienaam && "border-destructive")} />
                  <FieldError msg={errors.organisatienaam} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="aantalLeden">Aantal leden *</Label>
                    <Input id="aantalLeden" name="aantalLeden" type="number" min="1" value={formData.aantalLeden} onChange={handleChange} className={cn(errors.aantalLeden && "border-destructive")} />
                    <FieldError msg={errors.aantalLeden} />
                  </div>
                  <div>
                    <Label htmlFor="branche">Branche *</Label>
                    <Input id="branche" name="branche" value={formData.branche} onChange={handleChange} className={cn(errors.branche && "border-destructive")} />
                    <FieldError msg={errors.branche} />
                  </div>
                </div>
                <div>
                  <Label htmlFor="contactpersoon">Contactpersoon *</Label>
                  <Input id="contactpersoon" name="contactpersoon" value={formData.contactpersoon} onChange={handleChange} className={cn(errors.contactpersoon && "border-destructive")} />
                  <FieldError msg={errors.contactpersoon} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="telefoon">Telefoonnummer *</Label>
                    <Input id="telefoon" name="telefoon" type="tel" value={formData.telefoon} onChange={handleChange} placeholder="0612345678" className={cn(errors.telefoon && "border-destructive")} />
                    <FieldError msg={errors.telefoon} />
                  </div>
                  <div>
                    <Label htmlFor="email">E-mail *</Label>
                    <Input id="email" name="email" type="email" value={formData.email} onChange={handleChange} placeholder="info@organisatie.nl" className={cn(errors.email && "border-destructive")} />
                    <FieldError msg={errors.email} />
                  </div>
                </div>
                <div>
                  <Label htmlFor="opmerking">Opmerking (optioneel)</Label>
                  <Textarea id="opmerking" name="opmerking" value={formData.opmerking} onChange={handleChange} rows={3} />
                </div>
                <Button type="submit" size="lg" disabled={isSubmitting} className="w-full text-white font-semibold" style={{ background: "hsl(213 60% 45%)" }}>
                  {isSubmitting ? "Verzenden..." : "Ontvang collectief voorstel"}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </form>
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* ─── 8. FAQ ─── */}
      <section className="py-16 md:py-24 bg-background">
        <div className="container-wide max-w-3xl">
          <AnimatedSection className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">Veelgestelde vragen</h2>
          </AnimatedSection>
          <AnimatedSection delay={0.1}>
            <Accordion type="single" collapsible className="space-y-3">
              {faqs.map((faq, i) => (
                <AccordionItem key={i} value={`faq-${i}`} className="bg-card rounded-xl border border-border px-6 shadow-[var(--card-shadow)]">
                  <AccordionTrigger className="text-foreground font-medium hover:no-underline">{faq.q}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">{faq.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </AnimatedSection>
        </div>
      </section>
    </Layout>
  );
}

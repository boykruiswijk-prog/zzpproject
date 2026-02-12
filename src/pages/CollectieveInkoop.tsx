import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Layout } from "@/components/layout/Layout";
import { PageHero } from "@/components/layout/PageHero";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Check, Users, Zap, Monitor, Shield, ArrowRight, Mail } from "lucide-react";
import { AnimatedSection } from "@/components/ui/animated-section";

// Pilot config – easy to add new pilots later
const pilots = [
  {
    slug: "stroom-2026",
    title: "Collectieve Stroom 2026",
    icon: <Zap className="h-6 w-6" />,
    description: "Energiecontracten worden individueel afgesloten. Wij gaan 100 zzp'ers bundelen en laten energieleveranciers bieden op de hele groep.",
    goal: 100,
    forWhom: ["Privé huishouden", "Zakelijk energiecontract"],
    formType: "energy" as const,
  },
  {
    slug: "software-deals",
    title: "Collectieve Software Deals",
    icon: <Monitor className="h-6 w-6" />,
    description: "Boekhoudsoftware, CRM, AI-tools en hosting worden vaak tegen standaardprijzen verkocht. Bij voldoende interesse onderhandelen wij volumekorting voor zzp'ers.",
    goal: 75,
    forWhom: [],
    interests: ["Boekhoudsoftware", "CRM", "AI-tools", "Hosting / e-mail"],
    formType: "software" as const,
  },
];

const faqItems = [
  { q: "Is inschrijven verplicht?", a: "Nee, volledig vrijblijvend." },
  { q: "Wat als de deal tegenvalt?", a: "Dan hoef je niets te doen." },
  { q: "Wanneer hoor ik meer?", a: "Zodra het minimum aantal deelnemers is bereikt." },
  { q: "Kan ik meerdere pilots kiezen?", a: "Ja." },
];

const steps = [
  { num: 1, title: "Jij schrijft je in", icon: <Users className="h-5 w-5" /> },
  { num: 2, title: "Wij verzamelen minimaal aantal deelnemers", icon: <Users className="h-5 w-5" /> },
  { num: 3, title: "Leveranciers doen een bod", icon: <ArrowRight className="h-5 w-5" /> },
  { num: 4, title: "Jij beslist of je meedoet", icon: <Check className="h-5 w-5" /> },
];

function usePilotCount(slug: string) {
  return useQuery({
    queryKey: ["pilot-count", slug],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_pilot_signup_count", { pilot: slug });
      if (error) throw error;
      return (data as number) ?? 0;
    },
  });
}

function PilotCard({ pilot }: { pilot: typeof pilots[0] }) {
  const [open, setOpen] = useState(false);
  const { data: count = 0 } = usePilotCount(pilot.slug);
  const progress = Math.min((count / pilot.goal) * 100, 100);

  return (
    <>
      <AnimatedSection className="bg-card rounded-2xl border border-border p-8 shadow-[var(--card-shadow)] hover:shadow-[var(--card-shadow-hover)] transition-shadow">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
            {pilot.icon}
          </div>
          <h3 className="text-xl font-bold text-foreground">{pilot.title}</h3>
        </div>
        <p className="text-muted-foreground mb-6">{pilot.description}</p>

        {/* Progress */}
        <div className="mb-2 flex justify-between text-sm">
          <span className="text-muted-foreground">Deelnemers</span>
          <span className="font-semibold text-foreground">{count} / {pilot.goal}</span>
        </div>
        <Progress value={progress} className="h-3 mb-6" />

        {pilot.forWhom.length > 0 && (
          <div className="mb-6">
            <p className="text-sm font-medium text-foreground mb-2">Voor wie:</p>
            <div className="flex flex-wrap gap-2">
              {pilot.forWhom.map((f) => (
                <span key={f} className="text-xs bg-secondary text-secondary-foreground px-3 py-1 rounded-full">{f}</span>
              ))}
            </div>
          </div>
        )}

        <Button onClick={() => setOpen(true)} className="w-full" variant="accent">
          Schrijf je vrijblijvend in
        </Button>
      </AnimatedSection>

      <PilotSignupDialog pilot={pilot} open={open} onOpenChange={setOpen} />
    </>
  );
}

function PilotSignupDialog({ pilot, open, onOpenChange }: {
  pilot: typeof pilots[0];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    naam: "",
    email: "",
    telefoon: "",
    postcode: "",
    type: "",
    huidige_leverancier: "",
    interesse_gebieden: [] as string[],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.naam.trim() || !form.email.trim()) return;
    setLoading(true);
    try {
      const { error } = await supabase.from("collective_signups").insert({
        pilot_slug: pilot.slug,
        naam: form.naam.trim(),
        email: form.email.trim(),
        telefoon: form.telefoon.trim() || null,
        postcode: form.postcode.trim() || null,
        type: form.type || null,
        huidige_leverancier: form.huidige_leverancier.trim() || null,
        interesse_gebieden: form.interesse_gebieden.length > 0 ? form.interesse_gebieden : null,
      });
      if (error) throw error;
      toast({ title: "Inschrijving ontvangen!", description: "We houden je op de hoogte." });
      onOpenChange(false);
      setForm({ naam: "", email: "", telefoon: "", postcode: "", type: "", huidige_leverancier: "", interesse_gebieden: [] });
    } catch {
      toast({ title: "Er ging iets mis", description: "Probeer het later opnieuw.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const toggleInterest = (val: string) => {
    setForm((prev) => ({
      ...prev,
      interesse_gebieden: prev.interesse_gebieden.includes(val)
        ? prev.interesse_gebieden.filter((v) => v !== val)
        : [...prev.interesse_gebieden, val],
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Inschrijven: {pilot.title}</DialogTitle>
          <DialogDescription>Vul je gegevens in. Je zit nergens aan vast.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="naam">Naam *</Label>
            <Input id="naam" value={form.naam} onChange={(e) => setForm({ ...form, naam: e.target.value })} required maxLength={100} />
          </div>
          <div>
            <Label htmlFor="email">E-mail *</Label>
            <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required maxLength={255} />
          </div>
          <div>
            <Label htmlFor="telefoon">Telefoon</Label>
            <Input id="telefoon" value={form.telefoon} onChange={(e) => setForm({ ...form, telefoon: e.target.value })} maxLength={20} />
          </div>

          {pilot.formType === "energy" && (
            <>
              <div>
                <Label htmlFor="postcode">Postcode</Label>
                <Input id="postcode" value={form.postcode} onChange={(e) => setForm({ ...form, postcode: e.target.value })} maxLength={10} />
              </div>
              <div>
                <Label>Privé of zakelijk?</Label>
                <div className="flex gap-3 mt-1">
                  {["Privé", "Zakelijk"].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setForm({ ...form, type: t.toLowerCase() })}
                      className={`px-4 py-2 rounded-lg border text-sm transition-colors ${
                        form.type === t.toLowerCase()
                          ? "bg-accent text-accent-foreground border-accent"
                          : "bg-card text-muted-foreground border-border hover:border-foreground/30"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label htmlFor="leverancier">Huidige leverancier (optioneel)</Label>
                <Input id="leverancier" value={form.huidige_leverancier} onChange={(e) => setForm({ ...form, huidige_leverancier: e.target.value })} maxLength={100} />
              </div>
            </>
          )}

          {pilot.formType === "software" && pilot.interests && (
            <div>
              <Label>Interessegebieden</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {pilot.interests.map((interest) => (
                  <label key={interest} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={form.interesse_gebieden.includes(interest)}
                      onCheckedChange={() => toggleInterest(interest)}
                    />
                    {interest}
                  </label>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground">Je zit nergens aan vast.</p>
          <Button type="submit" className="w-full" variant="accent" disabled={loading}>
            {loading ? "Verzenden..." : "Schrijf je in"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function NewsletterSection() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [privacy, setPrivacy] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !privacy) return;
    setLoading(true);
    try {
      const { error } = await supabase.from("collective_newsletter").insert({ email: email.trim() });
      if (error) throw error;
      toast({ title: "Aangemeld!", description: "Je ontvangt updates over toekomstige collectieven." });
      setEmail("");
      setPrivacy(false);
    } catch {
      toast({ title: "Er ging iets mis", description: "Probeer het later opnieuw.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="bg-foreground text-background section-padding">
      <div className="container-wide max-w-2xl text-center">
        <AnimatedSection>
          <h2 className="text-3xl font-bold mb-4">Wil jij als eerste profiteren van collectieve deals?</h2>
          <p className="text-background/70 mb-8">Meld je aan en ontvang updates over nieuwe collectieven.</p>
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 mb-4">
            <Input
              type="email"
              placeholder="Je e-mailadres"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              maxLength={255}
              className="bg-background/10 border-background/20 text-background placeholder:text-background/50 flex-1"
            />
            <Button type="submit" variant="accent" disabled={loading || !privacy}>
              <Mail className="h-4 w-4 mr-2" />
              {loading ? "Verzenden..." : "Aanmelden"}
            </Button>
          </form>
          <label className="flex items-center justify-center gap-2 text-sm text-background/60 cursor-pointer">
            <Checkbox
              checked={privacy}
              onCheckedChange={(v) => setPrivacy(!!v)}
              className="border-background/30"
            />
            Ik ga akkoord met de{" "}
            <Link to="/privacy" className="underline hover:text-background">privacyverklaring</Link>
          </label>
        </AnimatedSection>
      </div>
    </section>
  );
}

export default function CollectieveInkoop() {
  const scrollToPilots = () => {
    document.getElementById("pilots")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <Layout>
      <Helmet>
        <title>Collectieve Inkoop voor Zzp'ers | ZP Zaken</title>
        <meta name="description" content="Sluit je vrijblijvend aan bij het ZP Zaken collectief en profiteer van exclusieve groepsdeals op stroom en software." />
        <link rel="canonical" href="https://zzpproject.lovable.app/collectieve-inkoop" />
      </Helmet>

      {/* HERO */}
      <PageHero
        title={<>Samen staan zzp'ers <span className="text-accent">sterker</span></>}
        subtitle="Wij verzamelen ondernemers en laten grote aanbieders tegen elkaar bieden. Jij profiteert van de collectieve korting."
        badge={{ text: "Collectieve Inkoop — Pilot", icon: <Users className="h-4 w-4" /> }}
      >
        <div className="space-y-3 mb-8">
          {["Gratis en vrijblijvend inschrijven", "Geen verplichting vooraf", "Alleen meedoen als de deal goed genoeg is"].map((item) => (
            <div key={item} className="flex items-center gap-2 text-primary-foreground/90">
              <Check className="h-4 w-4 text-accent flex-shrink-0" />
              <span className="text-sm">{item}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="accent" size="lg" onClick={scrollToPilots}>
            Bekijk de pilots
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="bg-background/10 text-primary-foreground border-primary-foreground/20 hover:bg-background/20"
            onClick={() => document.getElementById("newsletter")?.scrollIntoView({ behavior: "smooth" })}
          >
            Ontvang updates
          </Button>
        </div>
      </PageHero>

      {/* HOW IT WORKS */}
      <section className="section-padding bg-secondary">
        <div className="container-wide">
          <AnimatedSection className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-2">Hoe het werkt</h2>
          </AnimatedSection>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((step, i) => (
              <AnimatedSection key={step.num} delay={i * 0.1} className="text-center">
                <div className="w-14 h-14 rounded-2xl bg-accent/10 text-accent flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                  {step.num}
                </div>
                <p className="font-medium text-foreground">{step.title}</p>
              </AnimatedSection>
            ))}
          </div>
          <p className="text-center text-sm text-muted-foreground mt-8">Inschrijven is volledig vrijblijvend.</p>
        </div>
      </section>

      {/* ACTIVE PILOTS */}
      <section id="pilots" className="section-padding">
        <div className="container-wide">
          <AnimatedSection className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-2">Actieve pilots</h2>
            <p className="text-muted-foreground">Kies een pilot en schrijf je vrijblijvend in.</p>
          </AnimatedSection>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {pilots.map((pilot) => (
              <PilotCard key={pilot.slug} pilot={pilot} />
            ))}
          </div>
        </div>
      </section>

      {/* WHY WE DO THIS */}
      <section className="section-padding bg-secondary">
        <div className="container-wide max-w-3xl text-center">
          <AnimatedSection>
            <h2 className="text-3xl font-bold text-foreground mb-6">Waarom wij dit starten</h2>
            <p className="text-lg text-muted-foreground mb-4">
              Grote bedrijven krijgen volumekorting.<br />
              Zzp'ers niet.<br />
              <strong className="text-foreground">Dat gaan we veranderen.</strong>
            </p>
            <p className="text-muted-foreground">
              ZP Zaken bundelt ondernemers en onderhandelt namens de groep. Transparant, onafhankelijk en zonder verplichtingen.
            </p>
          </AnimatedSection>
        </div>
      </section>

      {/* TRANSPARENCY */}
      <section className="section-padding">
        <div className="container-wide max-w-3xl">
          <AnimatedSection className="bg-card border border-border rounded-2xl p-8 shadow-[var(--card-shadow)]">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="h-6 w-6 text-accent" />
              <h2 className="text-2xl font-bold text-foreground">Transparant over onze vergoeding</h2>
            </div>
            <p className="text-muted-foreground mb-4">
              Als jij besluit een contract af te sluiten, ontvangt ZP Zaken mogelijk een vergoeding van de aanbieder.
              Jij betaalt nooit extra door onze tussenkomst.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/privacy" className="text-sm text-accent hover:underline">Privacyverklaring</Link>
              <Link to="/voorwaarden" className="text-sm text-accent hover:underline">Algemene voorwaarden</Link>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* FAQ */}
      <section className="section-padding bg-secondary">
        <div className="container-wide max-w-2xl">
          <AnimatedSection className="text-center mb-8">
            <h2 className="text-3xl font-bold text-foreground mb-2">Veelgestelde vragen</h2>
          </AnimatedSection>
          <Accordion type="single" collapsible className="space-y-2">
            {faqItems.map((item, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="bg-card border border-border rounded-xl px-6">
                <AccordionTrigger className="text-left font-medium">{item.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{item.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* NEWSLETTER CTA */}
      <div id="newsletter">
        <NewsletterSection />
      </div>
    </Layout>
  );
}

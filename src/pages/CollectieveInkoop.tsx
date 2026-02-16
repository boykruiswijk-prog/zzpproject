import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
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
import { LocalizedLink } from "@/components/LocalizedLink";
import { Check, Users, Zap, Monitor, Shield, ArrowRight, Mail, Cpu, Phone } from "lucide-react";
import { AnimatedSection } from "@/components/ui/animated-section";
import pilotStroomImg from "@/assets/pilot-stroom.jpg";
import pilotSoftwareImg from "@/assets/pilot-software.jpg";
import pilotAiToolsImg from "@/assets/pilot-ai-tools.jpg";
import pilotTelefonieImg from "@/assets/pilot-telefonie.jpg";

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

function PilotCard({ pilot, t }: { pilot: { slug: string; titleKey: string; descKey: string; icon: React.ReactNode; goal: number; forWhom: string[]; interests?: string[]; formType: "energy" | "software"; image: string }; t: any }) {
  const [open, setOpen] = useState(false);
  const { data: count = 0 } = usePilotCount(pilot.slug);
  const progress = Math.min((count / pilot.goal) * 100, 100);

  return (
    <>
      <AnimatedSection className="rounded-2xl border border-border shadow-[var(--card-shadow)] hover:shadow-[var(--card-shadow-hover)] transition-shadow h-full flex flex-col overflow-hidden">
        <div className="relative h-36 w-full overflow-hidden">
          <img src={pilot.image} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-black/60" />
          <div className="absolute bottom-4 left-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-white flex-shrink-0">
              {pilot.icon}
            </div>
            <h3 className="text-lg font-bold text-white drop-shadow-md">{t(pilot.titleKey)}</h3>
          </div>
        </div>
        <div className="p-6 flex flex-col flex-grow bg-card">
        <p className="text-muted-foreground mb-6 flex-grow">{t(pilot.descKey)}</p>

        <div className="mt-auto">
          <div className="mb-2 flex justify-between text-sm">
            <span className="text-muted-foreground">{t("collectieveInkoop.participants")}</span>
            <span className="font-semibold text-foreground">{count} / {pilot.goal}</span>
          </div>
          <Progress value={progress} className="h-3 mb-6" />

          {pilot.forWhom.length > 0 && (
            <div className="mb-6">
              <p className="text-sm font-medium text-foreground mb-2">{t("collectieveInkoop.forWhom")}</p>
              <div className="flex flex-wrap gap-2">
                {pilot.forWhom.map((f) => (
                  <span key={f} className="text-xs bg-secondary text-secondary-foreground px-3 py-1 rounded-full">{f}</span>
                ))}
              </div>
            </div>
          )}

          <Button onClick={() => setOpen(true)} className="w-full" variant="accent">
            {t("collectieveInkoop.signUpFree")}
          </Button>
        </div>
        </div>
      </AnimatedSection>

      <PilotSignupDialog pilot={pilot} open={open} onOpenChange={setOpen} t={t} />
    </>
  );
}

function PilotSignupDialog({ pilot, open, onOpenChange, t }: {
  pilot: { slug: string; titleKey: string; formType: "energy" | "software"; interests?: string[] };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  t: any;
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    naam: "", email: "", telefoon: "", postcode: "", type: "",
    huidige_leverancier: "", interesse_gebieden: [] as string[],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.naam.trim() || !form.email.trim()) return;
    setLoading(true);
    try {
      const { error } = await supabase.from("collective_signups").insert({
        pilot_slug: pilot.slug, naam: form.naam.trim(), email: form.email.trim(),
        telefoon: form.telefoon.trim() || null, postcode: form.postcode.trim() || null,
        type: form.type || null, huidige_leverancier: form.huidige_leverancier.trim() || null,
        interesse_gebieden: form.interesse_gebieden.length > 0 ? form.interesse_gebieden : null,
      });
      if (error) throw error;
      toast({ title: t("collectieveInkoop.signUpSuccess"), description: t("collectieveInkoop.signUpSuccessDesc") });
      onOpenChange(false);
      setForm({ naam: "", email: "", telefoon: "", postcode: "", type: "", huidige_leverancier: "", interesse_gebieden: [] });
    } catch {
      toast({ title: t("collectieveInkoop.signUpError"), description: t("collectieveInkoop.signUpErrorDesc"), variant: "destructive" });
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
          <DialogTitle>{t("collectieveInkoop.signUpTitle")} {t(pilot.titleKey)}</DialogTitle>
          <DialogDescription>{t("collectieveInkoop.signUpDesc")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="naam">{t("collectieveInkoop.name")} *</Label>
            <Input id="naam" value={form.naam} onChange={(e) => setForm({ ...form, naam: e.target.value })} required maxLength={100} />
          </div>
          <div>
            <Label htmlFor="email">{t("collectieveInkoop.email")} *</Label>
            <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required maxLength={255} />
          </div>
          <div>
            <Label htmlFor="telefoon">{t("collectieveInkoop.phone")}</Label>
            <Input id="telefoon" value={form.telefoon} onChange={(e) => setForm({ ...form, telefoon: e.target.value })} maxLength={20} />
          </div>

          {pilot.formType === "energy" && (
            <>
              <div>
                <Label htmlFor="postcode">{t("collectieveInkoop.postcode")}</Label>
                <Input id="postcode" value={form.postcode} onChange={(e) => setForm({ ...form, postcode: e.target.value })} maxLength={10} />
              </div>
              <div>
                <Label>{t("collectieveInkoop.privateOrBusiness")}</Label>
                <div className="flex gap-3 mt-1">
                  {[{ key: "private", label: t("collectieveInkoop.private") }, { key: "business", label: t("collectieveInkoop.business") }].map((opt) => (
                    <button key={opt.key} type="button" onClick={() => setForm({ ...form, type: opt.key })}
                      className={`px-4 py-2 rounded-lg border text-sm transition-colors ${form.type === opt.key ? "bg-accent text-accent-foreground border-accent" : "bg-card text-muted-foreground border-border hover:border-foreground/30"}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label htmlFor="leverancier">{t("collectieveInkoop.currentSupplier")}</Label>
                <Input id="leverancier" value={form.huidige_leverancier} onChange={(e) => setForm({ ...form, huidige_leverancier: e.target.value })} maxLength={100} />
              </div>
            </>
          )}

          {pilot.formType === "software" && pilot.interests && (
            <div>
              <Label>{t("collectieveInkoop.interestAreas")}</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {pilot.interests.map((interest) => (
                  <label key={interest} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={form.interesse_gebieden.includes(interest)} onCheckedChange={() => toggleInterest(interest)} />
                    {interest}
                  </label>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground">{t("collectieveInkoop.noObligation")}</p>
          <Button type="submit" className="w-full" variant="accent" disabled={loading}>
            {loading ? t("collectieveInkoop.sending") : t("collectieveInkoop.signUp")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function NewsletterSection() {
  const { t } = useTranslation();
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
      toast({ title: t("collectieveInkoop.newsletterSuccess"), description: t("collectieveInkoop.newsletterSuccessDesc") });
      setEmail("");
      setPrivacy(false);
    } catch {
      toast({ title: t("collectieveInkoop.signUpError"), description: t("collectieveInkoop.signUpErrorDesc"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="bg-foreground text-background section-padding">
      <div className="container-wide max-w-2xl text-center">
        <AnimatedSection>
          <h2 className="text-3xl font-bold mb-4">{t("collectieveInkoop.newsletterTitle")}</h2>
          <p className="text-background/70 mb-8">{t("collectieveInkoop.newsletterDesc")}</p>
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 mb-4">
            <Input type="email" placeholder={t("collectieveInkoop.emailPlaceholder")} value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={255}
              className="bg-background/10 border-background/20 text-background placeholder:text-background/50 flex-1" />
            <Button type="submit" variant="accent" disabled={loading || !privacy}>
              <Mail className="h-4 w-4 mr-2" />
              {loading ? t("collectieveInkoop.sending") : t("collectieveInkoop.subscribe")}
            </Button>
          </form>
          <label className="flex items-center justify-center gap-2 text-sm text-background/60 cursor-pointer">
            <Checkbox checked={privacy} onCheckedChange={(v) => setPrivacy(!!v)} className="border-background/30" />
            {t("collectieveInkoop.privacyAgree")}{" "}
            <LocalizedLink to="/privacy" className="underline hover:text-background">{t("collectieveInkoop.privacyPolicy")}</LocalizedLink>
          </label>
        </AnimatedSection>
      </div>
    </section>
  );
}

export default function CollectieveInkoop() {
  const { t } = useTranslation();

  const pilots = [
    { slug: "stroom-2026", titleKey: "collectieveInkoop.pilotStroom", descKey: "collectieveInkoop.pilotStroomDesc", icon: <Zap className="h-6 w-6" />, goal: 100, forWhom: ["Privé huishouden", "Zakelijk energiecontract"], formType: "energy" as const, image: pilotStroomImg },
    { slug: "software-deals", titleKey: "collectieveInkoop.pilotSoftware", descKey: "collectieveInkoop.pilotSoftwareDesc", icon: <Monitor className="h-6 w-6" />, goal: 75, forWhom: [], interests: ["Boekhoudsoftware", "CRM", "AI-tools", "Hosting / e-mail"], formType: "software" as const, image: pilotSoftwareImg },
    { slug: "ai-tools-bundel", titleKey: "collectieveInkoop.pilotAiTools", descKey: "collectieveInkoop.pilotAiToolsDesc", icon: <Cpu className="h-6 w-6" />, goal: 50, forWhom: [], interests: ["ChatGPT", "Canva", "Notion", "Projectmanagement"], formType: "software" as const, image: pilotAiToolsImg },
    { slug: "telefonie", titleKey: "collectieveInkoop.pilotTelefonie", descKey: "collectieveInkoop.pilotTelefonieDesc", icon: <Phone className="h-6 w-6" />, goal: 75, forWhom: ["Zakelijk abonnement", "Privé abonnement"], formType: "energy" as const, image: pilotTelefonieImg },
  ];

  const steps = [
    { num: 1, title: t("collectieveInkoop.step1"), icon: <Users className="h-5 w-5" /> },
    { num: 2, title: t("collectieveInkoop.step2"), icon: <Users className="h-5 w-5" /> },
    { num: 3, title: t("collectieveInkoop.step3"), icon: <ArrowRight className="h-5 w-5" /> },
    { num: 4, title: t("collectieveInkoop.step4"), icon: <Check className="h-5 w-5" /> },
  ];

  const faqItems = [
    { q: t("collectieveInkoop.faq1q"), a: t("collectieveInkoop.faq1a") },
    { q: t("collectieveInkoop.faq2q"), a: t("collectieveInkoop.faq2a") },
    { q: t("collectieveInkoop.faq3q"), a: t("collectieveInkoop.faq3a") },
    { q: t("collectieveInkoop.faq4q"), a: t("collectieveInkoop.faq4a") },
  ];

  const scrollToPilots = () => {
    document.getElementById("pilots")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <Layout>
      <Helmet>
        <title>{t("collectieveInkoop.metaTitle")}</title>
        <meta name="description" content={t("collectieveInkoop.metaDesc")} />
        <link rel="canonical" href="https://zzpproject.lovable.app/collectieve-inkoop" />
      </Helmet>

      <PageHero
        title={<>{t("collectieveInkoop.heroTitle")} <span className="text-accent">{t("collectieveInkoop.heroTitleAccent")}</span></>}
        subtitle={t("collectieveInkoop.heroSubtitle")}
        badge={{ text: t("collectieveInkoop.heroBadge"), icon: <Users className="h-4 w-4" /> }}
      >
        <div className="space-y-3 mb-8">
          {[t("collectieveInkoop.heroUsp1"), t("collectieveInkoop.heroUsp2"), t("collectieveInkoop.heroUsp3")].map((item) => (
            <div key={item} className="flex items-center gap-2 text-primary-foreground/90">
              <Check className="h-4 w-4 text-accent flex-shrink-0" />
              <span className="text-sm">{item}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="accent" size="lg" onClick={scrollToPilots}>{t("collectieveInkoop.viewPilots")}</Button>
          <Button variant="outline" size="lg" className="bg-background/10 text-primary-foreground border-primary-foreground/20 hover:bg-background/20"
            onClick={() => document.getElementById("newsletter")?.scrollIntoView({ behavior: "smooth" })}>
            {t("collectieveInkoop.getUpdates")}
          </Button>
        </div>
      </PageHero>

      <section className="section-padding bg-secondary">
        <div className="container-wide">
          <AnimatedSection className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-2">{t("collectieveInkoop.howItWorks")}</h2>
          </AnimatedSection>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((step, i) => (
              <AnimatedSection key={step.num} delay={i * 0.1} className="text-center">
                <div className="w-14 h-14 rounded-2xl bg-accent/10 text-accent flex items-center justify-center mx-auto mb-4 text-xl font-bold">{step.num}</div>
                <p className="font-medium text-foreground">{step.title}</p>
              </AnimatedSection>
            ))}
          </div>
          <p className="text-center text-sm text-muted-foreground mt-8">{t("collectieveInkoop.freeSignup")}</p>
        </div>
      </section>

      <section id="pilots" className="section-padding">
        <div className="container-wide">
          <AnimatedSection className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-2">{t("collectieveInkoop.activePilots")}</h2>
            <p className="text-muted-foreground">{t("collectieveInkoop.activePilotsDesc")}</p>
          </AnimatedSection>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {pilots.map((pilot) => (
              <PilotCard key={pilot.slug} pilot={pilot} t={t} />
            ))}
          </div>
        </div>
      </section>

      <section className="section-padding bg-secondary">
        <div className="container-wide max-w-3xl text-center">
          <AnimatedSection>
            <h2 className="text-3xl font-bold text-foreground mb-6">{t("collectieveInkoop.whyTitle")}</h2>
            <p className="text-lg text-muted-foreground mb-4">
              {t("collectieveInkoop.whyP1")}<br />
              {t("collectieveInkoop.whyP2")}<br />
              <strong className="text-foreground">{t("collectieveInkoop.whyP3")}</strong>
            </p>
            <p className="text-muted-foreground">{t("collectieveInkoop.whyP4")}</p>
          </AnimatedSection>
        </div>
      </section>

      <section className="section-padding">
        <div className="container-wide max-w-3xl">
          <AnimatedSection className="bg-card border border-border rounded-2xl p-8 shadow-[var(--card-shadow)]">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="h-6 w-6 text-accent" />
              <h2 className="text-2xl font-bold text-foreground">{t("collectieveInkoop.transparencyTitle")}</h2>
            </div>
            <p className="text-muted-foreground mb-4">{t("collectieveInkoop.transparencyDesc")}</p>
            <div className="flex flex-wrap gap-3">
              <LocalizedLink to="/privacy" className="text-sm text-accent hover:underline">{t("collectieveInkoop.privacyLink")}</LocalizedLink>
              <LocalizedLink to="/voorwaarden" className="text-sm text-accent hover:underline">{t("collectieveInkoop.termsLink")}</LocalizedLink>
            </div>
          </AnimatedSection>
        </div>
      </section>

      <section className="section-padding bg-secondary">
        <div className="container-wide max-w-2xl">
          <AnimatedSection className="text-center mb-8">
            <h2 className="text-3xl font-bold text-foreground mb-2">{t("collectieveInkoop.faqTitle")}</h2>
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

      <div id="newsletter">
        <NewsletterSection />
      </div>
    </Layout>
  );
}

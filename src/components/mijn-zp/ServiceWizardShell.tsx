import { useState, ReactNode } from "react";
import { Helmet } from "react-helmet-async";
import { Layout } from "@/components/layout/Layout";
import { PageHero } from "@/components/layout/PageHero";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ArrowLeft, ArrowRight, CheckCircle, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type ServiceType = "certificaat" | "pauzeren" | "documenten" | "opzeggen";

export interface BaseFormData {
  voornaam: string;
  achternaam: string;
  email: string;
  telefoon: string;
  polisnummer: string;
}

interface WizardShellProps {
  type: ServiceType;
  pageTitle: string;
  pageDescription: string;
  introTitle: string;
  introText: string;
  steps: Array<{
    title: string;
    render: (props: {
      formData: BaseFormData;
      setFormData: (d: BaseFormData) => void;
      details: Record<string, any>;
      setDetails: (d: Record<string, any>) => void;
      errors: Record<string, string>;
    }) => ReactNode;
    validate?: (formData: BaseFormData, details: Record<string, any>) => Record<string, string>;
  }>;
}

export function ServiceWizardShell({
  type,
  pageTitle,
  pageDescription,
  introTitle,
  introText,
  steps,
}: WizardShellProps) {
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<BaseFormData>({
    voornaam: "",
    achternaam: "",
    email: "",
    telefoon: "",
    polisnummer: "",
  });
  const [details, setDetails] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const total = steps.length;
  const current = steps[step];

  const next = () => {
    const errs = current.validate?.(formData, details) ?? {};
    setErrors(errs);
    if (Object.keys(errs).length === 0) {
      if (step < total - 1) setStep(step + 1);
      else submit();
    }
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("process-klant-service", {
        body: { type, ...formData, details },
      });
      if (error || !data?.success) throw error ?? new Error("Onbekende fout");
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      toast({
        title: "Er ging iets mis",
        description: "Probeer opnieuw of bel 020 - 457 3077",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <link rel="canonical" href={`https://zpzaken.nl/mijn-zp/${type}`} />
      </Helmet>
      <PageHero
        badge={{ text: "Mijn ZP" }}
        title={introTitle}
        subtitle={introText}
      />
      <section className="section-padding bg-secondary/30">
        <div className="container-wide max-w-2xl">
          {submitted ? (
            <div className="bg-card border border-border rounded-2xl p-8 text-center space-y-4">
              <div className="h-16 w-16 mx-auto rounded-full bg-accent/10 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-accent" />
              </div>
              <h2 className="text-2xl font-bold">Aanvraag ontvangen</h2>
              <p className="text-muted-foreground">
                We hebben je aanvraag ontvangen. Een medewerker neemt binnen 24 uur contact met je op.
                Je ontvangt ook een bevestigingsmail op {formData.email}.
              </p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl p-6 md:p-8 space-y-6">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Stap {step + 1} van {total}</span>
                <div className="flex gap-1">
                  {steps.map((_, i) => (
                    <span key={i} className={`h-1.5 w-8 rounded-full ${i <= step ? "bg-accent" : "bg-border"}`} />
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-1">{current.title}</h3>
              </div>
              {current.render({ formData, setFormData, details, setDetails, errors })}
              <div className="flex justify-between pt-4 border-t border-border">
                {step > 0 ? (
                  <Button variant="outline" onClick={() => setStep(step - 1)}>
                    <ArrowLeft className="h-4 w-4" /> Vorige
                  </Button>
                ) : <div />}
                <Button
                  onClick={next}
                  disabled={submitting}
                  className="bg-accent hover:bg-accent/90 text-accent-foreground"
                >
                  {step < total - 1 ? "Volgende" : submitting ? "Versturen…" : "Verstuur aanvraag"}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
}

// Gedeelde identificatie-stap renderer.
export function IdentificatieStep({
  formData,
  setFormData,
  errors,
}: {
  formData: BaseFormData;
  setFormData: (d: BaseFormData) => void;
  errors: Record<string, string>;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="voornaam">Voornaam *</Label>
          <Input id="voornaam" value={formData.voornaam}
            onChange={(e) => setFormData({ ...formData, voornaam: e.target.value })} />
          {errors.voornaam && <p className="text-xs text-destructive mt-1">{errors.voornaam}</p>}
        </div>
        <div>
          <Label htmlFor="achternaam">Achternaam *</Label>
          <Input id="achternaam" value={formData.achternaam}
            onChange={(e) => setFormData({ ...formData, achternaam: e.target.value })} />
          {errors.achternaam && <p className="text-xs text-destructive mt-1">{errors.achternaam}</p>}
        </div>
      </div>
      <div>
        <Label htmlFor="email">E-mail *</Label>
        <Input id="email" type="email" value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
        {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
      </div>
      <div>
        <Label htmlFor="telefoon">Telefoon *</Label>
        <Input id="telefoon" value={formData.telefoon}
          onChange={(e) => setFormData({ ...formData, telefoon: e.target.value })} />
        {errors.telefoon && <p className="text-xs text-destructive mt-1">{errors.telefoon}</p>}
      </div>
      <div>
        <Label htmlFor="polisnummer">Polisnummer *</Label>
        <Input id="polisnummer" value={formData.polisnummer} placeholder="ZPBAV…"
          onChange={(e) => setFormData({ ...formData, polisnummer: e.target.value })} />
        {errors.polisnummer && <p className="text-xs text-destructive mt-1">{errors.polisnummer}</p>}
      </div>
    </div>
  );
}

export function validateIdentificatie(f: BaseFormData): Record<string, string> {
  const e: Record<string, string> = {};
  if (!f.voornaam.trim()) e.voornaam = "Verplicht";
  if (!f.achternaam.trim()) e.achternaam = "Verplicht";
  if (!f.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) e.email = "Geldig e-mailadres vereist";
  if (!f.telefoon.trim() || f.telefoon.replace(/\D/g, "").length < 8) e.telefoon = "Geldig telefoonnummer vereist";
  if (!f.polisnummer.trim()) e.polisnummer = "Polisnummer is verplicht";
  return e;
}

export { Input, Label, Textarea, Checkbox, RadioGroup, RadioGroupItem, ShieldCheck };

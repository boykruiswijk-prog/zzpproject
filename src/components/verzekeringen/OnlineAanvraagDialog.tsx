import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle, ArrowRight, ArrowLeft, Loader2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { trackFormStart, trackFormComplete } from "@/lib/tracking";

interface OnlineAanvraagDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  insuranceType: string;
  insuranceTitle: string;
}

const steps = [
  { id: 1, title: "Persoonlijke gegevens" },
  { id: 2, title: "Bedrijfsgegevens" },
  { id: 3, title: "Dekking kiezen" },
  { id: 4, title: "Bevestiging" },
];

export function OnlineAanvraagDialog({
  open,
  onOpenChange,
  insuranceType,
  insuranceTitle,
}: OnlineAanvraagDialogProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    // Step 1 - Persoonlijke gegevens
    voornaam: "",
    achternaam: "",
    email: "",
    telefoon: "",
    geboortedatum: "",
    
    // Step 2 - Bedrijfsgegevens
    bedrijfsnaam: "",
    kvkNummer: "",
    beroep: "",
    jaarOmzet: "",
    
    // Step 3 - Dekking
    dekkingsBedrag: "",
    eigenRisico: "",
    ingangsdatum: "",
    opmerkingen: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateFormData = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error on change
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (step === 1) {
      if (!formData.voornaam.trim()) newErrors.voornaam = "Voornaam is verplicht";
      if (!formData.achternaam.trim()) newErrors.achternaam = "Achternaam is verplicht";
      if (!formData.email.trim()) newErrors.email = "E-mailadres is verplicht";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = "Ongeldig e-mailadres";
      if (!formData.telefoon.trim()) newErrors.telefoon = "Telefoonnummer is verplicht";
      else if (!/^\d{10}$/.test(formData.telefoon.replace(/\s|-/g, ""))) newErrors.telefoon = "Voer een geldig 10-cijferig nummer in";
      if (!formData.geboortedatum) newErrors.geboortedatum = "Geboortedatum is verplicht";
    }
    
    if (step === 2) {
      if (!formData.bedrijfsnaam.trim()) newErrors.bedrijfsnaam = "Bedrijfsnaam is verplicht";
      if (!formData.kvkNummer.trim()) newErrors.kvkNummer = "KvK-nummer is verplicht";
      else if (!/^\d{8}$/.test(formData.kvkNummer.replace(/\s/g, ""))) newErrors.kvkNummer = "KvK-nummer moet 8 cijfers zijn";
      if (!formData.beroep.trim()) newErrors.beroep = "Beroep is verplicht";
      if (!formData.jaarOmzet) newErrors.jaarOmzet = "Selecteer je jaaromzet";
    }
    
    if (step === 3) {
      if (!formData.dekkingsBedrag) newErrors.dekkingsBedrag = "Selecteer een verzekerd bedrag";
      if (!formData.ingangsdatum) newErrors.ingangsdatum = "Kies een ingangsdatum";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (!validateStep(currentStep)) return;
    if (currentStep === 1) trackFormStart(insuranceTitle);
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    
    try {
      // Prepare data for AFAS
      const afasData = {
        voornaam: formData.voornaam,
        achternaam: formData.achternaam,
        email: formData.email,
        telefoon: formData.telefoon,
        geboortedatum: formData.geboortedatum,
        bedrijfsnaam: formData.bedrijfsnaam,
        kvkNummer: formData.kvkNummer,
        beroep: formData.beroep,
        jaarOmzet: formData.jaarOmzet,
        verzekeringType: insuranceTitle,
        dekkingsBedrag: formData.dekkingsBedrag,
        eigenRisico: formData.eigenRisico,
        ingangsdatum: formData.ingangsdatum,
        opmerkingen: formData.opmerkingen,
        bron: "website",
        timestamp: new Date().toISOString(),
      };

      // Send to AFAS (no-cors mode for cross-origin)
      await fetch("https://shop.zpzaken.nl/bav-jaarlijks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        mode: "no-cors",
        body: JSON.stringify(afasData),
      });

      // Also save to database for admin dashboard
      const { error } = await supabase.from("leads").insert({
        type: "verzekering_aanvraag",
        voornaam: formData.voornaam,
        achternaam: formData.achternaam,
        email: formData.email,
        telefoon: formData.telefoon || null,
        geboortedatum: formData.geboortedatum || null,
        bedrijfsnaam: formData.bedrijfsnaam || null,
        kvk_nummer: formData.kvkNummer || null,
        beroep: formData.beroep || null,
        omzet: formData.jaarOmzet || null,
        verzekering_type: insuranceTitle,
        verzekerd_bedrag: formData.dekkingsBedrag || null,
        eigen_risico: formData.eigenRisico || null,
        ingangsdatum: formData.ingangsdatum || null,
        opmerkingen: formData.opmerkingen || null,
        bron: "website",
      });

      if (error) {
        console.error("Database error:", error);
        // Don't throw - AFAS submission succeeded
      }

      trackFormComplete(insuranceTitle);
      setIsCompleted(true);
      toast({
        title: "Aanvraag ontvangen!",
        description: "We nemen binnen 1 werkdag contact met je op.",
      });
    } catch (error) {
      console.error("Error submitting lead:", error);
      toast({
        title: "Er ging iets mis",
        description: "Probeer het later opnieuw of neem telefonisch contact op.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset state after close animation
    setTimeout(() => {
      setCurrentStep(1);
      setIsCompleted(false);
      setFormData({
        voornaam: "",
        achternaam: "",
        email: "",
        telefoon: "",
        geboortedatum: "",
        bedrijfsnaam: "",
        kvkNummer: "",
        beroep: "",
        jaarOmzet: "",
        dekkingsBedrag: "",
        eigenRisico: "",
        ingangsdatum: "",
        opmerkingen: "",
      });
    }, 200);
  };

  if (isCompleted) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-lg">
          <div className="text-center py-8">
            <div className="h-16 w-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="h-8 w-8 text-accent" />
            </div>
            <DialogHeader>
              <DialogTitle className="text-2xl mb-2">Aanvraag verzonden!</DialogTitle>
              <DialogDescription className="text-base">
                Bedankt voor je aanvraag voor de {insuranceTitle}. We hebben je gegevens 
                ontvangen en nemen binnen 1 werkdag contact met je op om de aanvraag af te ronden.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-8 p-4 bg-secondary rounded-lg text-left">
              <p className="font-medium mb-2">Wat kun je verwachten?</p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-accent flex-shrink-0 mt-0.5" />
                  <span>Bevestigingsmail met overzicht van je aanvraag</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-accent flex-shrink-0 mt-0.5" />
                  <span>Persoonlijk contact binnen 1 werkdag</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-accent flex-shrink-0 mt-0.5" />
                  <span>Definitief voorstel met premieberekening</span>
                </li>
              </ul>
            </div>
            <Button variant="accent" className="mt-6" onClick={handleClose}>
              Sluiten
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{insuranceTitle} online afsluiten</DialogTitle>
          <DialogDescription>
            Sluit je verzekering direct online af. Vul onderstaande gegevens in en ontvang binnen 1 werkdag je polis.
          </DialogDescription>
        </DialogHeader>

        {/* Progress steps */}
        <div className="flex items-center justify-between mb-6 mt-2">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                    currentStep >= step.id
                      ? "bg-accent text-white"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {currentStep > step.id ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    step.id
                  )}
                </div>
                <span className="text-xs mt-1 text-muted-foreground hidden sm:block">
                  {step.title}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`h-0.5 w-8 sm:w-16 mx-2 transition-colors ${
                    currentStep > step.id ? "bg-accent" : "bg-secondary"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Persoonlijke gegevens */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="voornaam">Voornaam *</Label>
                <Input
                  id="voornaam"
                  value={formData.voornaam}
                  onChange={(e) => updateFormData("voornaam", e.target.value)}
                  placeholder="Jan"
                  className={errors.voornaam ? "border-destructive" : ""}
                />
                {errors.voornaam && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.voornaam}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="achternaam">Achternaam *</Label>
                <Input
                  id="achternaam"
                  value={formData.achternaam}
                  onChange={(e) => updateFormData("achternaam", e.target.value)}
                  placeholder="Jansen"
                  className={errors.achternaam ? "border-destructive" : ""}
                />
                {errors.achternaam && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.achternaam}</p>}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mailadres *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => updateFormData("email", e.target.value)}
                placeholder="jan@bedrijf.nl"
                className={errors.email ? "border-destructive" : ""}
              />
              {errors.email && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.email}</p>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="telefoon">Telefoonnummer *</Label>
                <Input
                  id="telefoon"
                  type="tel"
                  value={formData.telefoon}
                  onChange={(e) => updateFormData("telefoon", e.target.value)}
                  placeholder="06 12345678"
                  className={errors.telefoon ? "border-destructive" : ""}
                />
                {errors.telefoon && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.telefoon}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="geboortedatum">Geboortedatum *</Label>
                <Input
                  id="geboortedatum"
                  type="date"
                  value={formData.geboortedatum}
                  onChange={(e) => updateFormData("geboortedatum", e.target.value)}
                  className={errors.geboortedatum ? "border-destructive" : ""}
                />
                {errors.geboortedatum && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.geboortedatum}</p>}
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Bedrijfsgegevens */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bedrijfsnaam">Bedrijfsnaam *</Label>
              <Input
                id="bedrijfsnaam"
                value={formData.bedrijfsnaam}
                onChange={(e) => updateFormData("bedrijfsnaam", e.target.value)}
                placeholder="Jansen Consultancy"
                className={errors.bedrijfsnaam ? "border-destructive" : ""}
              />
              {errors.bedrijfsnaam && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.bedrijfsnaam}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="kvkNummer">KvK-nummer *</Label>
              <Input
                id="kvkNummer"
                value={formData.kvkNummer}
                onChange={(e) => updateFormData("kvkNummer", e.target.value)}
                placeholder="12345678"
                className={errors.kvkNummer ? "border-destructive" : ""}
              />
              {errors.kvkNummer && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.kvkNummer}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="beroep">Beroep / Werkzaamheden *</Label>
              <Input
                id="beroep"
                value={formData.beroep}
                onChange={(e) => updateFormData("beroep", e.target.value)}
                placeholder="ICT Consultant"
                className={errors.beroep ? "border-destructive" : ""}
              />
              {errors.beroep && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.beroep}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="jaarOmzet">Geschatte jaaromzet *</Label>
              <Select
                value={formData.jaarOmzet}
                onValueChange={(value) => updateFormData("jaarOmzet", value)}
              >
                <SelectTrigger className={errors.jaarOmzet ? "border-destructive" : ""}>
                  <SelectValue placeholder="Selecteer jaaromzet" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0-25000">€0 - €25.000</SelectItem>
                  <SelectItem value="25000-50000">€25.000 - €50.000</SelectItem>
                  <SelectItem value="50000-100000">€50.000 - €100.000</SelectItem>
                  <SelectItem value="100000-250000">€100.000 - €250.000</SelectItem>
                  <SelectItem value="250000+">€250.000+</SelectItem>
                </SelectContent>
              </Select>
              {errors.jaarOmzet && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.jaarOmzet}</p>}
            </div>
          </div>
        )}

        {/* Step 3: Dekking kiezen */}
        {currentStep === 3 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="dekkingsBedrag">Gewenst verzekerd bedrag *</Label>
              <Select
                value={formData.dekkingsBedrag}
                onValueChange={(value) => updateFormData("dekkingsBedrag", value)}
              >
                <SelectTrigger className={errors.dekkingsBedrag ? "border-destructive" : ""}>
                  <SelectValue placeholder="Selecteer dekking" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="250000">€250.000</SelectItem>
                  <SelectItem value="500000">€500.000</SelectItem>
                  <SelectItem value="1000000">€1.000.000</SelectItem>
                  <SelectItem value="2500000">€2.500.000</SelectItem>
                </SelectContent>
              </Select>
              {errors.dekkingsBedrag && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.dekkingsBedrag}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="eigenRisico">Eigen risico</Label>
              <Select
                value={formData.eigenRisico}
                onValueChange={(value) => updateFormData("eigenRisico", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecteer eigen risico" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">€0 (geen eigen risico)</SelectItem>
                  <SelectItem value="250">€250</SelectItem>
                  <SelectItem value="500">€500</SelectItem>
                  <SelectItem value="1000">€1.000</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Een hoger eigen risico betekent een lagere premie.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ingangsdatum">Gewenste ingangsdatum *</Label>
              <Input
                id="ingangsdatum"
                type="date"
                value={formData.ingangsdatum}
                onChange={(e) => updateFormData("ingangsdatum", e.target.value)}
                className={errors.ingangsdatum ? "border-destructive" : ""}
              />
              {errors.ingangsdatum && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.ingangsdatum}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="opmerkingen">Opmerkingen (optioneel)</Label>
              <Textarea
                id="opmerkingen"
                value={formData.opmerkingen}
                onChange={(e) => updateFormData("opmerkingen", e.target.value)}
                placeholder="Bijzonderheden of vragen..."
                rows={3}
              />
            </div>
          </div>
        )}

        {/* Step 4: Bevestiging */}
        {currentStep === 4 && (
          <div className="space-y-4">
            <div className="p-4 bg-secondary rounded-lg">
              <h4 className="font-semibold mb-3">Samenvatting aanvraag</h4>
              
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Verzekering</p>
                  <p className="font-medium">{insuranceTitle}</p>
                </div>
                <div className="border-t pt-3">
                  <p className="text-muted-foreground">Aanvrager</p>
                  <p className="font-medium">{formData.voornaam} {formData.achternaam}</p>
                  <p>{formData.email}</p>
                </div>
                <div className="border-t pt-3">
                  <p className="text-muted-foreground">Bedrijf</p>
                  <p className="font-medium">{formData.bedrijfsnaam}</p>
                  <p>KvK: {formData.kvkNummer}</p>
                </div>
                <div className="border-t pt-3">
                  <p className="text-muted-foreground">Dekking</p>
                  <p className="font-medium">
                    {formData.dekkingsBedrag ? `€${parseInt(formData.dekkingsBedrag).toLocaleString('nl-NL')}` : '-'}
                  </p>
                  <p>Eigen risico: {formData.eigenRisico ? `€${formData.eigenRisico}` : '-'}</p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-accent/10 rounded-lg border border-accent/20">
              <p className="text-sm">
                <strong>Let op:</strong> Na het versturen ontvang je binnen 1 werkdag een definitief 
                voorstel met premieberekening. Je zit nergens aan vast tot je akkoord geeft.
              </p>
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex justify-between mt-6 pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 1}
            className={currentStep === 1 ? "invisible" : ""}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Vorige
          </Button>
          
          {currentStep < 4 ? (
            <Button variant="accent" onClick={handleNext}>
              Volgende
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button
              variant="accent"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Bezig met verzenden...
                </>
              ) : (
                <>
                  Aanvraag verzenden
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

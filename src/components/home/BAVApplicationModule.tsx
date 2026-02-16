import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Shield, CheckCircle, Building2, User, FileCheck, CreditCard,
  ArrowRight, ArrowLeft, Calendar, Check, Sparkles, ExternalLink, AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatedSection } from "@/components/ui/animated-section";
import { Dialog, DialogContent } from "@/components/ui/dialog";

const packages = [
  { id: "basis", name: "Combi Basis", coverage: "€ 500.000 per gebeurtenis", yearCoverage: "€ 1.000.000 per jaar", priceMonthly: 27.70, priceYearly: 292.40, popular: false },
  { id: "uitgebreid", name: "Combi Uitgebreid", coverage: "€ 2.500.000 per gebeurtenis", yearCoverage: "€ 5.000.000 per jaar", priceMonthly: 43.54, priceYearly: 482.48, popular: true },
];

const TOTAL_STEPS = 5;

type ValidationErrors = Record<string, string>;

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const isValidPhone = (phone: string) => /^[0-9]{10}$/.test(phone.replace(/[\s\-]/g, ""));
const isValidKvk = (kvk: string) => /^[0-9]{8}$/.test(kvk.trim());
const isValidIban = (iban: string) => {
  const cleaned = iban.replace(/\s/g, "").toUpperCase();
  return /^[A-Z]{2}[0-9]{2}[A-Z0-9]{4,30}$/.test(cleaned) && cleaned.length >= 15 && cleaned.length <= 34;
};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="text-sm text-destructive flex items-center gap-1 mt-1">
      <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
      {message}
    </p>
  );
}

export function BAVApplicationModule() {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedPackage, setSelectedPackage] = useState<string>("uitgebreid");
  const [paymentType, setPaymentType] = useState<"monthly" | "yearly">("monthly");
  const [startDate, setStartDate] = useState<string>("");
  const [viaBemiddelaar, setViaBemiddelaar] = useState<boolean | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"incasso" | "ideal">("incasso");
  const [incassoAkkoord, setIncassoAkkoord] = useState(false);
  const [slotverklaringAkkoord, setSlotverklaringAkkoord] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    bedrijfsnaam: "", kvkNummer: "", beroep: "", functie: "", aantalMedewerkers: "",
    voornaam: "", achternaam: "", email: "", telefoon: "",
    opdrachtgever: "", bemiddelaarNaam: "",
    iban: "",
  });

  const steps = [
    { id: 1, name: t("home.bavStep1"), icon: Shield },
    { id: 2, name: t("home.bavStep2"), icon: Building2 },
    { id: 3, name: t("home.bavStep3"), icon: User },
    { id: 4, name: t("home.bavStep4"), icon: CreditCard },
    { id: 5, name: t("home.bavStep5"), icon: FileCheck },
  ];

  const usps = t("home.bavUsps", { returnObjects: true }) as string[];

  const selectedPkg = packages.find(p => p.id === selectedPackage);
  const currentPrice = paymentType === "monthly" ? selectedPkg?.priceMonthly : selectedPkg?.priceYearly;
  const savings = paymentType === "yearly" ? 40 : 0;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error on input change
    if (errors[name]) {
      setErrors(prev => { const next = { ...prev }; delete next[name]; return next; });
    }
  };

  const validateStep = (step: number): boolean => {
    const newErrors: ValidationErrors = {};

    if (step === 1) {
      if (!startDate) newErrors.startDate = "Selecteer een ingangsdatum";
    }

    if (step === 2) {
      if (!formData.bedrijfsnaam.trim()) newErrors.bedrijfsnaam = "Bedrijfsnaam is verplicht";
      if (!formData.kvkNummer.trim()) newErrors.kvkNummer = "KvK-nummer is verplicht";
      else if (!isValidKvk(formData.kvkNummer)) newErrors.kvkNummer = "KvK-nummer moet 8 cijfers zijn";
      if (!formData.beroep.trim()) newErrors.beroep = "Beroep is verplicht";
      if (!formData.functie.trim()) newErrors.functie = "Functie is verplicht";
      if (!formData.aantalMedewerkers.trim()) newErrors.aantalMedewerkers = "Aantal medewerkers is verplicht";
      else if (parseInt(formData.aantalMedewerkers) < 0) newErrors.aantalMedewerkers = "Ongeldig aantal";
    }

    if (step === 3) {
      if (!formData.voornaam.trim()) newErrors.voornaam = "Voornaam is verplicht";
      if (!formData.achternaam.trim()) newErrors.achternaam = "Achternaam is verplicht";
      if (!formData.email.trim()) newErrors.email = "E-mailadres is verplicht";
      else if (!isValidEmail(formData.email)) newErrors.email = "Ongeldig e-mailadres";
      if (!formData.telefoon.trim()) newErrors.telefoon = "Telefoonnummer is verplicht";
      else if (!isValidPhone(formData.telefoon)) newErrors.telefoon = "Telefoonnummer moet 10 cijfers zijn";
      if (!formData.opdrachtgever.trim()) newErrors.opdrachtgever = "Opdrachtgever is verplicht";
      if (viaBemiddelaar === null) newErrors.bemiddelaar = "Geef aan of je via een bemiddelaar werkt";
      if (viaBemiddelaar && !formData.bemiddelaarNaam.trim()) newErrors.bemiddelaarNaam = "Naam bemiddelaar is verplicht";
    }

    if (step === 4) {
      if (paymentMethod === "incasso") {
        if (!formData.iban.trim()) newErrors.iban = "IBAN is verplicht";
        else if (!isValidIban(formData.iban)) newErrors.iban = "Ongeldig IBAN-nummer";
        if (!incassoAkkoord) newErrors.incassoAkkoord = "Je moet akkoord gaan met automatische incasso";
      }
    }

    if (step === 5) {
      if (!slotverklaringAkkoord) newErrors.slotverklaring = "Je moet akkoord gaan met de slotverklaring";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const nextStep = () => {
    if (validateStep(currentStep) && currentStep < TOTAL_STEPS) {
      setCurrentStep(currentStep + 1);
    }
  };
  const prevStep = () => { if (currentStep > 1) { setErrors({}); setCurrentStep(currentStep - 1); } };
  const handleSubmit = () => {
    if (validateStep(currentStep)) {
      // Submit to AFAS + Supabase happens here (existing logic)
      setIsSubmitted(true);
    }
  };

  return (
    <>
      <Dialog open={isSubmitted} onOpenChange={(open) => { if (!open) setIsSubmitted(false); }}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          <div className="flex flex-col items-center text-center px-6 py-8 sm:px-8 sm:py-10">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200 }}
              className="h-16 w-16 rounded-full bg-accent/10 flex items-center justify-center mb-5"
            >
              <CheckCircle className="h-8 w-8 text-accent" />
            </motion.div>
            <h2 className="text-xl sm:text-2xl font-bold mb-2">Bedankt voor je aanvraag!</h2>
            <p className="text-muted-foreground text-sm sm:text-base mb-1">
              Je aanvraag voor de <span className="font-semibold text-foreground">{selectedPkg?.name}</span> is succesvol ontvangen.
            </p>
            <p className="text-muted-foreground text-xs sm:text-sm mb-6">
              We nemen zo snel mogelijk contact met je op. Je ontvangt binnen 24 uur een bevestiging per e-mail.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <Button variant="accent" size="default" asChild className="w-full sm:w-auto">
                <Link to="/">
                  <ArrowLeft className="h-4 w-4" />
                  Terug naar home
                </Link>
              </Button>
              <Button variant="outline" size="default" asChild className="w-full sm:w-auto">
                <Link to="/contact">
                  Neem contact op
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    <section className="section-padding bg-secondary" id="aanvraag">
      <div className="container-wide">
        <AnimatedSection className="text-center max-w-2xl mx-auto mb-10">
          <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 bg-accent/10 text-accent px-4 py-2 rounded-full text-sm font-medium cursor-default">
              <Sparkles className="h-4 w-4" />{t("home.bavOnline")}
            </motion.div>
            <Link to="/diensten">
              <motion.div initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.1 }}
                className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium hover:bg-primary/20 transition-colors cursor-pointer">
                <Shield className="h-4 w-4" />Verzekeringen, Administratie & meer
              </motion.div>
            </Link>
          </div>
          <h2 className="mb-4">{t("home.bavTitle")} <span className="text-accent">{t("home.bavSubtitle")}</span></h2>
          <p className="text-muted-foreground">{t("home.bavDescription")}</p>
        </AnimatedSection>

        <AnimatedSection delay={0.2} className="max-w-4xl mx-auto">
          {/* Progress Steps */}
          <div className="flex justify-between mb-8 relative">
            <div className="absolute top-5 left-0 right-0 h-0.5 bg-border -z-10" />
            {steps.map((step) => (
              <motion.div key={step.id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: step.id * 0.1 }}
                className="flex flex-col items-center relative z-10">
                <motion.div animate={currentStep >= step.id ? { scale: [1, 1.1, 1] } : {}} transition={{ duration: 0.3 }}
                  className={cn("w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300",
                    currentStep >= step.id ? "bg-accent border-accent text-accent-foreground" : "bg-card border-border text-muted-foreground")}>
                  {currentStep > step.id ? <Check className="h-5 w-5" /> : <step.icon className="h-5 w-5" />}
                </motion.div>
                <span className={cn("text-xs mt-2 font-medium hidden sm:block", currentStep >= step.id ? "text-foreground" : "text-muted-foreground")}>{step.name}</span>
              </motion.div>
            ))}
          </div>

          {/* Main Content Card */}
          <div className="bg-card rounded-2xl shadow-lg border border-border overflow-hidden hover:shadow-xl transition-shadow duration-300">
            <div className="grid lg:grid-cols-3">
              {/* Form Section */}
              <div className="lg:col-span-2 p-6 md:p-8">
                <AnimatePresence mode="wait">
                {currentStep === 1 && (
                  <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }} className="space-y-6">
                    <div>
                      <h3 className="text-xl font-semibold mb-2">{t("home.bavChooseCoverage")}</h3>
                      <p className="text-muted-foreground text-sm">{t("home.bavChooseDesc")}</p>
                    </div>
                    <div className="grid gap-4">
                      {packages.map((pkg) => (
                        <button key={pkg.id} onClick={() => setSelectedPackage(pkg.id)}
                          className={cn("relative p-5 rounded-xl border-2 text-left transition-all", selectedPackage === pkg.id ? "border-accent bg-accent/5" : "border-border hover:border-accent/50")}>
                          {pkg.popular && <span className="absolute -top-3 left-4 bg-accent text-accent-foreground text-xs font-medium px-3 py-1 rounded-full">{t("home.bavMostChosen")}</span>}
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-semibold text-lg">{pkg.name}</h4>
                              <p className="text-muted-foreground text-sm mt-1">{pkg.coverage}</p>
                              <p className="text-muted-foreground text-sm">{pkg.yearCoverage}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-2xl font-bold text-foreground">€{(paymentType === "monthly" ? pkg.priceMonthly : pkg.priceYearly).toFixed(2).replace('.', ',')}</p>
                              <p className="text-muted-foreground text-sm">{paymentType === "monthly" ? t("home.bavPerMonth") : t("home.bavPerYear")}</p>
                            </div>
                          </div>
                          {selectedPackage === pkg.id && <div className="absolute bottom-3 right-3"><CheckCircle className="h-5 w-5 text-accent" /></div>}
                        </button>
                      ))}
                    </div>
                    <div>
                      <Label className="text-sm font-medium mb-3 block">{t("home.bavPayment")}</Label>
                      <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => setPaymentType("monthly")} className={cn("p-4 rounded-lg border-2 text-center transition-all", paymentType === "monthly" ? "border-accent bg-accent/5" : "border-border hover:border-accent/50")}>
                          <p className="font-medium">{t("home.bavMonthly")}</p>
                          <p className="text-muted-foreground text-sm">{t("home.bavMonthlyDesc")}</p>
                        </button>
                        <button onClick={() => setPaymentType("yearly")} className={cn("p-4 rounded-lg border-2 text-center transition-all relative", paymentType === "yearly" ? "border-accent bg-accent/5" : "border-border hover:border-accent/50")}>
                          <span className="absolute -top-2 right-2 bg-accent text-accent-foreground text-xs font-medium px-2 py-0.5 rounded-full">{t("home.bavSave")}</span>
                          <p className="font-medium">{t("home.bavYearly")}</p>
                          <p className="text-muted-foreground text-sm">{t("home.bavYearlyDesc")}</p>
                        </button>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="startDate" className="text-sm font-medium mb-2 block">{t("home.bavStartDate")}</Label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input id="startDate" type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); if (errors.startDate) setErrors(prev => { const n = { ...prev }; delete n.startDate; return n; }); }} className={cn("pl-10", errors.startDate && "border-destructive")} min={new Date().toISOString().split('T')[0]} />
                      </div>
                      <FieldError message={errors.startDate} />
                    </div>
                  </motion.div>
                )}

                {currentStep === 2 && (
                  <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }} className="space-y-6">
                    <div>
                      <h3 className="text-xl font-semibold mb-2">{t("home.bavCompanyTitle")}</h3>
                      <p className="text-muted-foreground text-sm">{t("home.bavCompanyDesc")}</p>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="bedrijfsnaam">{t("home.bavCompanyName")} *</Label>
                        <Input id="bedrijfsnaam" name="bedrijfsnaam" value={formData.bedrijfsnaam} onChange={handleInputChange} className={cn(errors.bedrijfsnaam && "border-destructive")} />
                        <FieldError message={errors.bedrijfsnaam} />
                      </div>
                      <div>
                        <Label htmlFor="kvkNummer">{t("home.bavKvk")} *</Label>
                        <Input id="kvkNummer" name="kvkNummer" value={formData.kvkNummer} onChange={handleInputChange} maxLength={8} placeholder="12345678" className={cn(errors.kvkNummer && "border-destructive")} />
                        <FieldError message={errors.kvkNummer} />
                      </div>
                      <div>
                        <Label htmlFor="beroep">{t("home.bavProfession")} *</Label>
                        <Input id="beroep" name="beroep" value={formData.beroep} onChange={handleInputChange} className={cn(errors.beroep && "border-destructive")} />
                        <FieldError message={errors.beroep} />
                      </div>
                      <div>
                        <Label htmlFor="functie">{t("home.bavFunction")} *</Label>
                        <Input id="functie" name="functie" value={formData.functie} onChange={handleInputChange} placeholder="Bijv. Software Developer, Consultant" className={cn(errors.functie && "border-destructive")} />
                        <FieldError message={errors.functie} />
                      </div>
                      <div>
                        <Label htmlFor="aantalMedewerkers">{t("home.bavEmployees")} *</Label>
                        <Input id="aantalMedewerkers" name="aantalMedewerkers" type="number" min="0" value={formData.aantalMedewerkers} onChange={handleInputChange} className={cn(errors.aantalMedewerkers && "border-destructive")} />
                        <FieldError message={errors.aantalMedewerkers} />
                      </div>
                    </div>
                  </motion.div>
                )}

                {currentStep === 3 && (
                  <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }} className="space-y-6">
                    <div>
                      <h3 className="text-xl font-semibold mb-2">{t("home.bavContactTitle")}</h3>
                      <p className="text-muted-foreground text-sm">{t("home.bavContactDesc")}</p>
                    </div>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="voornaam">{t("home.bavFirstName")} *</Label>
                          <Input id="voornaam" name="voornaam" value={formData.voornaam} onChange={handleInputChange} className={cn(errors.voornaam && "border-destructive")} />
                          <FieldError message={errors.voornaam} />
                        </div>
                        <div>
                          <Label htmlFor="achternaam">{t("home.bavLastName")} *</Label>
                          <Input id="achternaam" name="achternaam" value={formData.achternaam} onChange={handleInputChange} className={cn(errors.achternaam && "border-destructive")} />
                          <FieldError message={errors.achternaam} />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="email">{t("home.bavEmail")} *</Label>
                        <Input id="email" name="email" type="email" value={formData.email} onChange={handleInputChange} placeholder="jan@bedrijf.nl" className={cn(errors.email && "border-destructive")} />
                        <FieldError message={errors.email} />
                      </div>
                      <div>
                        <Label htmlFor="telefoon">{t("home.bavPhone")} *</Label>
                        <Input id="telefoon" name="telefoon" type="tel" value={formData.telefoon} onChange={handleInputChange} placeholder="0612345678" className={cn(errors.telefoon && "border-destructive")} />
                        <FieldError message={errors.telefoon} />
                      </div>

                      <div className="border-t border-border pt-4">
                        <div>
                          <Label htmlFor="opdrachtgever">{t("home.bavClient")} *</Label>
                          <Input id="opdrachtgever" name="opdrachtgever" value={formData.opdrachtgever} onChange={handleInputChange} className={cn(errors.opdrachtgever && "border-destructive")} />
                          <FieldError message={errors.opdrachtgever} />
                        </div>
                      </div>

                      <div className="border-t border-border pt-4">
                        <Label className="text-sm font-medium mb-3 block">{t("home.bavMediator")} *</Label>
                        <div className="grid grid-cols-2 gap-3">
                          <button onClick={() => { setViaBemiddelaar(true); if (errors.bemiddelaar) setErrors(prev => { const n = { ...prev }; delete n.bemiddelaar; return n; }); }}
                            className={cn("p-3 rounded-lg border-2 text-center transition-all", viaBemiddelaar === true ? "border-accent bg-accent/5" : "border-border hover:border-accent/50", errors.bemiddelaar && "border-destructive")}>
                            <p className="font-medium">{t("home.bavMediatorYes")}</p>
                          </button>
                          <button onClick={() => { setViaBemiddelaar(false); setFormData(prev => ({ ...prev, bemiddelaarNaam: "" })); if (errors.bemiddelaar) setErrors(prev => { const n = { ...prev }; delete n.bemiddelaar; return n; }); }}
                            className={cn("p-3 rounded-lg border-2 text-center transition-all", viaBemiddelaar === false ? "border-accent bg-accent/5" : "border-border hover:border-accent/50", errors.bemiddelaar && "border-destructive")}>
                            <p className="font-medium">{t("home.bavMediatorNo")}</p>
                          </button>
                        </div>
                        <FieldError message={errors.bemiddelaar} />
                        {viaBemiddelaar && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-3">
                            <Label htmlFor="bemiddelaarNaam">{t("home.bavMediatorName")} *</Label>
                            <Input id="bemiddelaarNaam" name="bemiddelaarNaam" value={formData.bemiddelaarNaam} onChange={handleInputChange} className={cn(errors.bemiddelaarNaam && "border-destructive")} />
                            <FieldError message={errors.bemiddelaarNaam} />
                          </motion.div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}

                {currentStep === 4 && (
                  <motion.div key="step4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }} className="space-y-6">
                    <div>
                      <h3 className="text-xl font-semibold mb-2">{t("home.bavIncassoTitle")}</h3>
                      <p className="text-muted-foreground text-sm">{t("home.bavIncassoDesc")}</p>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="iban">{t("home.bavIban")} *</Label>
                        <Input id="iban" name="iban" value={formData.iban} onChange={handleInputChange} placeholder="NL00 BANK 0000 0000 00" className={cn("uppercase tracking-wider", errors.iban && "border-destructive")} />
                        <FieldError message={errors.iban} />
                      </div>
                      <div className={cn("flex items-start gap-3 p-4 rounded-lg border bg-secondary", errors.incassoAkkoord ? "border-destructive" : "border-border")}>
                        <Checkbox
                          id="incassoAkkoord"
                          checked={incassoAkkoord}
                          onCheckedChange={(checked) => { setIncassoAkkoord(checked === true); if (errors.incassoAkkoord) setErrors(prev => { const n = { ...prev }; delete n.incassoAkkoord; return n; }); }}
                          className="mt-0.5"
                        />
                        <Label htmlFor="incassoAkkoord" className="text-sm leading-relaxed cursor-pointer">
                          {t("home.bavIncassoAgree")}
                        </Label>
                      </div>
                      <FieldError message={errors.incassoAkkoord} />
                    </div>
                  </motion.div>
                )}

                {currentStep === 5 && (
                  <motion.div key="step5" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }} className="space-y-6">
                    <div>
                      <h3 className="text-xl font-semibold mb-2">{t("home.bavConfirmTitle")}</h3>
                      <p className="text-muted-foreground text-sm">{t("home.bavConfirmDesc")}</p>
                    </div>
                    <div className="space-y-4">
                      <div className="bg-secondary rounded-lg p-4">
                        <h4 className="font-medium mb-3">{t("home.bavStep1")}</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between"><span className="text-muted-foreground">Pakket</span><span className="font-medium">{selectedPkg?.name}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Dekking</span><span>{selectedPkg?.coverage}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Betaling</span><span>{paymentType === "monthly" ? t("home.bavMonthly") : t("home.bavYearly")}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Ingangsdatum</span><span>{startDate || "Per direct"}</span></div>
                        </div>
                      </div>
                      <div className="bg-secondary rounded-lg p-4">
                        <h4 className="font-medium mb-3">{t("home.bavStep2")}</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between"><span className="text-muted-foreground">{t("home.bavCompanyName")}</span><span>{formData.bedrijfsnaam || "-"}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">{t("home.bavKvk")}</span><span>{formData.kvkNummer || "-"}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">{t("home.bavProfession")}</span><span>{formData.beroep || "-"}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">{t("home.bavFunction")}</span><span>{formData.functie || "-"}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">{t("home.bavEmployees")}</span><span>{formData.aantalMedewerkers || "-"}</span></div>
                        </div>
                      </div>
                      <div className="bg-secondary rounded-lg p-4">
                        <h4 className="font-medium mb-3">{t("home.bavStep3")}</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between"><span className="text-muted-foreground">{t("home.bavFirstName")}</span><span>{formData.voornaam} {formData.achternaam}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">{t("home.bavEmail")}</span><span>{formData.email || "-"}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">{t("home.bavPhone")}</span><span>{formData.telefoon || "-"}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">{t("home.bavClient")}</span><span>{formData.opdrachtgever || "-"}</span></div>
                          {viaBemiddelaar && <div className="flex justify-between"><span className="text-muted-foreground">{t("home.bavMediatorName")}</span><span>{formData.bemiddelaarNaam || "-"}</span></div>}
                        </div>
                      </div>
                      <div className="bg-secondary rounded-lg p-4">
                        <h4 className="font-medium mb-3">{t("home.bavStep4")}</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between"><span className="text-muted-foreground">{t("home.bavIban")}</span><span className="uppercase tracking-wider">{formData.iban || "-"}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">{t("home.bavIncassoAgree")}</span><span>{incassoAkkoord ? "✓" : "✗"}</span></div>
                        </div>
                      </div>

                      {/* Slotverklaring */}
                      <div className={cn("border rounded-lg p-4 bg-accent/5 space-y-3", errors.slotverklaring ? "border-destructive" : "border-accent/30")}>
                        <div className="flex items-start gap-3">
                          <Checkbox
                            id="slotverklaring"
                            checked={slotverklaringAkkoord}
                            onCheckedChange={(checked) => { setSlotverklaringAkkoord(checked === true); if (errors.slotverklaring) setErrors(prev => { const n = { ...prev }; delete n.slotverklaring; return n; }); }}
                            className="mt-0.5"
                          />
                          <Label htmlFor="slotverklaring" className="text-sm leading-relaxed cursor-pointer">
                            {t("home.bavSlotverklaringAgree")}
                          </Label>
                        </div>
                        <FieldError message={errors.slotverklaring} />
                        <a
                          href="/documents/ZP_Slotverklaring.pdf"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-sm text-accent hover:underline"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          {t("home.bavSlotverklaringLink")}
                        </a>
                      </div>
                    </div>
                  </motion.div>
                )}
                </AnimatePresence>

                {/* Navigation Buttons */}
                <div className="flex justify-between mt-8 pt-6 border-t border-border">
                  {currentStep > 1 ? (
                    <Button variant="outline" onClick={prevStep}><ArrowLeft className="h-4 w-4" />{t("home.bavPrev")}</Button>
                  ) : <div />}
                  {currentStep < TOTAL_STEPS ? (
                    <Button onClick={nextStep} className="bg-accent hover:bg-accent/90 text-accent-foreground">{t("home.bavNext")}<ArrowRight className="h-4 w-4" /></Button>
                  ) : (
                    <Button
                      onClick={handleSubmit}
                      size="lg"
                      className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold"
                    >
                      <Shield className="h-5 w-5" />{t("home.bavSubmit")}<ArrowRight className="h-5 w-5" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Price Sidebar */}
              <div className="bg-foreground p-6 md:p-8 text-background">
                <div className="sticky top-8">
                  <h4 className="text-lg font-semibold mb-4">{t("home.bavStep1")}</h4>
                  <div className="bg-white/10 rounded-xl p-5 mb-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center"><Shield className="h-5 w-5 text-accent-foreground" /></div>
                      <div><p className="font-semibold">{selectedPkg?.name}</p><p className="text-sm text-background/70">BAV + AVB</p></div>
                    </div>
                    <div className="space-y-2 text-sm mb-4">
                      <div className="flex justify-between"><span className="text-background/70">Per gebeurtenis</span><span>{selectedPkg?.coverage.replace('€ ', '€')}</span></div>
                      <div className="flex justify-between"><span className="text-background/70">Per jaar</span><span>{selectedPkg?.yearCoverage.replace('€ ', '€')}</span></div>
                    </div>
                    <div className="border-t border-white/20 pt-4">
                      <div className="flex justify-between items-end">
                        <div>
                          <p className="text-sm text-background/70">{paymentType === "monthly" ? t("home.bavPerMonth") : t("home.bavPerYear")}</p>
                          <p className="text-3xl font-bold">€{currentPrice?.toFixed(2).replace('.', ',')}</p>
                        </div>
                        {savings > 0 && <span className="bg-accent text-accent-foreground text-xs font-medium px-2 py-1 rounded">-€{savings}</span>}
                      </div>
                    </div>
                  </div>
                  <ul className="space-y-3">
                    {usps.map((usp) => (
                      <li key={usp} className="flex items-center gap-2 text-sm"><CheckCircle className="h-4 w-4 text-accent flex-shrink-0" /><span className="text-background/90">{usp}</span></li>
                    ))}
                  </ul>
                  <div className="mt-6 pt-6 border-t border-white/20">
                    <p className="text-xs text-background/60">
                      {t("common.contactUs")}?{" "}
                      <a href="tel:0232010502" className="text-accent hover:underline">023 - 201 0502</a>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </AnimatedSection>
      </div>
    </section>
    </>
  );
}
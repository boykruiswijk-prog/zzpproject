import { useState, useEffect } from "react";
import { trackBeginWizard, trackWizardComplete } from "@/lib/tracking";
import { formatDateNL } from "@/lib/dateFormat";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Shield, CheckCircle, Building2, User, FileCheck, CreditCard,
  ArrowRight, ArrowLeft, Check, Sparkles, ExternalLink, AlertCircle, HelpCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatedSection } from "@/components/ui/animated-section";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import ellenAvatar from "@/assets/ellen-baars-avatar.jpg";
import { TrustSignalsStrip } from "@/components/social-proof/TrustSignalsStrip";
import { bavPakketten, getPakket, type BavPakketId } from "@/data/bavPakketten";
import { checkAcceptance } from "@/data/acceptanceCriteria";

const formatBedrag = (n: number) => `€${n.toLocaleString("nl-NL")}`;

const TOTAL_STEPS = 5;

type ValidationErrors = Record<string, string>;

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const isValidPhone = (phone: string) => /^[0-9]{10}$/.test(phone.replace(/[\s-]/g, ""));
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
   const { toast } = useToast();
   const [currentStep, setCurrentStep] = useState(1);
   const [gekozenPakketId, setGekozenPakketId] = useState<BavPakketId>("jaarlijks");
   const [startDate, setStartDate] = useState<string>("");
   const [viaBemiddelaar, setViaBemiddelaar] = useState<boolean | null>(null);
   const [incassoAkkoord, setIncassoAkkoord] = useState(false);
   const [slotverklaringAkkoord, setSlotverklaringAkkoord] = useState(false);
   const [errors, setErrors] = useState<ValidationErrors>({});
   const [isSubmitted, setIsSubmitted] = useState(false);
   const [existingCustomerOpen, setExistingCustomerOpen] = useState(false);
   const [isCheckingExisting, setIsCheckingExisting] = useState(false);
   useEffect(() => { trackBeginWizard(); }, []);
  const [formData, setFormData] = useState({
    bedrijfsnaam: "", kvkNummer: "", beroep: "", functie: "", aantalMedewerkers: "",
    voornaam: "", achternaam: "", email: "", telefoon: "",
    opdrachtgever: "", bemiddelaarNaam: "",
    iban: "",
    adresStraat: "", adresHuisnummer: "", adresPostcode: "", adresPlaats: "",
  });

  const VERZEKERINGSKAART_DEFAULT = "/documenten/verzekeringskaart-zakelijke-dienstverlening.pdf";

  const steps = [
    { id: 1, name: t("home.bavStep1"), icon: Shield },
    { id: 2, name: t("home.bavStep2"), icon: Building2 },
    { id: 3, name: t("home.bavStep3"), icon: User },
    { id: 4, name: t("home.bavStep4"), icon: CreditCard },
    { id: 5, name: t("home.bavStep5"), icon: FileCheck },
  ];

  const usps = t("home.bavUsps", { returnObjects: true }) as string[];

  const selectedBavPakket = getPakket(gekozenPakketId);
  const currentPrice = selectedBavPakket.prijs;
  const periodeLabel = selectedBavPakket.periode === "maand" ? t("home.bavPerMonth") : t("home.bavPerYear");
  const betaalwijze: "maandelijks" | "jaarlijks" = selectedBavPakket.periode === "maand" ? "maandelijks" : "jaarlijks";
  const gekozenPakketLabel = selectedBavPakket.name;

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
      const today = new Date().toISOString().split('T')[0];
      const maxDate = new Date();
      maxDate.setMonth(maxDate.getMonth() + 6);
      const maxStr = maxDate.toISOString().split('T')[0];
      if (!startDate) newErrors.startDate = t("bavApp.valStartDate");
      else if (startDate < today) {
        setStartDate(today);
        newErrors.startDate = "De ingangsdatum kan niet in het verleden liggen. Neem contact op als je met terugwerkende kracht wilt verzekeren.";
      } else if (startDate > maxStr) {
        newErrors.startDate = "Kies een datum binnen 6 maanden. Voor latere ingangsdata neem contact op.";
      }
    }

    if (step === 2) {
      if (!formData.bedrijfsnaam.trim()) newErrors.bedrijfsnaam = t("bavApp.valCompanyName");
      if (!formData.kvkNummer.trim()) newErrors.kvkNummer = t("bavApp.valKvk");
      else if (!isValidKvk(formData.kvkNummer)) newErrors.kvkNummer = t("bavApp.valKvkFormat");
      if (!formData.beroep.trim()) newErrors.beroep = t("bavApp.valProfession");
      if (!formData.functie.trim()) newErrors.functie = t("bavApp.valFunction");
      if (!formData.aantalMedewerkers.trim()) newErrors.aantalMedewerkers = t("bavApp.valEmployees");
      else if (parseInt(formData.aantalMedewerkers) < 0) newErrors.aantalMedewerkers = t("bavApp.valEmployeesInvalid");
      if (!formData.adresStraat.trim()) newErrors.adresStraat = "Vul de straatnaam in";
      if (!formData.adresHuisnummer.trim()) newErrors.adresHuisnummer = "Vul het huisnummer in";
      if (!formData.adresPostcode.trim()) newErrors.adresPostcode = "Vul de postcode in";
      else if (!/^[1-9][0-9]{3}\s?[A-Za-z]{2}$/.test(formData.adresPostcode.trim())) newErrors.adresPostcode = "Postcode moet formaat 1234 AB hebben";
      if (!formData.adresPlaats.trim()) newErrors.adresPlaats = "Vul de plaats in";
      // Acceptatie-criteria check op functie tegen afgewezen lijst
      if (formData.functie.trim()) {
        const acc = checkAcceptance(formData.functie);
        if (!acc.accepted) newErrors.functie = acc.reason!;
      }
      // >3 medewerkers blokkeert niet: gebruiker mag door, aanvraag wordt gemarkeerd voor handmatige beoordeling.
    }

    if (step === 3) {
      if (!formData.voornaam.trim()) newErrors.voornaam = t("bavApp.valFirstName");
      if (!formData.achternaam.trim()) newErrors.achternaam = t("bavApp.valLastName");
      if (!formData.email.trim()) newErrors.email = t("bavApp.valEmail");
      else if (!isValidEmail(formData.email)) newErrors.email = t("bavApp.valEmailInvalid");
      if (!formData.telefoon.trim()) newErrors.telefoon = t("bavApp.valPhone");
      else if (!isValidPhone(formData.telefoon)) newErrors.telefoon = t("bavApp.valPhoneFormat");
      if (!formData.opdrachtgever.trim()) newErrors.opdrachtgever = t("bavApp.valClient");
      if (viaBemiddelaar === null) newErrors.bemiddelaar = t("bavApp.valMediator");
      if (viaBemiddelaar && !formData.bemiddelaarNaam.trim()) newErrors.bemiddelaarNaam = t("bavApp.valMediatorName");
    }

     if (step === 4) {
       if (!formData.iban.trim()) newErrors.iban = t("bavApp.valIban");
       else if (!isValidIban(formData.iban)) newErrors.iban = t("bavApp.valIbanInvalid");
       if (!incassoAkkoord) newErrors.incassoAkkoord = t("bavApp.valIncasso");
     }

    if (step === 5) {
      if (!slotverklaringAkkoord) newErrors.slotverklaring = t("bavApp.valSlotverklaring");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const checkExistingCustomer = async (): Promise<boolean> => {
    try {
      setIsCheckingExisting(true);
      const { data } = await supabase.functions.invoke("check-existing-customer", {
        body: { email: formData.email, kvk: formData.kvkNummer },
      });
      return data?.exists === true;
    } catch (err) {
      console.error("check-existing-customer failed:", err);
      return false; // fail-open: blokkeer aanvraag niet bij lookup-fout
    } finally {
      setIsCheckingExisting(false);
    }
  };

  const nextStep = async () => {
    if (!validateStep(currentStep) || currentStep >= TOTAL_STEPS) return;
    // Na stap 3 (email + telefoon ingevuld; KvK kwam in stap 2): duplicate-check.
    if (currentStep === 3) {
      const exists = await checkExistingCustomer();
      if (exists) {
        setExistingCustomerOpen(true);
        return;
      }
    }
    setCurrentStep(currentStep + 1);
  };
  const prevStep = () => { if (currentStep > 1) { setErrors({}); setCurrentStep(currentStep - 1); } };
   const handleSubmit = async () => {
     if (validateStep(currentStep)) {
       try {
         const { data, error } = await supabase.functions.invoke("process-bav-wizard", {
           body: {
             gekozen_pakket: gekozenPakketId,
             betaalwijze,
             ingangsdatum: startDate,
             voornaam: formData.voornaam,
             achternaam: formData.achternaam,
             email: formData.email,
             telefoon: formData.telefoon || null,
             bedrijfsnaam: formData.bedrijfsnaam,
             kvk_nummer: formData.kvkNummer || null,
             beroep: formData.beroep || null,
             adres_straat: formData.adresStraat || null,
             adres_huisnummer: formData.adresHuisnummer || null,
             adres_postcode: formData.adresPostcode || null,
             adres_plaats: formData.adresPlaats || null,
             iban: formData.iban || null,
             sepa_akkoord: incassoAkkoord,
             rekeninghouder: `${formData.voornaam} ${formData.achternaam}`.trim(),
             vereist_handmatige_beoordeling: parseInt(formData.aantalMedewerkers || "0") > 3,
             opmerkingen: [
               formData.opdrachtgever ? `Opdrachtgever: ${formData.opdrachtgever}` : null,
               formData.bemiddelaarNaam ? `Bemiddelaar: ${formData.bemiddelaarNaam}` : null,
               formData.aantalMedewerkers ? `Aantal medewerkers: ${formData.aantalMedewerkers}` : null,
               formData.functie ? `Functie: ${formData.functie}` : null,
             ]
               .filter(Boolean)
               .join("\n") || null,
           },
         });

         if (error) throw error;
         if (!data?.success) throw new Error(data?.error || "Onbekende fout");

         trackWizardComplete(selectedBavPakket.name, selectedBavPakket.prijs);
         setIsSubmitted(true);
       } catch (error) {
         console.error("Error submitting application:", error);
         toast({
           title: "Er ging iets mis",
           description: "Probeer het opnieuw of neem telefonisch contact op: 020 - 457 3077",
           variant: "destructive",
         });
       }
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
            <h2 className="text-xl sm:text-2xl font-bold mb-2">{t("bavApp.thankYou")}</h2>
            <p className="text-muted-foreground text-sm sm:text-base mb-1">
              {t("bavApp.thankYouDesc")} <span className="font-semibold text-foreground">{selectedBavPakket.name}</span> {t("bavApp.thankYouReceived")}
            </p>
            <p className="text-muted-foreground text-xs sm:text-sm mb-6">
              {t("bavApp.thankYouFollowUp")}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <Button variant="accent" size="default" className="w-full sm:w-auto" onClick={() => { setIsSubmitted(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                  <ArrowLeft className="h-4 w-4" />
                  {t("bavApp.backToHome")}
              </Button>
              <Button variant="outline" size="default" asChild className="w-full sm:w-auto">
                <Link to="/contact">
                  {t("bavApp.contactUs")}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={existingCustomerOpen} onOpenChange={setExistingCustomerOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          <div className="flex flex-col items-center text-center px-6 py-8 sm:px-8 sm:py-10">
            <div className="h-16 w-16 rounded-full bg-accent/10 flex items-center justify-center mb-5">
              <Shield className="h-8 w-8 text-accent" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold mb-3">We zien dat je al een polis bij ons hebt</h2>
            <p className="text-muted-foreground text-sm sm:text-base mb-6">
              Voor een tweede polis nemen we graag persoonlijk contact met je op. Of log in op je klantportaal om je bestaande polis te bekijken.
            </p>
            <div className="flex flex-col gap-3 w-full">
              <Button variant="accent" size="default" asChild className="w-full">
                <Link to="/portal/login">Naar klantportaal</Link>
              </Button>
              <Button variant="outline" size="default" asChild className="w-full">
                <a href="https://wa.me/31204573077" target="_blank" rel="noopener noreferrer">
                  WhatsApp ons
                </a>
              </Button>
              <Button variant="ghost" size="sm" asChild className="w-full">
                <a href="tel:+31204573077">Of bel 020 - 457 3077</a>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    <section className="section-padding bg-secondary" id="combinatiepolis">
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
                <Shield className="h-4 w-4" />{t("bavApp.insuranceAndMore")}
              </motion.div>
            </Link>
          </div>
          <h2 className="mb-4">{t("home.bavTitle")} <span className="text-accent">{t("home.bavSubtitle")}</span></h2>
          <p className="text-muted-foreground">{t("home.bavDescription")}</p>
        </AnimatedSection>

        {/* Social proof bar */}
        <AnimatedSection delay={0.15} className="max-w-4xl mx-auto mb-8">
          <div className="bg-card rounded-xl shadow-sm border border-border px-4 py-3 sm:px-6 sm:py-3 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 text-xs sm:text-sm text-foreground">
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {["BK", "RT", "EB", "GJ"].map((label) => label === "EB" ? (
                  <img key={label} src={ellenAvatar} alt="Ellen Baars" className="h-7 w-7 rounded-full border-2 border-background object-cover" />
                ) : (
                  <div key={label} className="h-7 w-7 rounded-full border-2 border-background bg-accent/20 text-accent flex items-center justify-center text-[10px] font-bold">
                    {label}
                  </div>
                ))}
              </div>
              <span className="text-accent tracking-tight" aria-hidden>★★★★★</span>
              <span><span className="font-semibold">5,0/5</span></span>
            </div>
            <span className="hidden sm:inline-block h-4 w-px bg-border" aria-hidden />
            <div className="flex items-center gap-2">
              <span aria-hidden>👥</span>
              <span><span className="font-semibold">5.000+</span> tevreden zzp'ers</span>
            </div>
            <span className="hidden sm:inline-block h-4 w-px bg-border" aria-hidden />
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-accent" aria-hidden />
              <span>AFM geregistreerd · Nr. 12050636</span>
            </div>
          </div>
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
                    <div className="grid sm:grid-cols-3 gap-4">
                      {bavPakketten.map((pkg) => {
                        const isSelected = gekozenPakketId === pkg.id;
                        return (
                          <button
                            key={pkg.id}
                            type="button"
                            onClick={() => setGekozenPakketId(pkg.id)}
                            className={cn(
                              "relative p-5 rounded-xl border-2 text-left transition-all flex flex-col",
                              isSelected
                                ? "border-[#16A34A] bg-[#F0FDF4] shadow-md"
                                : "border-border hover:border-accent/50 bg-card"
                            )}
                          >
                            {pkg.label && (
                              <span
                                className={cn(
                                  "absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap",
                                  pkg.id === "jaarlijks-cyber"
                                    ? "bg-accent text-accent-foreground"
                                    : "bg-primary text-primary-foreground"
                                )}
                              >
                                {pkg.label}
                              </span>
                            )}
                            <div className="mb-3 flex items-center gap-2">
                              <div className="h-9 w-9 rounded-lg bg-accent/10 flex items-center justify-center">
                                <Shield className="h-4 w-4 text-accent" />
                              </div>
                              <h4 className="font-semibold text-sm leading-tight">{pkg.name}</h4>
                            </div>
                            <p className="text-2xl font-bold text-foreground mb-3">
                              €{pkg.prijs}
                              <span className="text-xs font-normal text-muted-foreground"> / {pkg.periode}</span>
                            </p>
                            <ul className="space-y-1.5 text-xs text-muted-foreground">
                              <li className="flex items-start gap-1.5">
                                <Check className="h-3.5 w-3.5 text-accent mt-0.5 flex-shrink-0" />
                                <span>BAV <span className="whitespace-nowrap">{formatBedrag(pkg.dekkingen.bav.perGebeurtenis)}</span></span>
                              </li>
                              <li className="flex items-start gap-1.5">
                                <Check className="h-3.5 w-3.5 text-accent mt-0.5 flex-shrink-0" />
                                <span>AVB <span className="whitespace-nowrap">{formatBedrag(pkg.dekkingen.avb.perGebeurtenis)}</span></span>
                              </li>
                              {pkg.dekkingen.cyber && (
                                <li className="flex items-start gap-1.5">
                                  <Check className="h-3.5 w-3.5 text-accent mt-0.5 flex-shrink-0" />
                                  <span>Cyber tot <span className="whitespace-nowrap">{formatBedrag(pkg.dekkingen.cyber.perJaar)}</span>/jr</span>
                                </li>
                              )}
                            </ul>
                            {isSelected && (
                              <div className="absolute top-3 right-3">
                                <CheckCircle className="h-5 w-5 text-[#16A34A]" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    <div>
                       <Label htmlFor="startDate" className="text-sm font-medium mb-2 block">{t("home.bavStartDate")}</Label>
                       <div className="relative">
                        <Input
                          id="startDate"
                          type="date"
                          min={new Date().toISOString().split('T')[0]}
                          max={(() => { const d = new Date(); d.setMonth(d.getMonth() + 6); return d.toISOString().split('T')[0]; })()}
                          value={startDate}
                          onChange={(e) => {
                            setStartDate(e.target.value);
                            if (errors.startDate) setErrors(prev => { const n = { ...prev }; delete n.startDate; return n; });
                          }}
                          onBlur={(e) => {
                            const today = new Date().toISOString().split('T')[0];
                            const max = new Date(); max.setMonth(max.getMonth() + 6);
                            const maxStr = max.toISOString().split('T')[0];
                            if (e.target.value && e.target.value < today) {
                              setStartDate(today);
                              setErrors(prev => ({ ...prev, startDate: "De ingangsdatum kan niet in het verleden liggen. Neem contact op als je met terugwerkende kracht wilt verzekeren." }));
                            } else if (e.target.value && e.target.value > maxStr) {
                              setErrors(prev => ({ ...prev, startDate: "Kies een datum binnen 6 maanden. Voor latere ingangsdata neem contact op." }));
                            }
                          }}
                          className={cn(errors.startDate && "border-destructive")}
                        />
                       </div>
                       {errors.startDate ? (
                         <p className="text-xs mt-1.5" style={{ color: '#E53E2F' }}>{errors.startDate}</p>
                       ) : null}
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
                      <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-2">
                          <Label htmlFor="adresStraat">Straat *</Label>
                          <Input id="adresStraat" name="adresStraat" value={formData.adresStraat} onChange={handleInputChange} className={cn(errors.adresStraat && "border-destructive")} />
                          <FieldError message={errors.adresStraat} />
                        </div>
                        <div>
                          <Label htmlFor="adresHuisnummer">Huisnr. *</Label>
                          <Input id="adresHuisnummer" name="adresHuisnummer" value={formData.adresHuisnummer} onChange={handleInputChange} className={cn(errors.adresHuisnummer && "border-destructive")} />
                          <FieldError message={errors.adresHuisnummer} />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <Label htmlFor="adresPostcode">Postcode *</Label>
                          <Input id="adresPostcode" name="adresPostcode" value={formData.adresPostcode} onChange={handleInputChange} placeholder="1234 AB" className={cn("uppercase", errors.adresPostcode && "border-destructive")} />
                          <FieldError message={errors.adresPostcode} />
                        </div>
                        <div className="col-span-2">
                          <Label htmlFor="adresPlaats">Plaats *</Label>
                          <Input id="adresPlaats" name="adresPlaats" value={formData.adresPlaats} onChange={handleInputChange} className={cn(errors.adresPlaats && "border-destructive")} />
                          <FieldError message={errors.adresPlaats} />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="beroep">{t("home.bavProfession")} *</Label>
                        <Input id="beroep" name="beroep" value={formData.beroep} onChange={handleInputChange} className={cn(errors.beroep && "border-destructive")} />
                        <FieldError message={errors.beroep} />
                      </div>
                      <div>
                        <Label htmlFor="functie">{t("home.bavFunction")} *</Label>
                        <Input id="functie" name="functie" value={formData.functie} onChange={handleInputChange} placeholder={t("bavApp.functionPlaceholder")} className={cn(errors.functie && "border-destructive")} />
                        <FieldError message={errors.functie} />
                      </div>
                      <div>
                        <Label htmlFor="aantalMedewerkers">{t("home.bavEmployees")} *</Label>
                        <Input
                          id="aantalMedewerkers"
                          name="aantalMedewerkers"
                          type="number"
                          min="0"
                          value={formData.aantalMedewerkers}
                          onChange={handleInputChange}
                          className={cn(
                            errors.aantalMedewerkers && "border-destructive",
                            !errors.aantalMedewerkers && formData.aantalMedewerkers && parseInt(formData.aantalMedewerkers) > 3 && "border-orange-400 focus-visible:ring-orange-400"
                          )}
                        />
                        <FieldError message={errors.aantalMedewerkers} />
                        {formData.aantalMedewerkers && parseInt(formData.aantalMedewerkers) > 3 && (
                          <div className="mt-2 flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-md border border-orange-300 bg-orange-50">
                            <div className="flex items-start gap-2 flex-1">
                              <HelpCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-orange-600" />
                              <p className="text-sm text-orange-900">
                                Bij meer dan 3 medewerkers maken we graag een persoonlijk voorstel. We helpen je graag verder.
                              </p>
                            </div>
                            <Button variant="outline" size="sm" asChild className="flex-shrink-0 border-orange-400 text-orange-700 hover:bg-orange-100">
                              <Link to="/contact">Neem contact op</Link>
                            </Button>
                          </div>
                        )}
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
                            style={viaBemiddelaar === true ? { borderColor: '#16A34A', backgroundColor: '#F0FDF4', color: '#16A34A' } : undefined}
                            className={cn("p-3 rounded-lg border-2 text-center transition-all", viaBemiddelaar !== true && "border-border hover:border-accent/50 bg-card", errors.bemiddelaar && viaBemiddelaar !== true && "border-destructive")}>
                            <p className="font-medium">{t("home.bavMediatorYes")}</p>
                          </button>
                          <button onClick={() => { setViaBemiddelaar(false); setFormData(prev => ({ ...prev, bemiddelaarNaam: "" })); if (errors.bemiddelaar) setErrors(prev => { const n = { ...prev }; delete n.bemiddelaar; return n; }); }}
                            style={viaBemiddelaar === false ? { borderColor: '#16A34A', backgroundColor: '#F0FDF4', color: '#16A34A' } : undefined}
                            className={cn("p-3 rounded-lg border-2 text-center transition-all", viaBemiddelaar !== false && "border-border hover:border-accent/50 bg-card", errors.bemiddelaar && viaBemiddelaar !== false && "border-destructive")}>
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
                          <div className="flex justify-between"><span className="text-muted-foreground">{t("bavApp.package")}</span><span className="font-medium">{gekozenPakketLabel}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">{t("bavApp.coverage")}</span><span>BAV {formatBedrag(selectedBavPakket.dekkingen.bav.perGebeurtenis)} / AVB {formatBedrag(selectedBavPakket.dekkingen.avb.perGebeurtenis)}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">{t("bavApp.payment")}</span><span>{selectedBavPakket.prijsLabel}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">{t("bavApp.startDate")}</span><span>{startDate ? formatDateNL(startDate) : t("bavApp.immediately")}</span></div>
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

                      {/* Belangrijke documenten, Deel 6 */}
                      <div className="border border-border rounded-lg p-4 bg-background space-y-3">
                        <h4 className="font-semibold text-sm">Belangrijke documenten om door te lezen</h4>
                        <p className="text-xs text-muted-foreground">
                          Door op 'Verstuur aanvraag' te klikken bevestig je dat je deze documenten hebt gelezen.
                        </p>
                        <div className="grid sm:grid-cols-2 gap-2">
                          {/* TODO: Boy upload PDFs naar /public/documenten/ */}
                          {[
                            { href: "/documenten/slotverklaring-2026.pdf", title: "Slotverklaring 2026" },
                            { href: "/documenten/dienstverleningsdocument.pdf", title: "Dienstverleningsdocument" },
                            { href: VERZEKERINGSKAART_DEFAULT, title: "Verzekeringskaart Beroepsaansprakelijkheid" },
                            { href: "/documenten/verzekeringskaart-bedrijfsaansprakelijkheid.pdf", title: "Verzekeringskaart Bedrijfsaansprakelijkheid" },
                          ].map((doc) => (
                            <a
                              key={doc.href + doc.title}
                              href={doc.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 p-2 rounded border border-border hover:border-accent hover:bg-accent/5 transition-colors text-xs"
                            >
                              <FileCheck className="h-4 w-4 text-accent flex-shrink-0" />
                              <span className="truncate">{doc.title}</span>
                              <ExternalLink className="h-3 w-3 ml-auto flex-shrink-0 opacity-60" />
                            </a>
                          ))}
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
                            Ik bevestig dat ik de slotverklaring, het dienstverleningsdocument en de verzekeringskaart heb gelezen.
                          </Label>
                        </div>
                        <FieldError message={errors.slotverklaring} />
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
                    <Button
                      onClick={nextStep}
                      disabled={currentStep === 1 && !!startDate && startDate < new Date().toISOString().split('T')[0]}
                      className="bg-accent hover:bg-accent/90 text-accent-foreground"
                    >{t("home.bavNext")}<ArrowRight className="h-4 w-4" /></Button>
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
                {currentStep === TOTAL_STEPS && (
                  <div className="mt-6">
                    <TrustSignalsStrip compact />
                  </div>
                )}
              </div>

              {/* Price Sidebar */}
              <div className="bg-foreground p-6 md:p-8 text-background">
                <div className="sticky top-8">
                  <h4 className="text-lg font-semibold mb-4">{t("home.bavStep1")}</h4>
                  <div className="bg-white/10 rounded-xl p-5 mb-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center"><Shield className="h-5 w-5 text-accent-foreground" /></div>
                      <div><p className="font-semibold">{selectedBavPakket.name}</p><p className="text-sm text-background/70">BAV + AVB{selectedBavPakket.dekkingen.cyber ? " + Cyber" : ""}</p></div>
                    </div>
                    <div className="space-y-3 text-sm mb-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-background/70">BAV per gebeurtenis</span>
                        <span className="font-semibold whitespace-nowrap">{formatBedrag(selectedBavPakket.dekkingen.bav.perGebeurtenis)}</span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-background/70">AVB per gebeurtenis</span>
                        <span className="font-semibold whitespace-nowrap">{formatBedrag(selectedBavPakket.dekkingen.avb.perGebeurtenis)}</span>
                      </div>
                      {selectedBavPakket.dekkingen.cyber && (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-background/70">Cyber per jaar</span>
                          <span className="font-semibold whitespace-nowrap">{formatBedrag(selectedBavPakket.dekkingen.cyber.perJaar)}</span>
                        </div>
                      )}
                    </div>
                    <div className="border-t border-white/20 pt-4">
                      <div className="flex flex-col gap-1">
                        <p className="text-sm text-background/70">{periodeLabel}</p>
                        <p className="text-3xl font-bold whitespace-nowrap">€{Number.isInteger(currentPrice) ? currentPrice : currentPrice.toFixed(2).replace('.', ',')}</p>
                      </div>
                    </div>
                  </div>

                  <ul className="space-y-3">
                    {usps.map((usp) => (
                      <li key={usp} className="flex items-center gap-2 text-sm"><CheckCircle className="h-4 w-4 text-accent flex-shrink-0" /><span className="text-background/90">{usp}</span></li>
                    ))}
                  </ul>
                  <div className="mt-6 -mx-6 md:-mx-8 -mb-6 md:-mb-8 px-6 md:px-8 py-4" style={{ backgroundColor: '#16A34A' }}>
                    <p className="text-xs text-white">
                      {t("common.contactUs")}?{" "}
                      <a href="tel:0204573077" className="text-white font-semibold hover:underline">020 - 457 3077</a>
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
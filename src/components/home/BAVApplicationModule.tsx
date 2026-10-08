import { isValidIban as isValidSepaIban } from "@/lib/sepaMachtiging";
import { SITE_CONFIG } from "@/config/site";
import { CyberVragen } from "@/components/verzekeringen/CyberVragen";
import { CYBER_AKKOORD, CYBER_DEKKING, CYBER_HULP, CYBER_POLISVOORWAARDEN, CYBER_LOOPTIJD, CYBER_AFGEWEZEN, CYBER_VRAGEN, beoordeelCyber, basisPakket, aanvraagPremie, formatPremieBedrag, type CyberAntwoorden } from "../../../supabase/functions/_shared/cyber";
import { useState, useEffect, useRef } from "react";
import { SepaMachtigingBlok, bouwFrontendMachtiging } from "@/components/shared/SepaMachtigingBlok";
import { mandaatkenmerkVoor, redenBav } from "@/lib/sepaMachtiging";
import { trackBeginCheckout, trackWizardStep, trackWizardValidationError, trackAddPaymentInfo, trackPurchase } from "@/lib/tracking";
import { leesAttributie } from "@/lib/attributie";
import { isNlTelefoon, normaliseerNlTelefoon } from "../../../supabase/functions/_shared/telefoon";
import { formatDateNL } from "@/lib/dateFormat";
import { Link, useLocation } from "react-router-dom";
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
import ellenAvatar from "@/assets/ellen-baars-avatar.webp";
import { TrustSignalsStrip } from "@/components/social-proof/TrustSignalsStrip";
import { bavPakketten, getPakket, type BavPakketId } from "@/data/bavPakketten";
import { STARTER, STARTER_VOORBEHOUD_TEKST, STARTER_VOORWAARDE_TEKST, isStarter, starterTot } from "@/lib/starterTarief";
import { checkAcceptance } from "@/data/acceptanceCriteria";
import { useFormGuard } from "@/lib/antiSpam";
import { maakFormulier } from "../../../supabase/functions/_shared/leadVelden";

import { HoneypotField } from "@/components/shared/HoneypotField";
import { WIZARD_SECTOREN, verzekeringskaartVoorSector, isHandmatigeAcceptatieSector } from "@/data/sectorVerzekeringskaart";
import { LocalizedLink } from "@/components/LocalizedLink";
import { usePdokAdres } from "@/hooks/usePdokAdres";
import { AdresGevonden } from "@/components/AdresGevonden";
import { normaliseerPostcode } from "@/lib/adresNormalisatie";

const formatBedrag = (n: number) => `€${n.toLocaleString("nl-NL")}`;
/** Compacte bedragen: 5.000.000 → "€5M", 2.500.000 → "€2,5M". */
const formatMiljoen = (n: number) => n >= 1_000_000 ? `€${(n / 1_000_000).toLocaleString("nl-NL", { maximumFractionDigits: 1 })}M` : formatBedrag(n);
const formatPerMaand = (jaar: number) => formatPremieBedrag(jaar / 12);

const TOTAL_STEPS = 5;

type ValidationErrors = Record<string, string>;

export function zichtbareBavUsps(usps: string[], sector: string): string[] {
  return usps.map((usp, index) => index === 2 && isHandmatigeAcceptatieSector(sector)
    ? "Binnen 24 uur hoor je van ons"
    : usp);
}

const CONCEPT_KEY = "zp_aanvraag_concept_id";
const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const isValidPhone = isNlTelefoon;
const isValidKvk = (kvk: string) => /^[0-9]{8}$/.test(kvk.trim());
// Zelfde mod-97-controle als de server (anders slaagt de stap hier en weigert de server).
const isValidIban = isValidSepaIban;

/** Documenten die in stap 5 getoond worden; ook meegestuurd als bewijs. Kaart BAV hangt af van de sector. */
function wizardDocumenten(sectorId: string) {
  const kaart = verzekeringskaartVoorSector(sectorId);
  return [
    { href: "/documenten/slotverklaring-2026.pdf", title: "Slotverklaring 2026" },
    { href: "/documenten/dienstverleningsdocument.pdf", title: "Dienstverleningsdocument" },
    ...(kaart ? [{ href: kaart.path, title: `Verzekeringskaart Beroepsaansprakelijkheid – ${kaart.brancheNaam}` }] : []),
    { href: "/documenten/Verzekeringskaart-bedrijfsaansprakelijkheid-HAVB-08B.pdf", title: "Verzekeringskaart Bedrijfsaansprakelijkheid" },
  ];
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="text-sm text-destructive flex items-center gap-1 mt-1">
      <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
      {message}
    </p>
  );
}

export function BAVApplicationModule({ initialSector = "" }: { initialSector?: string } = {}) {
   const { t } = useTranslation();
   const { toast } = useToast();
   const [currentStep, setCurrentStep] = useState(1);
   const [gekozenPakketId, setGekozenPakketId] = useState<BavPakketId>(() => {
     // Pakketkeuze vanuit een link (#combinatiepolis?pakket=…), anders maandelijks.
     if (typeof window !== "undefined") {
       const m = window.location.hash.match(/pakket=([\w-]+)/);
       const p = m && bavPakketten.find((x) => x.id === m[1]);
       if (p) return p.id;
     }
     return "maandelijks";
   });
   // Ook na de eerste render reageren op een pakket-link (#combinatiepolis?pakket=<id>); ongeldige id negeren.
   const routerLocatie = useLocation();
   useEffect(() => {
     const pas = () => {
       const m = window.location.hash.match(/pakket=([\w-]+)/);
       const p = m && bavPakketten.find((x) => x.id === m[1]);
       if (p) setGekozenPakketId(p.id);
     };
     pas();
     window.addEventListener("hashchange", pas);
     return () => window.removeEventListener("hashchange", pas);
   }, [routerLocatie.hash, routerLocatie.key]);
   const [startDate, setStartDate] = useState<string>("");
   const [viaBemiddelaar, setViaBemiddelaar] = useState<boolean | null>(null);
   const [incassoAkkoord, setIncassoAkkoord] = useState(false);
   const [clientAkkoordOp, setClientAkkoordOp] = useState<string | null>(null);
   // Lead-UUID vooraf bepalen: basis voor het mandaatkenmerk dat de klant te zien krijgt.
   const [leadId] = useState<string>(() => crypto.randomUUID());
   const [slotverklaringAkkoord, setSlotverklaringAkkoord] = useState(false);
   const [cyberAntwoorden, setCyberAntwoorden] = useState<CyberAntwoorden>({});
   const [cyberAkkoordOp, setCyberAkkoordOp] = useState<string | null>(null);
   const [cyberAangevraagd, setCyberAangevraagd] = useState(false);
   const [cyberAfgewezen, setCyberAfgewezen] = useState(false);
   const [errors, setErrors] = useState<ValidationErrors>({});
   const [isSubmitted, setIsSubmitted] = useState(false);
   const [submissionResult, setSubmissionResult] = useState<{ reference: string; mandaatkenmerk?: string; handmatig?: boolean; starter?: boolean; cyber?: boolean; cyberAfgewezen?: boolean } | null>(null);
   const [isSubmitting, setIsSubmitting] = useState(false);
   const guard = useFormGuard();
   const [existingCustomerOpen, setExistingCustomerOpen] = useState(false);
   const [magicLinkSending, setMagicLinkSending] = useState(false);
   const [magicLinkSent, setMagicLinkSent] = useState(false);
   const checkoutGestart = useRef(false);
  const [formData, setFormData] = useState({
    bedrijfsnaam: "", kvkNummer: "", kvkStartdatum: "", sector: initialSector, beroep: "", functie: "", aantalMedewerkers: "",
    voornaam: "", achternaam: "", email: "", telefoon: "",
    opdrachtgever: "", bemiddelaarNaam: "",
    iban: "",
    adresStraat: "", adresHuisnummer: "", adresPostcode: "", adresPlaats: "", adresLand: "Nederland",
    rekeninghouder: "",
  });
  // PDOK-suggestie: vult straat/plaats zichtbaar in; klant kan daarna vrij wijzigen.
  const pdokAdres = usePdokAdres(formData.adresPostcode, formData.adresHuisnummer, formData.adresLand);
  useEffect(() => {
    if (!pdokAdres) return;
    setFormData(prev => ({ ...prev, adresStraat: pdokAdres.straat, adresPlaats: pdokAdres.plaats, adresPostcode: pdokAdres.postcode }));
    setErrors(prev => { const next = { ...prev }; delete next.adresStraat; delete next.adresPlaats; delete next.adresPostcode; return next; });
  }, [pdokAdres]);
  // KVK leidend: na een geldig KVK-nummer naam, adres en inschrijvingsdatum uit het handelsregister vooraf invullen.
  const [kvkStatus, setKvkStatus] = useState<string | null>(null);
  useEffect(() => {
    const nr = formData.kvkNummer.trim();
    if (!isValidKvk(nr)) { setKvkStatus(null); return; }
    let weg = false;
    const h = setTimeout(async () => {
      setKvkStatus("Gegevens ophalen bij de KVK...");
      const { data } = await supabase.functions.invoke("kvk-basisprofiel", { body: { modus: "opzoeken", kvk_nummer: nr } }).catch(() => ({ data: null }));
      if (weg) return;
      const p = data?.ok ? data.profiel : null;
      if (!p) { setKvkStatus(data?.reden === "niet_gevonden" ? "Dit KVK-nummer vinden we niet in het handelsregister. Controleer het nummer." : "KVK-controle niet beschikbaar. Vul je gegevens zelf in."); return; }
      const a = p.bezoekadres;
      setFormData(prev => ({
        ...prev,
        bedrijfsnaam: p.naam || prev.bedrijfsnaam,
        kvkStartdatum: p.startdatum || prev.kvkStartdatum,
        ...(a?.postcode ? { adresStraat: a.straat || "", adresHuisnummer: a.huisnummer || "", adresPostcode: a.postcode, adresPlaats: a.plaats || "", adresLand: "Nederland" } : {}),
      }));
      setKvkStatus(a?.postcode ? "Naam, adres en startdatum ingevuld uit het KVK-handelsregister."
        : p.adres_afgeschermd ? "Naam en startdatum ingevuld uit het KVK-handelsregister. Je adres is afgeschermd; vul het zelf in."
        : "Naam en startdatum ingevuld uit het KVK-handelsregister.");
    }, 400);
    return () => { weg = true; clearTimeout(h); };
  }, [formData.kvkNummer]);


  const steps = [
    { id: 1, name: t("home.bavStep1"), icon: Shield },
    { id: 2, name: t("home.bavStep2"), icon: Building2 },
    { id: 3, name: t("home.bavStep3"), icon: User },
    { id: 4, name: t("home.bavStep4"), icon: CreditCard },
    { id: 5, name: t("home.bavStep5"), icon: FileCheck },
  ];

  const usps = zichtbareBavUsps(
    t("home.bavUsps", { returnObjects: true }) as string[],
    formData.sector,
  );

  const selectedBavPakket = getPakket(gekozenPakketId);
  const currentPrice = aanvraagPremie(gekozenPakketId, !!startDate && isStarter(formData.kvkStartdatum || null, startDate)).totaal;
  const heeftCyber = !!selectedBavPakket.dekkingen.cyber;
  const kiesPakket = (id: BavPakketId) => {
    setGekozenPakketId(id); setCyberAangevraagd(!!getPakket(id).dekkingen.cyber);
    setCyberAfgewezen(false); setCyberAkkoordOp(null);
  };
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
      if (heeftCyber && !beoordeelCyber(cyberAntwoorden).volledig) newErrors.cyber = "Beantwoord alle vragen over cyberdekking";
      const today = new Date().toISOString().split('T')[0];
      const maxDate = new Date();
      maxDate.setMonth(maxDate.getMonth() + 6);
      const maxStr = maxDate.toISOString().split('T')[0];
      if (!startDate) newErrors.startDate = t("bavApp.valStartDate");
      else if (startDate < today) {
        setStartDate(today);
        newErrors.startDate = `Online kan de ingangsdatum niet in het verleden liggen. Heb je een vraag, bel ${SITE_CONFIG.phoneDisplay}.`;
      } else if (startDate > maxStr) {
        newErrors.startDate = "Kies een datum binnen 6 maanden. Voor latere ingangsdata neem contact op.";
      }
      if (!formData.email.trim()) newErrors.email = t("bavApp.valEmail");
      else if (!isValidEmail(formData.email)) newErrors.email = t("bavApp.valEmailInvalid");
      if (!formData.telefoon.trim()) newErrors.telefoon = t("bavApp.valPhone");
      else if (!isValidPhone(formData.telefoon)) newErrors.telefoon = t("bavApp.valPhoneFormat");
    }

    if (step === 2) {
      if (!formData.bedrijfsnaam.trim()) newErrors.bedrijfsnaam = t("bavApp.valCompanyName");
      if (!formData.kvkNummer.trim()) newErrors.kvkNummer = t("bavApp.valKvk");
      else if (!isValidKvk(formData.kvkNummer)) newErrors.kvkNummer = t("bavApp.valKvkFormat");
      if (formData.kvkStartdatum && (!/^\d{4}-\d{2}-\d{2}$/.test(formData.kvkStartdatum) || formData.kvkStartdatum > new Date().toISOString().slice(0, 10) || formData.kvkStartdatum < "1900-01-01")) newErrors.kvkStartdatum = "Vul een geldige startdatum in die niet in de toekomst ligt";
      if (!verzekeringskaartVoorSector(formData.sector)) newErrors.sector = "Kies je sector";
      if (!formData.beroep.trim()) newErrors.beroep = t("bavApp.valProfession");
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
      if (viaBemiddelaar && !formData.bemiddelaarNaam.trim()) newErrors.bemiddelaarNaam = t("bavApp.valMediatorName");
    }

     if (step === 4) {
       if (!formData.iban.trim()) newErrors.iban = t("bavApp.valIban");
       else if (!isValidIban(formData.iban)) newErrors.iban = t("bavApp.valIbanInvalid");
       if (!formData.rekeninghouder.trim()) newErrors.rekeninghouder = "Vul de naam van de rekeninghouder in";
       if (!formData.adresLand.trim()) newErrors.adresLand = "Vul het land in";
       if (!incassoAkkoord) newErrors.incassoAkkoord = "Vink het vakje aan om de SEPA-machtiging te geven";
     }

    if (step === 5) {
      if (heeftCyber && !cyberAkkoordOp) newErrors.cyberAkkoord = "Bevestig de afzonderlijke looptijd van cyber";
      // Akkoord nooit zonder de juiste kaart: sector moet een bestaande kaart opleveren.
      if (!verzekeringskaartVoorSector(formData.sector)) newErrors.slotverklaring = "Kies eerst je sector in stap 2";
      else if (!slotverklaringAkkoord) newErrors.slotverklaring = t("bavApp.valSlotverklaring");
    }

    setErrors(newErrors);
    for (const veld of Object.keys(newErrors)) trackWizardValidationError(step, veld);
    return Object.keys(newErrors).length === 0;
  };

  // De losse "bent u al klant?"-check is verwijderd: die maakte het van buitenaf
  // mogelijk om e-mailadressen en KvK-nummers af te tasten. De dubbelcheck
  // gebeurt nu server-side bij het versturen van de aanvraag.
  const wizardRef = useRef<HTMLDivElement>(null);
  const successRef = useRef<HTMLDivElement>(null);
  const successHeadingRef = useRef<HTMLHeadingElement>(null);
  const stapGewisseld = useRef(false);
  // Voorstel rekeninghouder: zichtbaar en wijzigbaar, alleen invullen zolang de klant het veld niet zelf heeft aangepast.
  const rekeninghouderAangepast = useRef(false);
  const rekeninghouderVoorstel = formData.bedrijfsnaam.trim() || `${formData.voornaam} ${formData.achternaam}`.trim();
  useEffect(() => {
    if (currentStep !== 4 || rekeninghouderAangepast.current) return;
    setFormData(prev => prev.rekeninghouder === rekeninghouderVoorstel ? prev : { ...prev, rekeninghouder: rekeninghouderVoorstel });
  }, [currentStep, rekeninghouderVoorstel]);
  useEffect(() => {
    if (!stapGewisseld.current) return;
    const el = wizardRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    // Wacht op de stap-animatie; dan focus op de kop van de nieuwe stap.
    const t = window.setTimeout(() => {
      el.querySelector<HTMLElement>("[data-step-heading]")?.focus({ preventScroll: true });
    }, 350);
    return () => window.clearTimeout(t);
  }, [currentStep]);
  useEffect(() => {
    if (!isSubmitted) return;
    successRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    const timer = window.setTimeout(() => successHeadingRef.current?.focus({ preventScroll: true }), 350);
    return () => window.clearTimeout(timer);
  }, [isSubmitted]);

  // begin_checkout pas bij de eerste echte interactie met het formulier.
  function startCheckout() {
    if (checkoutGestart.current) return;
    checkoutGestart.current = true;
    trackBeginCheckout(gekozenPakketId, verzekeringskaartVoorSector(formData.sector)?.sector.label ?? "");
  }

  // Halve aanvraag tussentijds bewaren (aanvraag_concepten), zodra er een geldig e-mailadres of
  // telefoonnummer staat. Nooit IBAN, rekeninghouder of SEPA-gegevens. Idempotent op het concept-id.
  const conceptId = useRef<string>("");
  const laatsteConcept = useRef("");
  useEffect(() => {
    if (isSubmitted) return;
    const emailOk = isValidEmail(formData.email.trim());
    const telOk = isNlTelefoon(formData.telefoon);
    if (!emailOk && !telOk) return;
    const row = {
      stap: currentStep,
      email: emailOk ? formData.email.trim() : "",
      telefoon: telOk ? normaliseerNlTelefoon(formData.telefoon) : "",
      voornaam: formData.voornaam, achternaam: formData.achternaam,
      bedrijfsnaam: formData.bedrijfsnaam, kvk: formData.kvkNummer,
      pakket: gekozenPakketId,
      sector: verzekeringskaartVoorSector(formData.sector)?.sector.label ?? formData.sector,
      pagina: window.location.pathname,
    };
    const sleutel = JSON.stringify(row);
    if (sleutel === laatsteConcept.current) return;
    const timer = window.setTimeout(() => {
      try {
        if (!conceptId.current) {
          conceptId.current = sessionStorage.getItem(CONCEPT_KEY) || crypto.randomUUID();
          sessionStorage.setItem(CONCEPT_KEY, conceptId.current);
        }
      } catch { if (!conceptId.current) conceptId.current = crypto.randomUUID(); }
      laatsteConcept.current = sleutel;
      supabase.functions.invoke("submit-public-form", {
        body: { table: "aanvraag_concepten", hp: guard.honeypot, row: { id: conceptId.current, ...row }, attributie: leesAttributie() },
      }).catch(() => { /* tussentijds opslaan mag de aanvraag nooit hinderen */ });
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [currentStep, formData.email, formData.telefoon, formData.voornaam, formData.achternaam, formData.bedrijfsnaam, formData.kvkNummer, formData.sector, gekozenPakketId, isSubmitted, guard.honeypot]);

  const nextStep = async () => {
    if (!validateStep(currentStep) || currentStep >= TOTAL_STEPS) return;
    if (currentStep === 1 && heeftCyber && !beoordeelCyber(cyberAntwoorden).toegestaan) {
      setCyberAangevraagd(true); setCyberAfgewezen(true); setCyberAkkoordOp(null);
      setGekozenPakketId(basisPakket(gekozenPakketId));
    }
    trackWizardStep(currentStep, steps[currentStep - 1]?.name ?? "");
    if (currentStep === 4) trackAddPaymentInfo(gekozenPakketId, currentPrice);
    stapGewisseld.current = true;
    setCurrentStep(currentStep + 1);
  };
  const prevStep = () => { if (currentStep > 1) { setErrors({}); stapGewisseld.current = true; setCurrentStep(currentStep - 1); } };
   const betaalwijzeIsMaand = selectedBavPakket.periode === "maand";
   const starterVanToepassing = !!startDate && isStarter(formData.kvkStartdatum || null, startDate);
   const handleSubmit = async () => {
     if (isSubmitting) return;
     if (!validateStep(currentStep)) return;
     trackWizardStep(currentStep, steps[currentStep - 1]?.name ?? "");
     setIsSubmitting(true);
     try {
       const { data, error } = await supabase.functions.invoke("process-bav-wizard", {
         body: {
           hp: guard.honeypot,
           ms: guard.elapsedMs(),
           gekozen_pakket: gekozenPakketId,
            cyber_aangevraagd: cyberAangevraagd || heeftCyber,
            cyber_antwoorden: cyberAntwoorden,
            cyber_akkoord: !!cyberAkkoordOp,
            cyber_client_akkoord_op: cyberAkkoordOp,
           betaalwijze,
           ingangsdatum: startDate,
           voornaam: formData.voornaam,
           achternaam: formData.achternaam,
           email: formData.email,
           telefoon: formData.telefoon ? normaliseerNlTelefoon(formData.telefoon) : null,
           attributie: leesAttributie(),
           bedrijfsnaam: formData.bedrijfsnaam,
           kvk_nummer: formData.kvkNummer || null,
           kvk_startdatum: formData.kvkStartdatum || null,
           beroep: formData.beroep || null,
           sector: verzekeringskaartVoorSector(formData.sector)?.sector.label ?? null,
           adres_straat: formData.adresStraat || null,
           adres_huisnummer: formData.adresHuisnummer || null,
           adres_postcode: formData.adresPostcode || null,
           adres_plaats: formData.adresPlaats || null,
           adres_land: formData.adresLand || null,
           iban: formData.iban || null,
           sepa_akkoord: incassoAkkoord,
           rekeninghouder: formData.rekeninghouder.trim(),
           lead_id: leadId,
           concept_id: conceptId.current || undefined,
           client_akkoord_op: clientAkkoordOp,
           pagina_url: window.location.href,
           formulier_naam: "Online aanvraag BAV + AVB",
           formulier: maakFormulier([
             ["Pakket", selectedBavPakket.name], ["Betaalwijze", betaalwijze], ["Ingangsdatum", startDate],
             ["Bedrijfsnaam", formData.bedrijfsnaam], ["KvK-nummer", formData.kvkNummer], ["Startdatum KVK-inschrijving", formData.kvkStartdatum],
             ["Sector", verzekeringskaartVoorSector(formData.sector)?.sector.label ?? formData.sector], ["Beroep", formData.beroep],
             ["Functie", formData.functie], ["Aantal medewerkers", formData.aantalMedewerkers],
             ["Voornaam", formData.voornaam], ["Achternaam", formData.achternaam], ["E-mail", formData.email], ["Telefoon", normaliseerNlTelefoon(formData.telefoon)],
             ["Belangrijkste opdrachtgever", formData.opdrachtgever],
             ["Via bemiddelaar", viaBemiddelaar === null ? "" : viaBemiddelaar], ["Naam bemiddelaar", viaBemiddelaar ? formData.bemiddelaarNaam : ""],
             ["Straat", formData.adresStraat], ["Huisnummer", formData.adresHuisnummer], ["Postcode", formData.adresPostcode],
             ["Plaats", formData.adresPlaats], ["Land", formData.adresLand],
             ["IBAN", formData.iban], ["Rekeninghouder", formData.rekeninghouder],
             ["SEPA-machtiging akkoord", incassoAkkoord], ["Slotverklaring akkoord", slotverklaringAkkoord],
              ...((cyberAangevraagd || heeftCyber) ? CYBER_VRAGEN.map((q) => [q.tekst, cyberAntwoorden[q.id]] as [string, boolean | undefined]) : []),
           ]),
           getoonde_documenten: wizardDocumenten(formData.sector).map((d) => d.href),
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

       if (error) {
         // 409 = server-side dubbelcheck: bestaande klant met actieve polis.
         const ctx = (error as { context?: Response }).context;
         if (ctx?.status === 409) {
           setExistingCustomerOpen(true);
           return;
         }
         if (ctx?.status === 429 || ctx?.status === 400) {
           let melding = "";
           try { melding = (await ctx.clone().json())?.error ?? ""; } catch { /* geen body */ }
           toast({ title: "Aanvraag niet verstuurd", description: `${melding || "Controleer je gegevens."} Bel gerust 020 - 457 3077.`, variant: "destructive" });
           return;
         }
         if (ctx?.status === 503) {
           toast({ title: "Aanmelden tijdelijk niet mogelijk", description: "Aanmelden is tijdelijk niet mogelijk, bel 020 - 457 3077", variant: "destructive" });
           return;
         }
         throw error;
       }
       if (!data?.success) throw new Error(data?.error || "Onbekende fout");

        const returnedLeadId = typeof data.lead_id === "string" ? data.lead_id : leadId;
        setSubmissionResult({
          starter: starterVanToepassing,
          cyber: data.cyber_gekozen ?? heeftCyber,
          cyberAfgewezen: data.cyber_afgewezen ?? cyberAfgewezen,
          reference: returnedLeadId.slice(0, 8).toUpperCase(),
          mandaatkenmerk: typeof data.mandaatkenmerk === "string" ? data.mandaatkenmerk : undefined,
          handmatig: isHandmatigeAcceptatieSector(formData.sector),
        });
        try { sessionStorage.removeItem(CONCEPT_KEY); } catch { /* geen opslag */ }
        conceptId.current = ""; laatsteConcept.current = "";
        const conversiePremie = aanvraagPremie(selectedBavPakket.id, starterVanToepassing);
        trackPurchase(returnedLeadId, selectedBavPakket.id, selectedBavPakket.name, conversiePremie.maand ? conversiePremie.totaal * 12 : conversiePremie.totaal, { email: formData.email, phone_number: formData.telefoon });
       setIsSubmitted(true);
        setFormData({
          bedrijfsnaam: "", kvkNummer: "", kvkStartdatum: "", sector: "", beroep: "", functie: "", aantalMedewerkers: "",
          voornaam: "", achternaam: "", email: "", telefoon: "", opdrachtgever: "", bemiddelaarNaam: "",
          iban: "", adresStraat: "", adresHuisnummer: "", adresPostcode: "", adresPlaats: "", adresLand: "Nederland",
          rekeninghouder: "",
        });
        setStartDate("");
        setViaBemiddelaar(null);
        setIncassoAkkoord(false);
        setClientAkkoordOp(null);
        setSlotverklaringAkkoord(false);
        setErrors({});
     } catch (error) {
       console.error("Error submitting application:", error);
       toast({
         title: "Er ging iets mis",
         description: "Probeer het opnieuw of neem telefonisch contact op: 020 - 457 3077",
         variant: "destructive",
       });
     } finally {
       setIsSubmitting(false);
     }
   };


  if (isSubmitted && submissionResult) {
    return (
      <section className="section-padding bg-secondary" id="combinatiepolis">
        <div className="container-wide">
          <div ref={successRef} className="scroll-mt-24 mx-auto max-w-2xl bg-card border border-border rounded-lg px-6 py-10 sm:px-10 sm:py-14 text-center shadow-sm">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200 }}
              className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-accent/10"
            >
              <CheckCircle className="h-8 w-8 text-accent" aria-hidden />
            </motion.div>
            <h2 ref={successHeadingRef} tabIndex={-1} className="outline-none text-2xl font-bold sm:text-3xl">
              Je aanvraag is ontvangen
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              {submissionResult.handmatig
                ? "We hebben je aanvraag ontvangen. Binnen 24 uur hoor je van ons. Je ontvangt een bevestiging per e-mail, met je SEPA-machtiging als PDF."
                : "Binnen 24 uur geregeld, certificaat in je mailbox. Je ontvangt een bevestiging per e-mail, met je SEPA-machtiging als PDF, en een uitnodiging voor Mijn ZP."}
            </p>
            {submissionResult.starter && (
              <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">{STARTER_VOORBEHOUD_TEKST}</p>
            )}
            {submissionResult.cyber && <p className="mt-4 text-sm text-muted-foreground">{CYBER_LOOPTIJD}</p>}
            {submissionResult.cyberAfgewezen && <p className="mt-4 text-sm text-muted-foreground">{CYBER_AFGEWEZEN}</p>}
            <div className="mt-6 space-y-1 text-sm">
              <p><span className="font-semibold">Referentie:</span> {submissionResult.reference}</p>
              {submissionResult.mandaatkenmerk && (
                <p className="break-all"><span className="font-semibold">Mandaatkenmerk:</span> {submissionResult.mandaatkenmerk}</p>
              )}
            </div>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button variant="accent" asChild>
                <Link to="/">Naar de homepage</Link>
              </Button>
              <Button variant="outline" asChild>
                <a href="tel:+31204573077">Bel ons: 020 - 457 3077</a>
              </Button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      <HoneypotField guard={guard} />
      <Dialog open={existingCustomerOpen} onOpenChange={(open) => {
        setExistingCustomerOpen(open);
        if (!open) { setMagicLinkSent(false); setMagicLinkSending(false); }
      }}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          <div className="flex flex-col items-center text-center px-6 py-8 sm:px-8 sm:py-10">
            <div className="h-16 w-16 rounded-full bg-accent/10 flex items-center justify-center mb-5">
              <Shield className="h-8 w-8 text-accent" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold mb-3">Even inloggen op je klantportaal?</h2>
            {magicLinkSent ? (
              <p className="text-muted-foreground text-sm sm:text-base mb-6">
                Als dit e-mailadres bij ons bekend is, ontvang je zo een veilige inloglink in je mailbox.
              </p>
            ) : (
              <p className="text-muted-foreground text-sm sm:text-base mb-6">
                Het lijkt erop dat er bij dit e-mailadres al een polis bij ons loopt. Wil je inloggen op je klantportaal? We sturen je een veilige inloglink.
              </p>
            )}
            <div className="flex flex-col gap-3 w-full">
              <Button
                variant="accent"
                size="default"
                className="w-full"
                disabled={magicLinkSending || magicLinkSent}
                onClick={async () => {
                  if (magicLinkSending || magicLinkSent) return;
                  setMagicLinkSending(true);
                  try {
                    await supabase.functions.invoke("send-portal-magiclink", {
                      body: { email: formData.email.trim(), redirect: "/portal" },
                    });
                  } catch (err) {
                    console.debug("[bav-existing] magiclink invoke failed:", err);
                  }
                  setMagicLinkSending(false);
                  setMagicLinkSent(true);
                }}
              >
                {magicLinkSending ? "Bezig..." : magicLinkSent ? "Inloglink verstuurd" : "Stuur mij een inloglink"}
              </Button>
              <Button variant="outline" size="default" asChild className="w-full">
                <Link to="/portal/login">Naar klantportaal-login</Link>
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
                  <img loading="lazy" decoding="async" key={label} src={ellenAvatar} alt="Ellen Baars" className="h-7 w-7 rounded-full border-2 border-background object-cover" />
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
              <span><span className="font-semibold">{SITE_CONFIG.klantenAantal}</span> tevreden zzp'ers</span>
            </div>
            <span className="hidden sm:inline-block h-4 w-px bg-border" aria-hidden />
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-accent" aria-hidden />
              <span>AFM geregistreerd · Nr. 12050636</span>
            </div>
          </div>
        </AnimatedSection>

        <AnimatedSection delay={0.2} className="max-w-4xl mx-auto">
          <div
            ref={wizardRef}
            className="scroll-mt-24"
            onPointerDownCapture={startCheckout}
            onFocusCapture={startCheckout}
            onKeyDownCapture={startCheckout}
          >
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
              <div className="lg:col-span-2 min-w-0 p-6 md:p-8">
                <AnimatePresence mode="wait">
                {currentStep === 1 && (
                  <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }} className="space-y-6">
                    <div>
                      <h3 data-step-heading tabIndex={-1} className="text-xl font-semibold mb-2 outline-none">{t("home.bavChooseCoverage")}</h3>
                      <p className="text-muted-foreground text-sm">{t("home.bavChooseDesc")}</p>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      {bavPakketten.map((pkg) => {
                        const isSelected = gekozenPakketId === pkg.id;
                        return (
                          <Button variant="outline"
                            key={pkg.id}
                            type="button"
                            onClick={() => kiesPakket(pkg.id)}
                            className={cn(
                              "relative h-auto whitespace-normal items-stretch p-5 rounded-xl border-2 text-left transition-all flex flex-col",
                              isSelected
                                ? "border-accent bg-accent/5 shadow-md"
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
                              €{formatPremieBedrag(pkg.prijs)}
                              <span className="text-xs font-normal text-muted-foreground"> / {pkg.periode}</span>
                            </p>
                            {pkg.periode === "jaar" && (
                              <p className="-mt-2 mb-3 text-xs text-muted-foreground">= €{formatPerMaand(pkg.prijs)} per maand</p>
                            )}
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
                                  <span>{CYBER_DEKKING}</span>
                                </li>
                              )}
                            </ul>
                            {isSelected && (
                              <div className="absolute top-3 right-3">
                                <CheckCircle className="h-5 w-5 text-accent" />
                              </div>
                            )}
                          </Button>
                        );
                      })}
                    </div>
                    {heeftCyber && <><div className="space-y-2 text-sm text-muted-foreground"><p>{CYBER_HULP}</p><p>{CYBER_LOOPTIJD}</p><p>{CYBER_POLISVOORWAARDEN}</p></div><CyberVragen antwoorden={cyberAntwoorden} onChange={setCyberAntwoorden} /><FieldError message={errors.cyber} /></>}
                    {(cyberAfgewezen || (heeftCyber && beoordeelCyber(cyberAntwoorden).volledig && !beoordeelCyber(cyberAntwoorden).toegestaan)) && <p role="status" className="text-sm text-foreground">{CYBER_AFGEWEZEN}</p>}
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
                              setErrors(prev => ({ ...prev, startDate: `Online kan de ingangsdatum niet in het verleden liggen. Heb je een vraag, bel ${SITE_CONFIG.phoneDisplay}.` }));
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
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="email">{t("home.bavEmail")} *</Label>
                        <Input id="email" name="email" type="email" autoComplete="email" value={formData.email} onChange={handleInputChange} placeholder="jan@bedrijf.nl" className={cn(errors.email && "border-destructive")} />
                        <FieldError message={errors.email} />
                        <p className="mt-1 text-xs text-muted-foreground">We bewaren je gegevens tijdens het invullen, zodat we je kunnen helpen als je ergens vastloopt.</p>
                      </div>
                      <div>
                        <Label htmlFor="telefoon">{t("home.bavPhone")} *</Label>
                        <Input id="telefoon" name="telefoon" type="tel" autoComplete="tel" value={formData.telefoon} onChange={handleInputChange} placeholder="0612345678" className={cn(errors.telefoon && "border-destructive")} />
                        <FieldError message={errors.telefoon} />
                      </div>
                    </div>
                  </motion.div>
                )}

                {currentStep === 2 && (
                  <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }} className="space-y-6">
                    <div>
                      <h3 data-step-heading tabIndex={-1} className="text-xl font-semibold mb-2 outline-none">{t("home.bavCompanyTitle")}</h3>
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
                        {kvkStatus && <p className="text-xs text-muted-foreground mt-1" role="status">{kvkStatus}</p>}
                      </div>
                      <div>
                        <Label htmlFor="kvkStartdatum">Startdatum KVK-inschrijving</Label>
                        <Input id="kvkStartdatum" name="kvkStartdatum" type="date" value={formData.kvkStartdatum} onChange={handleInputChange} max={new Date().toISOString().slice(0, 10)} className={cn(errors.kvkStartdatum && "border-destructive")} />
                        <p className="text-xs text-muted-foreground mt-1">Staat op je KVK-uittreksel. Nodig voor het startertarief.</p>
                        <FieldError message={errors.kvkStartdatum} />
                      </div>
                      {starterVanToepassing && (
                        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm" data-testid="starterblok">
                          <p className="font-semibold mb-1">Startertarief van toepassing</p>
                          <p className="text-muted-foreground">{STARTER_VOORWAARDE_TEKST}</p>
                          <p className="text-muted-foreground mt-1">Zelfde polis, dekking en voorwaarden als de gewone BAV + AVB. Wij controleren je KVK-startdatum voordat de polis ingaat.</p>
                          <p className="text-muted-foreground mt-1">{STARTER_VOORBEHOUD_TEKST}</p>
                        </div>
                      )}
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
                          <Input id="adresPostcode" name="adresPostcode" value={formData.adresPostcode} onChange={handleInputChange} onBlur={() => setFormData(prev => ({ ...prev, adresPostcode: normaliseerPostcode(prev.adresPostcode, prev.adresLand) }))} placeholder="1234 AB" className={cn("uppercase", errors.adresPostcode && "border-destructive")} />
                          <FieldError message={errors.adresPostcode} />
                        </div>
                        <div className="col-span-2">
                          <Label htmlFor="adresPlaats">Plaats *</Label>
                          <Input id="adresPlaats" name="adresPlaats" value={formData.adresPlaats} onChange={handleInputChange} className={cn(errors.adresPlaats && "border-destructive")} />
                          <FieldError message={errors.adresPlaats} />
                        </div>
                      </div>
                      <AdresGevonden adres={pdokAdres} />
                      <div>
                        <Label htmlFor="sector">Sector *</Label>
                        <select
                          id="sector"
                          name="sector"
                          value={formData.sector}
                          onChange={(e) => { const v = e.target.value; setFormData(prev => ({ ...prev, sector: v })); if (errors.sector) setErrors(prev => { const n = { ...prev }; delete n.sector; return n; }); }}
                          className={cn("flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm", errors.sector && "border-destructive")}
                        >
                          <option value="">Kies je sector</option>
                          {WIZARD_SECTOREN.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                        </select>
                        <FieldError message={errors.sector} />
                      </div>
                      <div>
                        <Label htmlFor="beroep">{t("home.bavProfession")} *</Label>
                        <Input id="beroep" name="beroep" value={formData.beroep} onChange={handleInputChange} className={cn(errors.beroep && "border-destructive")} />
                        <FieldError message={errors.beroep} />
                      </div>
                      <div>
                        <Label htmlFor="functie">{t("home.bavFunction")} (optioneel)</Label>
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
                      <h3 data-step-heading tabIndex={-1} className="text-xl font-semibold mb-2 outline-none">{t("home.bavContactTitle")}</h3>
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

                      <div className="border-t border-border pt-4">
                        <div>
                          <Label htmlFor="opdrachtgever">{t("home.bavClient")} (optioneel)</Label>
                          <Input id="opdrachtgever" name="opdrachtgever" value={formData.opdrachtgever} onChange={handleInputChange} className={cn(errors.opdrachtgever && "border-destructive")} />
                          <FieldError message={errors.opdrachtgever} />
                        </div>
                      </div>

                      <div className="border-t border-border pt-4">
                        <Label className="text-sm font-medium mb-3 block">{t("home.bavMediator")} (optioneel)</Label>
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
                      <h3 data-step-heading tabIndex={-1} className="text-xl font-semibold mb-2 outline-none">{t("home.bavIncassoTitle")}</h3>
                      <p className="text-muted-foreground text-sm">{t("home.bavIncassoDesc")}</p>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="iban">{t("home.bavIban")} *</Label>
                        <Input id="iban" name="iban" value={formData.iban} onChange={handleInputChange} placeholder="NL00 BANK 0000 0000 00" className={cn("uppercase tracking-wider", errors.iban && "border-destructive")} />
                        <FieldError message={errors.iban} />
                      </div>
                      <div>
                        <Label htmlFor="rekeninghouder">Naam rekeninghouder *</Label>
                        <Input id="rekeninghouder" name="rekeninghouder" required aria-describedby="rekeninghouder-hulp" value={formData.rekeninghouder} onChange={(e) => { rekeninghouderAangepast.current = true; handleInputChange(e); }} placeholder="Naam zoals bij de bank bekend" className={cn(errors.rekeninghouder && "border-destructive")} />
                        <p id="rekeninghouder-hulp" className="text-xs text-muted-foreground mt-1">Controleer: naam zoals die bij je bank bekend is</p>
                        <FieldError message={errors.rekeninghouder} />
                      </div>
                      <div>
                        <Label htmlFor="adresLand">Land *</Label>
                        <Input id="adresLand" name="adresLand" value={formData.adresLand} onChange={handleInputChange} className={cn(errors.adresLand && "border-destructive")} />
                        <FieldError message={errors.adresLand} />
                        <p className="text-xs text-muted-foreground mt-1">Als adres van de rekeninghouder gebruiken we het bedrijfsadres uit stap 2.</p>
                      </div>
                      <SepaMachtigingBlok
                        data={bouwFrontendMachtiging({
                          type: "doorlopend",
                          mandaatkenmerk: mandaatkenmerkVoor(leadId),
                          reden: redenBav(),
                          debiteurNaam: formData.rekeninghouder,
                          debiteurAdres: { straat: formData.adresStraat, huisnummer: formData.adresHuisnummer, postcode: formData.adresPostcode, plaats: formData.adresPlaats, land: formData.adresLand },
                          iban: formData.iban,
                        })}
                        checked={incassoAkkoord}
                        onCheckedChange={(v) => { setIncassoAkkoord(v); setClientAkkoordOp(v ? new Date().toISOString() : null); if (errors.incassoAkkoord) setErrors(prev => { const n = { ...prev }; delete n.incassoAkkoord; return n; }); }}
                        error={errors.incassoAkkoord}
                      />
                    </div>
                  </motion.div>
                )}

                {currentStep === 5 && (
                  <motion.div key="step5" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }} className="space-y-6">
                    <div>
                      <h3 data-step-heading tabIndex={-1} className="text-xl font-semibold mb-2 outline-none">{t("home.bavConfirmTitle")}</h3>
                      <p className="text-muted-foreground text-sm">{t("home.bavConfirmDesc")}</p>
                    </div>
                    <div className="space-y-4">
                      <div className="bg-secondary rounded-lg p-4">
                        <h4 className="font-medium mb-3">{t("home.bavStep1")}</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between"><span className="text-muted-foreground">{t("bavApp.package")}</span><span className="font-medium">{gekozenPakketLabel}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">{t("bavApp.coverage")}</span><span>BAV {formatBedrag(selectedBavPakket.dekkingen.bav.perGebeurtenis)} / AVB {formatBedrag(selectedBavPakket.dekkingen.avb.perGebeurtenis)}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">{t("bavApp.payment")}</span><span>{starterVanToepassing ? `€ ${formatPremieBedrag(currentPrice)} per ${betaalwijzeIsMaand ? "maand" : "jaar"} (startertarief t/m ${formatDateNL(starterTot(startDate))})` : selectedBavPakket.prijsLabel}</span></div>
                          {starterVanToepassing && <p className="text-xs text-muted-foreground">{STARTER_VOORWAARDE_TEKST} {STARTER_VOORBEHOUD_TEKST}</p>}
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
                          <div className="flex justify-between gap-3"><span className="text-muted-foreground">Doorlopende SEPA-machtiging</span><span className="min-w-0 break-all text-right">{incassoAkkoord ? `Gegeven (kenmerk ${mandaatkenmerkVoor(leadId)})` : "Niet gegeven"}</span></div>
                        </div>
                      </div>

                      {/* Belangrijke documenten, Deel 6 */}
                      <div className="border border-border rounded-lg p-4 bg-background space-y-3">
                        <h4 className="font-semibold text-sm">Belangrijke documenten om door te lezen</h4>
                        <p className="text-xs text-muted-foreground">
                          Door op 'Verstuur aanvraag' te klikken bevestig je dat je deze documenten hebt gelezen.
                        </p>
                        <div className="grid min-w-0 sm:grid-cols-2 gap-2">
                          {wizardDocumenten(formData.sector).map((doc) => (
                            <a
                              key={doc.href + doc.title}
                              href={doc.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex min-w-0 items-center gap-2 p-2 rounded border border-border hover:border-accent hover:bg-accent/5 transition-colors text-xs"
                            >
                              <FileCheck className="h-4 w-4 text-accent flex-shrink-0" />
                              <span className="min-w-0 break-words">{doc.title}</span>
                              <ExternalLink className="h-3 w-3 ml-auto flex-shrink-0 opacity-60" />
                            </a>
                          ))}
                        </div>
                      </div>

                      {/* Slotverklaring */}
                      {heeftCyber && <div className="space-y-2 border border-border rounded-lg p-4"><div className="flex items-start gap-3"><Checkbox id="cyber-akkoord" checked={!!cyberAkkoordOp} onCheckedChange={(v) => setCyberAkkoordOp(v === true ? new Date().toISOString() : null)} /><Label htmlFor="cyber-akkoord" className="text-sm leading-relaxed">{CYBER_AKKOORD}</Label></div><FieldError message={errors.cyberAkkoord} /></div>}
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

                {/* Compacte prijsregel (mobiel), uit bavPakketten */}
                <p className="mt-8 text-center text-xs font-medium text-muted-foreground sm:hidden" data-testid="bav-prijsregel">
                  €{formatPremieBedrag(currentPrice)}/{selectedBavPakket.periode === "maand" ? "mnd" : "jr"} · BAV {formatMiljoen(selectedBavPakket.dekkingen.bav.perGebeurtenis)} · AVB {formatMiljoen(selectedBavPakket.dekkingen.avb.perGebeurtenis)} · BAV + AVB dagelijks opzegbaar{heeftCyber ? "; cyber 12 maanden" : ""}
                </p>
                {/* Navigation Buttons */}
                <div className="flex justify-between mt-3 sm:mt-8 pt-6 border-t border-border">
                  {currentStep > 1 ? (
                    <Button variant="outline" onClick={prevStep}><ArrowLeft className="h-4 w-4" />{t("home.bavPrev")}</Button>
                  ) : <div />}
                  {currentStep < TOTAL_STEPS ? (
                    <Button
                      onClick={nextStep}
                      disabled={(currentStep === 1 && !!startDate && startDate < new Date().toISOString().split('T')[0])}
                      className="bg-accent hover:bg-accent/90 text-accent-foreground"
                    >{t("home.bavNext")}<ArrowRight className="h-4 w-4" /></Button>
                  ) : (
                    <Button
                      onClick={handleSubmit}
                      size="lg"
                      disabled={isSubmitting}
                      aria-busy={isSubmitting}
                      className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold"
                    >
                      {isSubmitting ? (
                        <>
                          <span aria-hidden className="h-5 w-5 inline-block animate-spin rounded-full border-2 border-current border-t-transparent" />
                          Aanvraag wordt verstuurd…
                        </>
                      ) : (
                        <>
                          <Shield className="h-5 w-5" />{t("home.bavSubmit")}<ArrowRight className="h-5 w-5" />
                        </>
                      )}
                    </Button>
                  )}
                </div>
                {currentStep === TOTAL_STEPS && (
                  <div className="mt-6">
                    <TrustSignalsStrip compact />
                  </div>
                )}
              </div>

              {/* Price Sidebar; bij een starter toont het vak het startertarief */}
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
                        <span className="text-background/70">BAV per aanspraak</span>
                        <span className="font-semibold whitespace-nowrap">{formatBedrag(selectedBavPakket.dekkingen.bav.perGebeurtenis)}</span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-background/70">AVB per aanspraak</span>
                        <span className="font-semibold whitespace-nowrap">{formatBedrag(selectedBavPakket.dekkingen.avb.perGebeurtenis)}</span>
                      </div>
                      {selectedBavPakket.dekkingen.cyber && (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-background/70">{CYBER_DEKKING}</span>
                          <span className="text-xs">{CYBER_HULP} {CYBER_LOOPTIJD} {CYBER_POLISVOORWAARDEN}</span>
                        </div>
                      )}
                    </div>
                    <div className="border-t border-white/20 pt-4">
                      <div className="flex flex-col gap-1">
                        <p className="text-sm text-background/70">{periodeLabel}</p>
                        <p className="text-3xl font-bold whitespace-nowrap">
                          €{formatPremieBedrag(currentPrice)}
                        </p>
                        {starterVanToepassing && (
                          <p className="text-xs text-background/70">
                            de eerste 12 maanden, daarna € {formatPremieBedrag(aanvraagPremie(gekozenPakketId, false).totaal)} {periodeLabel}, inclusief kosten en assurantiebelasting. Voor KVK-inschrijving jonger dan 12 maanden. Cyber krijgt geen startkorting.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <ul className="space-y-3">
                    {(heeftCyber ? [...usps.map((u) => /eigen risico|opzegbaar|pauze/i.test(u) ? `BAV + AVB: ${u}` : u), "Cyber: vaste looptijd 12 maanden, niet pauzeerbaar"] : usps).map((usp) => (
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
          </div>
        </AnimatedSection>
      </div>
    </section>
    </>
  );
}
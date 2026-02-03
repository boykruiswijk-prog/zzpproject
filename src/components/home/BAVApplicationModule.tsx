import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Shield, 
  CheckCircle, 
  Building2, 
  User, 
  FileCheck,
  ArrowRight,
  ArrowLeft,
  Calendar,
  Check,
  Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";

// Package options
const packages = [
  {
    id: "basis",
    name: "Combi Basis",
    coverage: "€ 500.000 per gebeurtenis",
    yearCoverage: "€ 1.000.000 per jaar",
    priceMonthly: 27.70,
    priceYearly: 292.40,
    popular: false,
  },
  {
    id: "uitgebreid",
    name: "Combi Uitgebreid",
    coverage: "€ 2.500.000 per gebeurtenis",
    yearCoverage: "€ 5.000.000 per jaar",
    priceMonthly: 43.54,
    priceYearly: 482.48,
    popular: true,
  },
];

const steps = [
  { id: 1, name: "Verzekering", icon: Shield },
  { id: 2, name: "Bedrijf", icon: Building2 },
  { id: 3, name: "Contact", icon: User },
  { id: 4, name: "Afsluiten", icon: FileCheck },
];

const usps = [
  "Dagelijks opzegbaar",
  "Geen eigen risico",
  "Direct gedekt",
  "BAV + AVB gecombineerd",
];

export function BAVApplicationModule() {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedPackage, setSelectedPackage] = useState<string>("uitgebreid");
  const [paymentType, setPaymentType] = useState<"monthly" | "yearly">("monthly");
  const [startDate, setStartDate] = useState<string>("");
  
  // Form data
  const [formData, setFormData] = useState({
    bedrijfsnaam: "",
    kvkNummer: "",
    beroep: "",
    voornaam: "",
    achternaam: "",
    email: "",
    telefoon: "",
  });

  const selectedPkg = packages.find(p => p.id === selectedPackage);
  const currentPrice = paymentType === "monthly" 
    ? selectedPkg?.priceMonthly 
    : selectedPkg?.priceYearly;
  const savings = paymentType === "yearly" ? 40 : 0;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const nextStep = () => {
    if (currentStep < 4) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleSubmit = () => {
    // Navigate to verzekeringen page with pre-filled data
    // In production, this would submit to the backend
    window.location.href = `/verzekeringen?package=${selectedPackage}&payment=${paymentType}`;
  };

  return (
    <section className="section-padding bg-secondary" id="aanvraag">
      <div className="container-wide">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 bg-accent/10 text-accent px-4 py-2 rounded-full text-sm font-medium mb-4">
            <Sparkles className="h-4 w-4" />
            Direct online afsluiten
          </div>
          <h2 className="mb-4">
            BAV + AVB <span className="text-primary">Combinatiepolis</span>
          </h2>
          <p className="text-muted-foreground">
            De enige gecombineerde beroeps- en bedrijfsaansprakelijkheidsverzekering in Nederland.
            Sluit direct online af in 4 eenvoudige stappen.
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          {/* Progress Steps */}
          <div className="flex justify-between mb-8 relative">
            <div className="absolute top-5 left-0 right-0 h-0.5 bg-border -z-10" />
            {steps.map((step, index) => (
              <div 
                key={step.id} 
                className="flex flex-col items-center relative z-10"
              >
                <div 
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all",
                    currentStep >= step.id 
                      ? "bg-accent border-accent text-accent-foreground" 
                      : "bg-card border-border text-muted-foreground"
                  )}
                >
                  {currentStep > step.id ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <step.icon className="h-5 w-5" />
                  )}
                </div>
                <span className={cn(
                  "text-xs mt-2 font-medium",
                  currentStep >= step.id ? "text-foreground" : "text-muted-foreground"
                )}>
                  {step.name}
                </span>
              </div>
            ))}
          </div>

          {/* Main Content Card */}
          <div className="bg-card rounded-2xl shadow-lg border border-border overflow-hidden">
            <div className="grid lg:grid-cols-3">
              {/* Form Section */}
              <div className="lg:col-span-2 p-6 md:p-8">
                {/* Step 1: Package Selection */}
                {currentStep === 1 && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-xl font-semibold mb-2">Kies je dekking</h3>
                      <p className="text-muted-foreground text-sm">
                        Selecteer het pakket dat past bij jouw situatie
                      </p>
                    </div>

                    <div className="grid gap-4">
                      {packages.map((pkg) => (
                        <button
                          key={pkg.id}
                          onClick={() => setSelectedPackage(pkg.id)}
                          className={cn(
                            "relative p-5 rounded-xl border-2 text-left transition-all",
                            selectedPackage === pkg.id
                              ? "border-accent bg-accent/5"
                              : "border-border hover:border-accent/50"
                          )}
                        >
                          {pkg.popular && (
                            <span className="absolute -top-3 left-4 bg-accent text-accent-foreground text-xs font-medium px-3 py-1 rounded-full">
                              Meest gekozen
                            </span>
                          )}
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-semibold text-lg">{pkg.name}</h4>
                              <p className="text-muted-foreground text-sm mt-1">
                                {pkg.coverage}
                              </p>
                              <p className="text-muted-foreground text-sm">
                                {pkg.yearCoverage}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-2xl font-bold text-primary">
                                €{(paymentType === "monthly" ? pkg.priceMonthly : pkg.priceYearly).toFixed(2).replace('.', ',')}
                              </p>
                              <p className="text-muted-foreground text-sm">
                                {paymentType === "monthly" ? "per maand" : "per jaar"}
                              </p>
                            </div>
                          </div>
                          {selectedPackage === pkg.id && (
                            <div className="absolute top-5 right-5">
                              <CheckCircle className="h-6 w-6 text-accent" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>

                    {/* Payment Type */}
                    <div>
                      <Label className="text-sm font-medium mb-3 block">Betaalwijze</Label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={() => setPaymentType("monthly")}
                          className={cn(
                            "p-4 rounded-lg border-2 text-center transition-all",
                            paymentType === "monthly"
                              ? "border-accent bg-accent/5"
                              : "border-border hover:border-accent/50"
                          )}
                        >
                          <p className="font-medium">Maandelijks</p>
                          <p className="text-muted-foreground text-sm">Flexibel betalen</p>
                        </button>
                        <button
                          onClick={() => setPaymentType("yearly")}
                          className={cn(
                            "p-4 rounded-lg border-2 text-center transition-all relative",
                            paymentType === "yearly"
                              ? "border-accent bg-accent/5"
                              : "border-border hover:border-accent/50"
                          )}
                        >
                          <span className="absolute -top-2 right-2 bg-accent text-accent-foreground text-xs font-medium px-2 py-0.5 rounded-full">
                            Bespaar €40
                          </span>
                          <p className="font-medium">Jaarlijks</p>
                          <p className="text-muted-foreground text-sm">10% korting</p>
                        </button>
                      </div>
                    </div>

                    {/* Start Date */}
                    <div>
                      <Label htmlFor="startDate" className="text-sm font-medium mb-2 block">
                        Gewenste ingangsdatum
                      </Label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input
                          id="startDate"
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="pl-10"
                          min={new Date().toISOString().split('T')[0]}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 2: Company Info */}
                {currentStep === 2 && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-xl font-semibold mb-2">Bedrijfsgegevens</h3>
                      <p className="text-muted-foreground text-sm">
                        Vul de gegevens van je onderneming in
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="bedrijfsnaam">Bedrijfsnaam</Label>
                        <Input
                          id="bedrijfsnaam"
                          name="bedrijfsnaam"
                          value={formData.bedrijfsnaam}
                          onChange={handleInputChange}
                          placeholder="Jouw Bedrijf B.V."
                        />
                      </div>
                      <div>
                        <Label htmlFor="kvkNummer">KvK-nummer</Label>
                        <Input
                          id="kvkNummer"
                          name="kvkNummer"
                          value={formData.kvkNummer}
                          onChange={handleInputChange}
                          placeholder="12345678"
                          maxLength={8}
                        />
                      </div>
                      <div>
                        <Label htmlFor="beroep">Beroep / Werkzaamheden</Label>
                        <Input
                          id="beroep"
                          name="beroep"
                          value={formData.beroep}
                          onChange={handleInputChange}
                          placeholder="Bijv. Software Developer, Consultant"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 3: Contact Info */}
                {currentStep === 3 && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-xl font-semibold mb-2">Contactgegevens</h3>
                      <p className="text-muted-foreground text-sm">
                        Hoe kunnen we je bereiken?
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="voornaam">Voornaam</Label>
                          <Input
                            id="voornaam"
                            name="voornaam"
                            value={formData.voornaam}
                            onChange={handleInputChange}
                            placeholder="Jan"
                          />
                        </div>
                        <div>
                          <Label htmlFor="achternaam">Achternaam</Label>
                          <Input
                            id="achternaam"
                            name="achternaam"
                            value={formData.achternaam}
                            onChange={handleInputChange}
                            placeholder="Jansen"
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="email">E-mailadres</Label>
                        <Input
                          id="email"
                          name="email"
                          type="email"
                          value={formData.email}
                          onChange={handleInputChange}
                          placeholder="jan@jouwbedrijf.nl"
                        />
                      </div>
                      <div>
                        <Label htmlFor="telefoon">Telefoonnummer</Label>
                        <Input
                          id="telefoon"
                          name="telefoon"
                          type="tel"
                          value={formData.telefoon}
                          onChange={handleInputChange}
                          placeholder="06 12345678"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 4: Confirmation */}
                {currentStep === 4 && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-xl font-semibold mb-2">Bevestig je aanvraag</h3>
                      <p className="text-muted-foreground text-sm">
                        Controleer je gegevens en sluit direct af
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div className="bg-secondary rounded-lg p-4">
                        <h4 className="font-medium mb-3">Verzekering</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Pakket</span>
                            <span className="font-medium">{selectedPkg?.name}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Dekking</span>
                            <span>{selectedPkg?.coverage}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Betaling</span>
                            <span>{paymentType === "monthly" ? "Maandelijks" : "Jaarlijks"}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Ingangsdatum</span>
                            <span>{startDate || "Per direct"}</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-secondary rounded-lg p-4">
                        <h4 className="font-medium mb-3">Bedrijf</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Bedrijfsnaam</span>
                            <span>{formData.bedrijfsnaam || "-"}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">KvK</span>
                            <span>{formData.kvkNummer || "-"}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Beroep</span>
                            <span>{formData.beroep || "-"}</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-secondary rounded-lg p-4">
                        <h4 className="font-medium mb-3">Contact</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Naam</span>
                            <span>{formData.voornaam} {formData.achternaam}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Email</span>
                            <span>{formData.email || "-"}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Telefoon</span>
                            <span>{formData.telefoon || "-"}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Navigation Buttons */}
                <div className="flex justify-between mt-8 pt-6 border-t border-border">
                  {currentStep > 1 ? (
                    <Button variant="outline" onClick={prevStep}>
                      <ArrowLeft className="h-4 w-4" />
                      Vorige
                    </Button>
                  ) : (
                    <div />
                  )}
                  
                  {currentStep < 4 ? (
                    <Button onClick={nextStep} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                      Volgende
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button 
                      onClick={handleSubmit}
                      size="lg"
                      className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold"
                    >
                      <Shield className="h-5 w-5" />
                      Direct afsluiten
                      <ArrowRight className="h-5 w-5" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Price Sidebar */}
              <div className="bg-primary p-6 md:p-8 text-primary-foreground">
                <div className="sticky top-8">
                  <h4 className="text-lg font-semibold mb-4">Jouw verzekering</h4>
                  
                  <div className="bg-white/10 rounded-xl p-5 mb-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center">
                        <Shield className="h-5 w-5 text-accent-foreground" />
                      </div>
                      <div>
                        <p className="font-semibold">{selectedPkg?.name}</p>
                        <p className="text-sm text-primary-foreground/70">BAV + AVB</p>
                      </div>
                    </div>
                    
                    <div className="space-y-2 text-sm mb-4">
                      <div className="flex justify-between">
                        <span className="text-primary-foreground/70">Per gebeurtenis</span>
                        <span>{selectedPkg?.coverage.replace('€ ', '€')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-primary-foreground/70">Per jaar</span>
                        <span>{selectedPkg?.yearCoverage.replace('€ ', '€')}</span>
                      </div>
                    </div>

                    <div className="border-t border-white/20 pt-4">
                      <div className="flex justify-between items-end">
                        <div>
                          <p className="text-sm text-primary-foreground/70">
                            {paymentType === "monthly" ? "Per maand" : "Per jaar"}
                          </p>
                          <p className="text-3xl font-bold">
                            €{currentPrice?.toFixed(2).replace('.', ',')}
                          </p>
                        </div>
                        {savings > 0 && (
                          <span className="bg-accent text-accent-foreground text-xs font-medium px-2 py-1 rounded">
                            -€{savings}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* USPs */}
                  <ul className="space-y-3">
                    {usps.map((usp) => (
                      <li key={usp} className="flex items-center gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-accent flex-shrink-0" />
                        <span className="text-primary-foreground/90">{usp}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-6 pt-6 border-t border-white/20">
                    <p className="text-xs text-primary-foreground/60">
                      Vragen? Bel ons op{" "}
                      <a href="tel:0232010502" className="text-accent hover:underline">
                        023 - 201 0502
                      </a>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { PageHero } from "@/components/layout/PageHero";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { ArrowRight, ArrowLeft, CheckCircle2, ShieldCheck, Star, Sparkles, Home } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { LocalizedLink } from "@/components/LocalizedLink";
import { Link } from "react-router-dom";

type ScreeningType = "basis" | "uitgebreid" | "compleet";

const SECTOREN = [
  "ICT & Software",
  "Zorg & Welzijn",
  "Bouw & Techniek",
  "Financieel & Juridisch",
  "Onderwijs",
  "Overheid",
  "Overig",
];

const PAKKETTEN: Array<{
  id: ScreeningType;
  titel: string;
  badge?: string;
  prijs: string;
  subtekst: string;
  inhoud: string[];
  geschiktVoor: string;
}> = [
  {
    id: "basis",
    titel: "ZP Check Basis",
    badge: "Meest gekozen",
    prijs: "€49,-",
    subtekst: "eenmalig",
    inhoud: [
      "ID verificatie",
      "Bedrijfscheck (KVK)",
      "BTW check",
      "IBAN check",
    ],
    geschiktVoor: "Algemene opdrachten, ICT en consultancy",
  },
  {
    id: "uitgebreid",
    titel: "ZP Check Uitgebreid",
    prijs: "€129,-",
    subtekst: "eenmalig",
    inhoud: [
      "Alles uit ZP Check Basis",
      "VOG aanvragen",
      "Diploma check via DUO",
      "Referentiecontrole",
    ],
    geschiktVoor: "Overheid, financiële sector en juridisch",
  },
  {
    id: "compleet",
    titel: "ZP Check Compleet",
    prijs: "€179,-",
    subtekst: "eenmalig",
    inhoud: [
      "Alles uit ZP Check Uitgebreid",
      "BIG register check",
      "SKJ register check",
      "Otentic AI documentverificatie",
    ],
    geschiktVoor: "Zorg, jeugdzorg en gereguleerde sectoren",
  },
];

const STAPPEN = ["Jouw gegevens", "Screening kiezen", "Bevestiging"];

export default function Screening() {
  const [stap, setStap] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [akkoord, setAkkoord] = useState(false);

  const [form, setForm] = useState({
    voornaam: "",
    achternaam: "",
    email: "",
    telefoon: "",
    bedrijfsnaam: "",
    kvk_nummer: "",
    beroep: "",
    sector: "",
  });
  const [screeningType, setScreeningType] = useState<ScreeningType>("basis");

  const update = (k: keyof typeof form, v: string) => {
    setForm((p) => ({ ...p, [k]: v }));
    if (errors[k]) setErrors((p) => { const n = { ...p }; delete n[k]; return n; });
  };

  const validateStap1 = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.voornaam.trim()) e.voornaam = "Voornaam is verplicht";
    if (!form.achternaam.trim()) e.achternaam = "Achternaam is verplicht";
    if (!form.email.trim()) e.email = "E-mail is verplicht";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Ongeldig e-mailadres";
    if (!form.bedrijfsnaam.trim()) e.bedrijfsnaam = "Bedrijfsnaam is verplicht";
    if (!form.kvk_nummer.trim()) e.kvk_nummer = "KvK-nummer is verplicht";
    else if (!/^\d{8}$/.test(form.kvk_nummer)) e.kvk_nummer = "KvK-nummer moet 8 cijfers zijn";
    if (!form.beroep.trim()) e.beroep = "Beroep is verplicht";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => {
    if (stap === 1 && !validateStap1()) return;
    setStap((s) => Math.min(3, s + 1));
  };
  const prev = () => setStap((s) => Math.max(1, s - 1));

  const handleSubmit = async () => {
    if (!akkoord) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const { data, error } = await supabase.functions.invoke("process-screening-aanvraag", {
        body: {
          ...form,
          telefoon: form.telefoon || undefined,
          screening_type: screeningType,
        },
      });
      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || "Onbekende fout");
      }
      setSuccess(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Onbekende fout");
    } finally {
      setSubmitting(false);
    }
  };

  const gekozenPakket = PAKKETTEN.find((p) => p.id === screeningType)!;

  return (
    <Layout>
      <SEOHead
        title="Start je screening | ZP Zaken"
        description="Laat zien dat je betrouwbaar bent met een screening. Vraag binnen enkele minuten je screening aan via ZP Zaken."
      />
      <PageHero
        title={<>Start je <span className="text-accent">screening</span></>}
        subtitle="Bewijs je betrouwbaarheid aan opdrachtgevers"
        badge={{ icon: <Sparkles className="h-4 w-4" />, text: "Voor zelfstandig professionals" }}
      />

      <section className="section-padding bg-background">
        <div className="container-wide max-w-3xl">
          {success ? (
            <Card className="p-8 md:p-12 text-center">
              <div className="mx-auto h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mb-6">
                <CheckCircle2 className="h-9 w-9 text-green-600" />
              </div>
              <h2 className="text-2xl md:text-3xl mb-3">Aanvraag ontvangen!</h2>
              <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
                Bedankt voor je aanvraag. Een adviseur van ZP Zaken neemt binnen 24 uur contact met je op om de screening te bespreken en te starten.
              </p>
              <Button variant="accent" size="lg" asChild>
                <LocalizedLink to="/">
                  <Home className="h-5 w-5" />Terug naar de homepage<ArrowRight className="h-5 w-5" />
                </LocalizedLink>
              </Button>
            </Card>
          ) : (
            <>
              {/* Stap-indicator */}
              <div className="mb-10">
                <div className="flex items-center justify-between">
                  {STAPPEN.map((label, i) => {
                    const idx = i + 1;
                    const active = stap === idx;
                    const done = stap > idx;
                    return (
                      <div key={label} className="flex-1 flex items-center">
                        <div className="flex flex-col items-center flex-1">
                          <div className={cn(
                            "h-10 w-10 rounded-full flex items-center justify-center font-semibold border-2 transition-colors",
                            active && "bg-accent text-accent-foreground border-accent",
                            done && "bg-accent text-accent-foreground border-accent",
                            !active && !done && "bg-card text-muted-foreground border-border"
                          )}>
                            {done ? <CheckCircle2 className="h-5 w-5" /> : idx}
                          </div>
                          <span className={cn(
                            "text-xs md:text-sm mt-2 text-center",
                            (active || done) ? "text-foreground font-medium" : "text-muted-foreground"
                          )}>
                            {label}
                          </span>
                        </div>
                        {idx < STAPPEN.length && (
                          <div className={cn(
                            "h-[2px] flex-1 mx-2 -mt-7",
                            stap > idx ? "bg-accent" : "bg-border"
                          )} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <Card className="p-6 md:p-8">
                {/* STAP 1 */}
                {stap === 1 && (
                  <div className="space-y-4">
                    <h2 className="text-xl md:text-2xl mb-2">Persoonlijke gegevens</h2>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="voornaam">Voornaam *</Label>
                        <Input id="voornaam" value={form.voornaam} onChange={(e) => update("voornaam", e.target.value)} className={cn(errors.voornaam && "border-destructive")} />
                        {errors.voornaam && <p className="text-xs mt-1" style={{ color: "#E53E2F" }}>{errors.voornaam}</p>}
                      </div>
                      <div>
                        <Label htmlFor="achternaam">Achternaam *</Label>
                        <Input id="achternaam" value={form.achternaam} onChange={(e) => update("achternaam", e.target.value)} className={cn(errors.achternaam && "border-destructive")} />
                        {errors.achternaam && <p className="text-xs mt-1" style={{ color: "#E53E2F" }}>{errors.achternaam}</p>}
                      </div>
                      <div>
                        <Label htmlFor="email">E-mailadres *</Label>
                        <Input id="email" type="email" value={form.email} onChange={(e) => update("email", e.target.value)} className={cn(errors.email && "border-destructive")} />
                        {errors.email && <p className="text-xs mt-1" style={{ color: "#E53E2F" }}>{errors.email}</p>}
                      </div>
                      <div>
                        <Label htmlFor="telefoon">Telefoonnummer</Label>
                        <Input id="telefoon" type="tel" value={form.telefoon} onChange={(e) => update("telefoon", e.target.value)} />
                      </div>
                      <div>
                        <Label htmlFor="bedrijfsnaam">Bedrijfsnaam *</Label>
                        <Input id="bedrijfsnaam" value={form.bedrijfsnaam} onChange={(e) => update("bedrijfsnaam", e.target.value)} className={cn(errors.bedrijfsnaam && "border-destructive")} />
                        {errors.bedrijfsnaam && <p className="text-xs mt-1" style={{ color: "#E53E2F" }}>{errors.bedrijfsnaam}</p>}
                      </div>
                      <div>
                        <Label htmlFor="kvk_nummer">KvK-nummer *</Label>
                        <Input id="kvk_nummer" inputMode="numeric" maxLength={8} value={form.kvk_nummer} onChange={(e) => update("kvk_nummer", e.target.value.replace(/\D/g, ""))} className={cn(errors.kvk_nummer && "border-destructive")} />
                        {errors.kvk_nummer && <p className="text-xs mt-1" style={{ color: "#E53E2F" }}>{errors.kvk_nummer}</p>}
                      </div>
                      <div className="md:col-span-2">
                        <Label htmlFor="beroep">Beroep / functietitel *</Label>
                        <Input id="beroep" placeholder="Bijv. ICT Consultant, Verpleegkundige, Bouwvakker" value={form.beroep} onChange={(e) => update("beroep", e.target.value)} className={cn(errors.beroep && "border-destructive")} />
                        {errors.beroep && <p className="text-xs mt-1" style={{ color: "#E53E2F" }}>{errors.beroep}</p>}
                      </div>
                      <div className="md:col-span-2">
                        <Label htmlFor="sector">Sector</Label>
                        <Select value={form.sector} onValueChange={(v) => update("sector", v)}>
                          <SelectTrigger id="sector"><SelectValue placeholder="Kies een sector" /></SelectTrigger>
                          <SelectContent>
                            {SECTOREN.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex justify-end pt-4">
                      <Button variant="accent" onClick={next}>Volgende <ArrowRight className="h-4 w-4" /></Button>
                    </div>
                  </div>
                )}

                {/* STAP 2 */}
                {stap === 2 && (
                  <div className="space-y-6">
                    <h2 className="text-xl md:text-2xl mb-2">Kies je screening pakket</h2>
                    <div className="grid md:grid-cols-3 gap-4">
                      {PAKKETTEN.map((p) => {
                        const selected = screeningType === p.id;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setScreeningType(p.id)}
                            className={cn(
                              "relative text-left p-5 rounded-xl border-2 transition-all bg-card",
                              selected ? "border-accent shadow-md" : "border-border hover:border-accent/50"
                            )}
                          >
                            {p.badge && (
                              <span className="absolute -top-2 right-3 bg-accent text-accent-foreground text-xs font-medium px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                <Star className="h-3 w-3" />{p.badge}
                              </span>
                            )}
                            <div className="flex items-center gap-2 mb-2">
                              <ShieldCheck className={cn("h-5 w-5", selected ? "text-accent" : "text-muted-foreground")} />
                              <h3 className="font-semibold">{p.titel}</h3>
                            </div>
                            <p className="mb-3"><span className="text-2xl font-bold text-foreground">{p.prijs}</span> <span className="text-sm text-muted-foreground">{p.subtekst}</span></p>
                            <ul className="space-y-1.5 mb-3">
                              {p.inhoud.map((item) => (
                                <li key={item} className="flex items-start gap-2 text-sm">
                                  <CheckCircle2 className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                                  <span>{item}</span>
                                </li>
                              ))}
                            </ul>
                            <p className="text-xs text-muted-foreground"><strong>Geschikt voor:</strong> {p.geschiktVoor}</p>
                          </button>
                        );
                      })}
                    </div>

                    <div className="bg-secondary rounded-lg p-4 text-sm text-muted-foreground space-y-3">
                      <p>
                        Alle screenings worden uitgevoerd via Otentica, ISO 27001 gecertificeerd partner voor screening. Na je aanvraag ontvang je binnen 24 uur een uitnodiging om de screening digitaal te doorlopen. Gemiddelde doorlooptijd: 1 tot 3 werkdagen.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <span className="inline-flex items-center gap-1 bg-background border border-border rounded-full px-3 py-1 text-xs font-medium text-foreground">
                          <ShieldCheck className="h-3 w-3 text-accent" /> ISO 27001 gecertificeerd
                        </span>
                        <span className="inline-flex items-center gap-1 bg-background border border-border rounded-full px-3 py-1 text-xs font-medium text-foreground">
                          <ShieldCheck className="h-3 w-3 text-accent" /> AVG-proof
                        </span>
                        <span className="inline-flex items-center gap-1 bg-background border border-border rounded-full px-3 py-1 text-xs font-medium text-foreground">
                          <ShieldCheck className="h-3 w-3 text-accent" /> Resultaat binnen 3 werkdagen
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-between pt-2">
                      <Button variant="outline" onClick={prev}><ArrowLeft className="h-4 w-4" />Terug</Button>
                      <Button variant="accent" onClick={next}>Volgende <ArrowRight className="h-4 w-4" /></Button>
                    </div>
                  </div>
                )}

                {/* STAP 3 */}
                {stap === 3 && (
                  <div className="space-y-6">
                    <h2 className="text-xl md:text-2xl mb-2">Bevestiging</h2>
                    <Card className="p-5 bg-secondary/50">
                      <h3 className="font-semibold mb-3">Samenvatting</h3>
                      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        <div><dt className="text-muted-foreground">Naam</dt><dd className="font-medium">{form.voornaam} {form.achternaam}</dd></div>
                        <div><dt className="text-muted-foreground">E-mail</dt><dd className="font-medium break-all">{form.email}</dd></div>
                        <div><dt className="text-muted-foreground">Bedrijfsnaam</dt><dd className="font-medium">{form.bedrijfsnaam}</dd></div>
                        <div><dt className="text-muted-foreground">KvK-nummer</dt><dd className="font-medium">{form.kvk_nummer}</dd></div>
                        <div className="sm:col-span-2"><dt className="text-muted-foreground">Gekozen pakket</dt><dd className="font-medium">{gekozenPakket.titel}</dd></div>
                      </dl>
                    </Card>

                    <div className="flex items-start gap-3">
                      <Checkbox id="akkoord" checked={akkoord} onCheckedChange={(c) => setAkkoord(c === true)} className="mt-1" />
                      <Label htmlFor="akkoord" className="text-sm leading-relaxed cursor-pointer">
                        Ik ga akkoord met de <Link to="/cookies" className="text-accent hover:underline">privacyverklaring</Link> en geef toestemming voor het uitvoeren van de screening.
                      </Label>
                    </div>

                    {submitError && (
                      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm" style={{ color: "#E53E2F" }}>
                        Er ging iets mis. Probeer het opnieuw of bel 020 - 457 3077.
                      </div>
                    )}

                    <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3">
                      <Button variant="outline" onClick={prev} disabled={submitting}><ArrowLeft className="h-4 w-4" />Terug</Button>
                      <Button
                        variant="accent"
                        size="lg"
                        className="w-full sm:w-auto"
                        onClick={handleSubmit}
                        disabled={!akkoord || submitting}
                      >
                        {submitting ? "Versturen..." : "Aanvraag versturen"}<ArrowRight className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            </>
          )}
        </div>
      </section>
    </Layout>
  );
}

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { SEOHead } from "@/components/SEOHead";
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
import {
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  HeartHandshake,
  PiggyBank,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LocalizedLink } from "@/components/LocalizedLink";

type Errors = Record<string, string>;

const COUNTRIES = [
  { value: "NL", label: "Nederland (NL)" },
  { value: "BE", label: "België (BE)" },
  { value: "DE", label: "Duitsland (DE)" },
];

const BRANCHES = [
  { value: "ict", label: "ICT (IT & ICT)" },
  { value: "management-consultancy", label: "Management consultancy (HR & Finance consultancy)" },
  { value: "pr-marketing", label: "Reclame en marketing (PR & Marketing)" },
  { value: "coaches", label: "Coaches" },
  { value: "zakelijke-dienstverlening", label: "Zakelijke dienstverlening (Niet-uitvoerende beroepen)" },
  { value: "anders", label: "Anders" },
];

const MEDEWERKERS = ["1", "2", "3", "Meer dan 3"];

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const isKvk = (v: string) => /^[0-9]{8}$/.test(v.trim());
const isNlPhone = (v: string) => {
  const clean = v.replace(/[\s-]/g, "");
  return /^(\+31|0031|0)[1-9][0-9]{8}$/.test(clean);
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

const Required = () => <span className="text-destructive ml-0.5">*</span>;

export default function OffertePage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  const [form, setForm] = useState({
    voornaam: "",
    achternaam: "",
    email: "",
    telefoon: "",
    naam_organisatie: "",
    adres_land: "NL",
    adres_postcode: "",
    adres_huisnummer: "",
    kvk_nummer: "",
    branche: "",
    belangrijkste_opdrachtgever: "",
    omschrijving_werkzaamheden: "",
    aantal_medewerkers: "1",
    gewenste_startdatum: "",
  });

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key as string]) setErrors((e) => ({ ...e, [key as string]: "" }));
  };

  const validate = (): boolean => {
    const e: Errors = {};
    if (!form.voornaam.trim()) e.voornaam = "Vul je voornaam in";
    if (!form.achternaam.trim()) e.achternaam = "Vul je achternaam in";
    if (!form.email.trim()) e.email = "Vul je e-mailadres in";
    else if (!isEmail(form.email)) e.email = "Geen geldig e-mailadres";
    if (!form.telefoon.trim()) e.telefoon = "Vul je telefoonnummer in";
    else if (!isNlPhone(form.telefoon)) e.telefoon = "Geen geldig Nederlands telefoonnummer";
    if (!form.naam_organisatie.trim()) e.naam_organisatie = "Vul de naam van je organisatie in";
    if (!form.kvk_nummer.trim()) e.kvk_nummer = "Vul je KvK-nummer in";
    else if (!isKvk(form.kvk_nummer)) e.kvk_nummer = "Een KvK-nummer bestaat uit 8 cijfers";
    if (!form.branche) e.branche = "Kies een branche";
    if (!form.belangrijkste_opdrachtgever.trim())
      e.belangrijkste_opdrachtgever = "Vul de naam van je belangrijkste opdrachtgever in";
    if (!form.omschrijving_werkzaamheden.trim() || form.omschrijving_werkzaamheden.trim().length < 30)
      e.omschrijving_werkzaamheden = "Beschrijf je werkzaamheden in minimaal 30 tekens";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) {
      toast({
        title: "Vul de verplichte velden in",
        description: "Een paar velden zijn nog niet (correct) ingevuld.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const aantalNum =
        form.aantal_medewerkers === "Meer dan 3" ? null : Number(form.aantal_medewerkers);

      const extra = {
        branche: form.branche,
        belangrijkste_opdrachtgever: form.belangrijkste_opdrachtgever.trim(),
        omschrijving_werkzaamheden: form.omschrijving_werkzaamheden.trim(),
        adres_land: form.adres_land,
        adres_postcode: form.adres_postcode.trim() || null,
        adres_huisnummer: form.adres_huisnummer.trim() || null,
        aantal_medewerkers: form.aantal_medewerkers,
        aantal_medewerkers_num: aantalNum,
        gewenste_startdatum: form.gewenste_startdatum || null,
      };

      // Anon-rol heeft geen SELECT op leads — id client-side genereren.
      const leadId = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`);
      const { error: insertErr } = await supabase
        .from("leads")
        .insert({
          id: leadId,
          type: "offerte-aanvraag" as never,
          voornaam: form.voornaam.trim(),
          achternaam: form.achternaam.trim(),
          email: form.email.trim().toLowerCase(),
          telefoon: form.telefoon.trim(),
          bedrijfsnaam: form.naam_organisatie.trim(),
          kvk_nummer: form.kvk_nummer.trim(),
          beroep: form.branche,
          ingangsdatum: form.gewenste_startdatum || null,
          opmerkingen: form.omschrijving_werkzaamheden.trim(),
          vereist_handmatige_beoordeling:
            form.branche === "anders" || form.aantal_medewerkers === "Meer dan 3",
          extra_data: extra as never,
        });

      if (insertErr) throw insertErr;

      const ref = String(leadId).slice(0, 8);
      const subjectRef = `${form.naam_organisatie.trim()} - ${form.voornaam.trim()} ${form.achternaam.trim()}`;

      try {
        await supabase.functions.invoke("send-lead-notification", {
          body: {
            type: "offerte-aanvraag",
            leadId: leadId,
            reference: subjectRef || ref,
            userEmail: form.email.trim().toLowerCase(),
            fields: {
              "Contactpersoon": `${form.voornaam.trim()} ${form.achternaam.trim()}`,
              "E-mail": form.email.trim().toLowerCase(),
              "Telefoon": form.telefoon.trim(),
              "Bedrijf": form.naam_organisatie.trim(),
              "KvK-nummer": form.kvk_nummer.trim(),
              "Adres": `${form.adres_postcode || "-"} ${form.adres_huisnummer || ""}, ${form.adres_land}`.trim(),
              "Branche": BRANCHES.find((b) => b.value === form.branche)?.label ?? form.branche,
              "Belangrijkste opdrachtgever": form.belangrijkste_opdrachtgever.trim(),
              "Omschrijving werkzaamheden": form.omschrijving_werkzaamheden.trim(),
              "Aantal medewerkers": form.aantal_medewerkers,
              "Gewenste startdatum": form.gewenste_startdatum || "-",
            },
          },
        });
      } catch (notifErr) {
        console.warn("Notification failed", notifErr);
      }

      navigate("/offerte/bedankt");
    } catch (err: any) {
      console.error("[Offerte] submit failed", err);
      const code: string = err?.code ?? "";
      const msg: string = err?.message ?? "";
      let description =
        "We konden je aanvraag niet verwerken. Probeer het over een paar minuten opnieuw of bel ons direct op 020 - 457 3077.";
      if (code === "23505" || /duplicate|unique/i.test(msg)) {
        description =
          "Deze aanvraag staat al bij ons in het systeem. Bel ons op 020 - 457 3077 als je twijfelt.";
      } else if (code === "42501" || /row-level security|permission/i.test(msg)) {
        description =
          "Je aanvraag kon niet worden opgeslagen door een beveiligingsfout. Bel ons op 020 - 457 3077, dan regelen we het persoonlijk.";
      } else if (/network|fetch|failed to fetch/i.test(msg)) {
        description =
          "De server is even niet bereikbaar. Probeer het zo opnieuw of bel 020 - 457 3077.";
      } else if (msg) {
        description = `${msg}. Lukt het niet? Bel 020 - 457 3077.`;
      }
      toast({
        title: "Aanvraag niet verstuurd",
        description,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout>
      <SEOHead
        title="Vrijblijvende offerte BAV en AVB | ZP Zaken"
        description="Vraag eenvoudig een vrijblijvende offerte aan voor je beroeps- en bedrijfsaansprakelijkheidsverzekering. Binnen 24 uur reactie."
        canonical="https://www.zpzaken.nl/offerte"
      />

      {/* HERO */}
      <section className="bg-foreground text-primary-foreground">
        <div className="container-wide py-14 lg:py-20">
          <h1 className="text-primary-foreground mb-3">Vrijblijvende offerte aanvragen</h1>
          <h2 className="text-primary-foreground/80 text-xl md:text-2xl font-normal mb-10">
            Beroeps- en bedrijfsaansprakelijkheidsverzekering
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { icon: ShieldCheck, text: "Gemakkelijk en snel online geregeld" },
              { icon: HeartHandshake, text: "Hulp bij schade. Wij staan voor je klaar" },
              { icon: PiggyBank, text: "De goedkoopste online schadeverzekeraar" },
            ].map(({ icon: Icon, text }) => (
              <div
                key={text}
                className="flex items-center gap-3 bg-background/5 border border-background/10 rounded-xl p-4"
              >
                <CheckCircle2 className="h-5 w-5 text-accent flex-shrink-0" />
                <span className="text-primary-foreground/90 text-sm">{text}</span>
                <Icon className="h-5 w-5 text-primary-foreground/40 ml-auto hidden md:block" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FORM */}
      <section className="section-padding bg-secondary">
        <div className="container-wide max-w-3xl">
          <form onSubmit={handleSubmit} className="bg-card rounded-2xl border border-border shadow-sm p-6 md:p-10 space-y-10">
            {/* GROEP 1 */}
            <fieldset className="space-y-5">
              <h3 className="border-b border-border pb-2 mb-2">Algemene gegevens</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="voornaam">Voornaam<Required /></Label>
                  <Input
                    id="voornaam"
                    value={form.voornaam}
                    onChange={(e) => update("voornaam", e.target.value)}
                    aria-invalid={!!errors.voornaam}
                  />
                  <FieldError message={errors.voornaam} />
                </div>
                <div>
                  <Label htmlFor="achternaam">Achternaam<Required /></Label>
                  <Input
                    id="achternaam"
                    value={form.achternaam}
                    onChange={(e) => update("achternaam", e.target.value)}
                    aria-invalid={!!errors.achternaam}
                  />
                  <FieldError message={errors.achternaam} />
                </div>
                <div>
                  <Label htmlFor="email">E-mail<Required /></Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="mail@example.com"
                    value={form.email}
                    onChange={(e) => update("email", e.target.value)}
                    aria-invalid={!!errors.email}
                  />
                  <FieldError message={errors.email} />
                </div>
                <div>
                  <Label htmlFor="telefoon">Telefoonnr.<Required /></Label>
                  <Input
                    id="telefoon"
                    type="tel"
                    placeholder="+31612345678"
                    value={form.telefoon}
                    onChange={(e) => update("telefoon", e.target.value)}
                    aria-invalid={!!errors.telefoon}
                  />
                  <FieldError message={errors.telefoon} />
                </div>
              </div>
            </fieldset>

            {/* GROEP 2 */}
            <fieldset className="space-y-5">
              <h3 className="border-b border-border pb-2 mb-2">Bedrijfsgegevens</h3>

              <div>
                <Label htmlFor="naam_organisatie">Naam organisatie<Required /></Label>
                <Input
                  id="naam_organisatie"
                  value={form.naam_organisatie}
                  onChange={(e) => update("naam_organisatie", e.target.value)}
                  aria-invalid={!!errors.naam_organisatie}
                />
                <FieldError message={errors.naam_organisatie} />
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium text-foreground/80">Adres organisatie</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <Label htmlFor="adres_land" className="text-xs text-muted-foreground">Land</Label>
                    <Select
                      value={form.adres_land}
                      onValueChange={(v) => update("adres_land", v)}
                    >
                      <SelectTrigger id="adres_land">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COUNTRIES.map((c) => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <button
                    type="button"
                    onClick={() => update("adres_land", "NL")}
                    className="self-end h-10 w-10 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center"
                    aria-label="Reset land naar Nederland"
                    title="Reset"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-[3fr_2fr] gap-3">
                  <div>
                    <Label htmlFor="adres_postcode" className="text-xs text-muted-foreground">Postcode</Label>
                    <Input
                      id="adres_postcode"
                      value={form.adres_postcode}
                      onChange={(e) => update("adres_postcode", e.target.value)}
                      placeholder="1234 AB"
                    />
                  </div>
                  <div>
                    <Label htmlFor="adres_huisnummer" className="text-xs text-muted-foreground">Huisnummer</Label>
                    <Input
                      id="adres_huisnummer"
                      value={form.adres_huisnummer}
                      onChange={(e) => update("adres_huisnummer", e.target.value)}
                      placeholder="12"
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="kvk_nummer">KvK-nummer<Required /></Label>
                <Input
                  id="kvk_nummer"
                  value={form.kvk_nummer}
                  onChange={(e) => update("kvk_nummer", e.target.value.replace(/\D/g, "").slice(0, 8))}
                  placeholder="12345678"
                  inputMode="numeric"
                  aria-invalid={!!errors.kvk_nummer}
                />
                <FieldError message={errors.kvk_nummer} />
              </div>
            </fieldset>

            {/* GROEP 3 */}
            <fieldset className="space-y-5">
              <h3 className="border-b border-border pb-2 mb-2">Opdrachtgever en branche</h3>

              <div>
                <Label htmlFor="branche">Branche<Required /></Label>
                <Select
                  value={form.branche}
                  onValueChange={(v) => update("branche", v)}
                >
                  <SelectTrigger id="branche" aria-invalid={!!errors.branche}>
                    <SelectValue placeholder="Kies een branche" />
                  </SelectTrigger>
                  <SelectContent>
                    {BRANCHES.map((b) => (
                      <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError message={errors.branche} />
                {form.branche === "anders" && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Voor branches buiten ons standaard aanbod beoordelen we je aanvraag handmatig.
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="belangrijkste_opdrachtgever">Naam van je belangrijkste opdrachtgever<Required /></Label>
                <Input
                  id="belangrijkste_opdrachtgever"
                  value={form.belangrijkste_opdrachtgever}
                  onChange={(e) => update("belangrijkste_opdrachtgever", e.target.value)}
                  aria-invalid={!!errors.belangrijkste_opdrachtgever}
                />
                <FieldError message={errors.belangrijkste_opdrachtgever} />
              </div>

              <div>
                <Label htmlFor="omschrijving_werkzaamheden">Omschrijving werkzaamheden<Required /></Label>
                <Textarea
                  id="omschrijving_werkzaamheden"
                  rows={5}
                  value={form.omschrijving_werkzaamheden}
                  onChange={(e) => update("omschrijving_werkzaamheden", e.target.value)}
                  placeholder="Beschrijf in een paar zinnen wat je doet voor opdrachtgevers"
                  aria-invalid={!!errors.omschrijving_werkzaamheden}
                />
                <div className="flex justify-between mt-1">
                  <FieldError message={errors.omschrijving_werkzaamheden} />
                  <span className="text-xs text-muted-foreground ml-auto">
                    {form.omschrijving_werkzaamheden.trim().length} / min 30 tekens
                  </span>
                </div>
              </div>
            </fieldset>

            {/* GROEP 4 — optionele detailgegevens */}
            <fieldset className="space-y-5">
              <h3 className="border-b border-border pb-2 mb-2">
                Detailgegevens <span className="text-sm font-normal text-muted-foreground">(optioneel)</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="aantal_medewerkers">Aantal medewerkers</Label>
                  <Select
                    value={form.aantal_medewerkers}
                    onValueChange={(v) => update("aantal_medewerkers", v)}
                  >
                    <SelectTrigger id="aantal_medewerkers">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MEDEWERKERS.map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.aantal_medewerkers === "Meer dan 3" && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Voor meer dan 3 medewerkers maken we een persoonlijke offerte.
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="gewenste_startdatum">Gewenste startdatum</Label>
                  <Input
                    id="gewenste_startdatum"
                    type="date"
                    min={new Date().toISOString().split("T")[0]}
                    value={form.gewenste_startdatum}
                    onChange={(e) => update("gewenste_startdatum", e.target.value)}
                  />
                </div>
              </div>
            </fieldset>

            {/* SUBMIT */}
            <div className="flex flex-col md:flex-row md:justify-end gap-3 pt-2">
              <Button
                type="submit"
                variant="accent"
                size="lg"
                disabled={submitting}
                className="w-full md:w-auto"
              >
                {submitting ? "Versturen…" : "Offerte vrijblijvend aanvragen"}
                <ArrowRight className="h-5 w-5" />
              </Button>
            </div>

            <p className="text-xs text-muted-foreground text-center md:text-right pt-2">
              Door te versturen ga je akkoord met onze{" "}
              <LocalizedLink to="/algemene-voorwaarden" className="underline underline-offset-2 hover:text-foreground">
                algemene voorwaarden
              </LocalizedLink>{" "}
              en{" "}
              <LocalizedLink to="/cookies" className="underline underline-offset-2 hover:text-foreground">
                privacy statement
              </LocalizedLink>
              .
            </p>
          </form>
        </div>
      </section>
    </Layout>
  );
}

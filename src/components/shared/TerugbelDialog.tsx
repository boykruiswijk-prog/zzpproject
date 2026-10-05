import { useEffect, useState } from "react";
import { CheckCircle, Phone } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { submitPublicForm, useFormGuard, PublicFormError } from "@/lib/antiSpam";
import { trackGenerateLead } from "@/lib/tracking";
import { maakFormulier } from "../../../supabase/functions/_shared/leadVelden";
import { isNlTelefoon, normaliseerNlTelefoon } from "../../../supabase/functions/_shared/telefoon";
import { LocalizedLink } from "@/components/LocalizedLink";

const EVENT = "zp:terugbel";
const MOMENTEN = ["Ochtend", "Middag", "Avond"] as const;

/** Opent het compacte terugbelverzoek (overal op de site, één dialog in Layout). */
export function openTerugbel() {
  window.dispatchEvent(new Event(EVENT));
}

/** Klikhandler voor links naar /contact: opent de dialog, link blijft crawlbaar. */
export function openTerugbelKlik(e: { preventDefault: () => void }) {
  e.preventDefault();
  openTerugbel();
}

export function TerugbelDialog() {
  const [open, setOpen] = useState(false);
  const [naam, setNaam] = useState("");
  const [telefoon, setTelefoon] = useState("");
  const [moment, setMoment] = useState<string>("");
  const [privacy, setPrivacy] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);
  const [klaar, setKlaar] = useState(false);
  const guard = useFormGuard();

  useEffect(() => {
    const h = () => setOpen(true);
    window.addEventListener(EVENT, h);
    return () => window.removeEventListener(EVENT, h);
  }, []);

  async function verstuur(e: React.FormEvent) {
    e.preventDefault();
    if (naam.trim().length < 2) return setFout("Vul je naam in.");
    if (!isNlTelefoon(telefoon)) return setFout("Vul een geldig telefoonnummer in, bijvoorbeeld 06 12345678.");
    if (!privacy) return setFout("Geef toestemming om je terug te bellen.");
    setFout(null);
    setBezig(true);
    const [voornaam, ...rest] = naam.trim().split(/\s+/);
    const tel = normaliseerNlTelefoon(telefoon);
    try {
      const leadId = crypto.randomUUID();
      await submitPublicForm("leads", {
        id: leadId,
        type: "contact", voornaam, achternaam: rest.join(" ") || "-", email: "", telefoon: tel,
        opmerkingen: `Onderwerp: Terugbelverzoek\n\nVoorkeursmoment: ${moment || "Geen voorkeur"}`,
        extra_data: {
          formulier_naam: "Terugbelverzoek", pagina: window.location.pathname, voorkeursmoment: moment || null, toestemming: true,
          formulier: maakFormulier([["Naam", naam], ["Telefoon", tel], ["Voorkeursmoment", moment || "Geen voorkeur"], ["Toestemming terugbellen", "Ja"]]),
        },
      }, guard);
      trackGenerateLead("terugbel");
      setKlaar(true);
    } catch (err) {
      setFout(err instanceof PublicFormError ? err.message : "Verzenden mislukt. Bel ons gerust op 020 - 457 3077.");
    } finally {
      setBezig(false);
    }
  }

  // Inhoud blijft staan bij sluiten; alleen na verzenden opnieuw beginnen.
  function sluit(o: boolean) {
    setOpen(o);
    if (!o && klaar) { setKlaar(false); setNaam(""); setTelefoon(""); setMoment(""); setPrivacy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={sluit}>
      <DialogContent className="max-w-md w-[calc(100vw-2rem)]">
        {klaar ? (
          <div className="text-center py-4 space-y-3">
            <CheckCircle className="h-12 w-12 text-accent mx-auto" aria-hidden="true" />
            <DialogTitle>Gelukt, we bellen je terug</DialogTitle>
            <DialogDescription>Wij regelen het voor je. Je hoort binnen 1 werkdag van ons.</DialogDescription>
            <Button onClick={() => sluit(false)} variant="accent">Sluiten</Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Vrijblijvend gesprek</DialogTitle>
              <DialogDescription>Laat je naam en nummer achter. Wij regelen het voor je, je hoort binnen 1 werkdag van ons.</DialogDescription>
            </DialogHeader>
            <form onSubmit={verstuur} className="space-y-4" noValidate>
              <input type="text" className="hidden" {...guard.honeypotProps} />
              <div>
                <Label htmlFor="tb-naam">Naam *</Label>
                <Input id="tb-naam" autoComplete="name" value={naam} onChange={(e) => setNaam(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="tb-tel">Telefoon *</Label>
                <Input id="tb-tel" type="tel" autoComplete="tel" inputMode="tel" placeholder="06 12345678" value={telefoon} onChange={(e) => setTelefoon(e.target.value)} />
              </div>
              <fieldset>
                <legend className="text-sm font-medium mb-2">Wanneer schikt het?</legend>
                <div className="grid grid-cols-3 gap-2">
                  {MOMENTEN.map((m) => (
                    <button key={m} type="button" aria-pressed={moment === m} onClick={() => setMoment(moment === m ? "" : m)}
                      className={`rounded-md border px-2 py-2 text-sm transition-colors ${moment === m ? "border-accent bg-accent/10 text-accent font-medium" : "border-input hover:border-accent/50"}`}>
                      {m}
                    </button>
                  ))}
                </div>
              </fieldset>
              <div className="flex items-start gap-2">
                <Checkbox id="tb-privacy" checked={privacy} onCheckedChange={(v) => setPrivacy(v === true)} className="mt-0.5" />
                <Label htmlFor="tb-privacy" className="text-sm font-normal leading-snug">
                  Ik wil teruggebeld worden en ga akkoord met de <LocalizedLink to="/privacy" className="underline">privacyverklaring</LocalizedLink>.
                </Label>
              </div>
              {fout && <p role="alert" className="text-sm text-destructive">{fout}</p>}
              <Button type="submit" variant="accent" className="w-full" disabled={bezig}>
                <Phone className="h-4 w-4" aria-hidden="true" /> {bezig ? "Versturen…" : "Bel mij terug"}
              </Button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

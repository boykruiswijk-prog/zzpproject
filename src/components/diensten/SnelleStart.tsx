import { useState } from "react";
import { ArrowRight, Phone, Star, ShieldCheck, Users, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { vanafPrijsregel } from "@/data/bavPakketten";
import { SITE_CONFIG } from "@/config/site";
import { googleReviewsData } from "@/data/googleReviews";
import { controleerSnelleStart, startAanvraag } from "@/lib/snelleStart";
import { openTerugbel } from "@/components/shared/TerugbelDialog";
import { isNlTelefoon } from "../../../supabase/functions/_shared/telefoon";

/** Compacte start bovenaan advertentie- en beroepspagina's: opent het bestaande aanvraagformulier. */
export function SnelleStart() {
  const [email, setEmail] = useState("");
  const [telefoon, setTelefoon] = useState("");
  const [fout, setFout] = useState<string | null>(null);
  const score = googleReviewsData.averageRating.toFixed(1).replace(".", ",");

  function aanvragen(e: React.FormEvent) {
    e.preventDefault();
    const c = controleerSnelleStart(email, telefoon);
    if (c.ok === false) return setFout(c.fout);
    setFout(null);
    startAanvraag(c.gegevens);
  }

  function terugbellen() {
    if (!isNlTelefoon(telefoon)) return setFout("Vul je telefoonnummer in, dan bellen we je terug.");
    setFout(null);
    openTerugbel(telefoon);
  }

  return (
    <div className="w-full max-w-xl space-y-3" data-testid="snelle-start">
      <p className="font-semibold text-white">{vanafPrijsregel()}</p>
      <form onSubmit={aanvragen} noValidate className="rounded-xl bg-card text-card-foreground p-4 shadow-lg space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="ss-email" className="text-xs">E-mailadres</Label>
            <Input id="ss-email" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="ss-tel" className="text-xs">Telefoonnummer</Label>
            <Input id="ss-tel" type="tel" autoComplete="tel" inputMode="tel" placeholder="06 12345678" value={telefoon} onChange={(e) => setTelefoon(e.target.value)} />
          </div>
        </div>
        {fout && <p role="alert" className="text-sm text-destructive">{fout}</p>}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="submit" variant="accent" className="flex-1">Aanvragen in 5 stappen <ArrowRight className="h-4 w-4" /></Button>
          <Button type="button" variant="outline" className="flex-1" onClick={terugbellen}><Phone className="h-4 w-4" /> Bel mij terug</Button>
        </div>
      </form>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/90" aria-label="Waarom ZP Zaken">
        <li className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" aria-hidden />13+ jaar</li>
        <li className="flex items-center gap-1"><Users className="h-3.5 w-3.5" aria-hidden />{SITE_CONFIG.klantenAantal} zzp'ers</li>
        <li className="flex items-center gap-1"><Star className="h-3.5 w-3.5" aria-hidden />{score}/5 reviews</li>
        <li className="flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" aria-hidden />verzekerd bij Hiscox</li>
      </ul>
    </div>
  );
}

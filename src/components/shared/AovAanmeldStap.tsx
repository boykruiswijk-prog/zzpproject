import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { LocalizedLink } from "@/components/LocalizedLink";
import { HoneypotField } from "@/components/shared/HoneypotField";
import { AovRekentool } from "@/components/shared/AovRekentool";
import { useFormGuard } from "@/lib/antiSpam";
import { AOV_TOESTEMMING_TEKST, AOV_TOESTEMMING_UITLEG } from "@/config/aovPagina";
import { aovAanmeldFouten, aovBron, AovDoel, AovAanmelding } from "@/lib/aovDoorverwijzing";
import { ArrowRight, ExternalLink } from "lucide-react";

const SERVER_FOUT: Record<string, string> = {
  aov_email: "Vul een geldig e-mailadres in.",
  aov_naam: "Vul je naam in.",
  aov_telefoon: "Vul een geldig telefoonnummer in of laat dit veld leeg.",
  aov_toestemming: "Zet het vinkje om verder te gaan.",
  aov_limiet: "Je hebt je net al een paar keer aangemeld. Probeer het over tien minuten opnieuw.",
};

export function AovAanmeldStap({ doel }: { doel: AovDoel }) {
  const guard = useFormGuard();
  const [w, setW] = useState<AovAanmelding>({ naam: "", email: "", telefoon: "", toestemming: false });
  const [ingelogd, setIngelogd] = useState(false);
  const [fouten, setFouten] = useState<Partial<Record<keyof AovAanmelding, string>>>({});
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [ref, setRef] = useState<string | null>(null);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user;
      const naam = typeof u?.user_metadata?.full_name === "string" ? u.user_metadata.full_name : "";
      const email = u?.email;
      if (email && naam.trim().length >= 2) { setW(v => ({ ...v, naam, email })); setIngelogd(true); }
    }).catch(() => {});
  }, []);

  const verstuur = async (e: React.FormEvent) => {
    e.preventDefault();
    setFout(null);
    const f = aovAanmeldFouten(w); setFouten(f);
    if (Object.keys(f).length) return;
    setBezig(true);
    let landing = null;
    try { landing = JSON.parse(sessionStorage.getItem("zp_attributie") || "null"); } catch { /* geen opslag */ }
    const test = !["zpzaken.nl", "www.zpzaken.nl"].includes(window.location.hostname);
    const { data, error } = await supabase.rpc("aov_aanmelden", {
      p_naam: w.naam.trim(), p_email: w.email.trim(), p_telefoon: w.telefoon.trim(), p_toestemming: w.toestemming,
      p_toestemming_tekst: AOV_TOESTEMMING_TEKST, p_doel: doel, p_bron: aovBron(window.location.pathname, landing, test), p_honeypot: guard.honeypot,
    });
    setBezig(false);
    if (error || !data) {
      const code = Object.keys(SERVER_FOUT).find(k => error?.message?.includes(k));
      setFout(code ? SERVER_FOUT[code] : "Je aanmelding kon niet worden opgeslagen. Probeer het opnieuw.");
      return;
    }
    setRef(data);
  };

  if (ref) {
    return (
      <div role="status" className="rounded-2xl border border-border bg-card p-6 space-y-3">
        <AovRekentool referentie={ref} />
        <p className="text-sm text-muted-foreground">Je polissen bij ZP Zaken vind je in <LocalizedLink to="/mijn-zp/polis" className="underline underline-offset-2">Mijn ZP</LocalizedLink>. Bescherm ook je bedrijf met de <LocalizedLink to="/verzekeringen" className="underline underline-offset-2">BAV + AVB</LocalizedLink>.</p>
      </div>
    );
  }

  return (
    <form onSubmit={verstuur} noValidate className="relative rounded-2xl border border-border bg-card p-6 space-y-4" aria-label="Aanmelden voor de AOV">
      <HoneypotField guard={guard} />
      {ingelogd ? (
        <p className="text-sm">Je meldt je aan als <strong>{w.naam}</strong> ({w.email}).</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="aov-naam">Naam</Label>
            <Input id="aov-naam" name="naam" autoComplete="name" maxLength={120} value={w.naam} onChange={e => setW({ ...w, naam: e.target.value })} aria-invalid={!!fouten.naam} aria-describedby={fouten.naam ? "aov-naam-fout" : undefined} />
            {fouten.naam && <p id="aov-naam-fout" className="text-sm text-destructive">{fouten.naam}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="aov-email">E-mailadres</Label>
            <Input id="aov-email" name="email" type="email" autoComplete="email" maxLength={254} value={w.email} onChange={e => setW({ ...w, email: e.target.value })} aria-invalid={!!fouten.email} aria-describedby={fouten.email ? "aov-email-fout" : undefined} />
            {fouten.email && <p id="aov-email-fout" className="text-sm text-destructive">{fouten.email}</p>}
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="aov-telefoon">Telefoon <span className="text-muted-foreground font-normal">(optioneel)</span></Label>
            <Input id="aov-telefoon" name="telefoon" type="tel" autoComplete="tel" maxLength={20} value={w.telefoon} onChange={e => setW({ ...w, telefoon: e.target.value })} aria-invalid={!!fouten.telefoon} />
            {fouten.telefoon && <p className="text-sm text-destructive">{fouten.telefoon}</p>}
          </div>
        </div>
      )}
      <div className="flex items-start gap-3">
        <Checkbox id="aov-toestemming" name="toestemming" checked={w.toestemming} onCheckedChange={c => setW({ ...w, toestemming: c === true })} aria-invalid={!!fouten.toestemming} className="mt-0.5" />
        <Label htmlFor="aov-toestemming" className="font-normal leading-relaxed">{AOV_TOESTEMMING_TEKST}</Label>
      </div>
      {fouten.toestemming && <p className="text-sm text-destructive">{fouten.toestemming}</p>}
      <p className="text-xs text-muted-foreground leading-relaxed">{AOV_TOESTEMMING_UITLEG}{" "}<LocalizedLink to="/cookies#aov-doorverwijzingen" className="underline underline-offset-2">Lees de privacyverklaring</LocalizedLink>.</p>
      {fout && (
        <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <p className="text-destructive">{fout}</p>
        </div>
      )}
      <Button type="submit" variant="accent" size="lg" disabled={bezig} className="h-auto min-h-12 whitespace-normal">
        {bezig ? "Bezig met opslaan..." : doel === "rekentool" ? "Verder naar de rekentool" : "Verder naar de externe adviseur"} {doel === "rekentool" ? <ArrowRight className="h-4 w-4" /> : <ExternalLink className="h-4 w-4" aria-hidden="true" />}
      </Button>
    </form>
  );
}

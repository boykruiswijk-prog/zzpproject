import { Phone, MessageCircle, ShieldCheck } from "lucide-react";
import { SITE_CONFIG } from "@/config/site";
import { trackWhatsApp } from "@/lib/tracking";

/**
 * Geruststelling direct boven het IBAN-veld. Feitelijk: de premie wordt per hele periode vanaf de
 * ingangsdatum gefactureerd en geïncasseerd (niet "pas als de verzekering ingaat", want de eerste factuur
 * kan bij activatie vóór de ingangsdatum worden gemaakt).
 */
export function ibanVertrouwenTekst(periode: "maand" | "jaar"): string {
  return `Je IBAN is nodig voor de automatische incasso van je premie. Je betaalt ${periode === "maand" ? "per maand" : "per jaar"}, vanaf de ingangsdatum die je kiest. Dagelijks opzegbaar, geen eigen risico en geen kosten vooraf.`;
}

export function IbanVertrouwen({ periode }: { periode: "maand" | "jaar" }) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm" data-testid="iban-vertrouwen">
      <p className="font-semibold flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" />Waarom je IBAN?</p>
      <p className="text-muted-foreground mt-1">{ibanVertrouwenTekst(periode)}</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <a href={`tel:${SITE_CONFIG.contact.phone}`} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
          <Phone className="h-4 w-4" />Vragen? Bel {SITE_CONFIG.contact.phoneDisplay}
        </a>
        <a href={SITE_CONFIG.contact.whatsappUrl} target="_blank" rel="noopener noreferrer" onClick={() => trackWhatsApp()}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 font-medium hover:bg-muted">
          <MessageCircle className="h-4 w-4" />WhatsApp
        </a>
      </div>
      <p className="text-xs text-muted-foreground mt-2">Persoonlijke service door ons eigen team.</p>
    </div>
  );
}

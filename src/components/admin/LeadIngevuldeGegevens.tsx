import { Mail, Phone } from "lucide-react";
import { leadWeergave, type FormVeld } from "../../../supabase/functions/_shared/leadVelden";

function Waarde({ veld }: { veld: FormVeld }) {
  if (veld.label === "E-mail") return <a href={`mailto:${veld.waarde}`} className="break-all text-primary hover:underline">{veld.waarde}</a>;
  if (veld.label === "Telefoon") return <a href={`tel:${veld.waarde.replace(/[^\d+]/g, "")}`} className="text-primary hover:underline">{veld.waarde}</a>;
  return <span className="whitespace-pre-line break-words">{veld.waarde}</span>;
}

function Lijst({ velden }: { velden: FormVeld[] }) {
  return (
    <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
      {velden.map((v, i) => (
        <div key={`${v.label}-${i}`} className="contents">
          <dt className="text-muted-foreground">{v.label}</dt>
          <dd className="mb-2 min-w-0 font-medium sm:mb-0"><Waarde veld={v} /></dd>
        </div>
      ))}
    </dl>
  );
}

/** Alles wat de bezoeker heeft ingevuld: Contact, Aanvraag, alle velden, bericht. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function LeadIngevuldeGegevens({ lead }: { lead: Record<string, any> }) {
  const w = leadWeergave(lead);
  const alle = [...w.formulier, ...w.overig];
  return (
    <div className="space-y-6">
      <section aria-labelledby="lead-contact">
        <h4 id="lead-contact" className="mb-3 font-medium">Contact</h4>
        <div className="mb-3 flex flex-wrap gap-2">
          {w.email && (
            <a href={`mailto:${w.email}`} className="inline-flex min-h-10 min-w-0 items-center gap-2 rounded-md border px-3 text-sm text-primary hover:bg-secondary">
              <Mail className="h-4 w-4 shrink-0" /><span className="break-all">{w.email}</span>
            </a>
          )}
          {w.telefoon && (
            <a href={`tel:${w.telefoon.replace(/[^\d+]/g, "")}`} className="inline-flex min-h-10 items-center gap-2 rounded-md border px-3 text-sm text-primary hover:bg-secondary">
              <Phone className="h-4 w-4 shrink-0" />{w.telefoon}
            </a>
          )}
        </div>
        <Lijst velden={w.contact} />
      </section>

      <section aria-labelledby="lead-aanvraag" className="border-t pt-4">
        <h4 id="lead-aanvraag" className="mb-3 font-medium">Aanvraag</h4>
        <Lijst velden={w.aanvraag} />
      </section>

      {w.bericht && (
        <section aria-labelledby="lead-bericht" className="border-t pt-4">
          <h4 id="lead-bericht" className="mb-2 font-medium">Bericht / opmerkingen</h4>
          <p className="whitespace-pre-line break-words rounded-lg bg-secondary/50 p-3 text-sm">{w.bericht}</p>
        </section>
      )}

      <section aria-labelledby="lead-alle" className="border-t pt-4">
        <h4 id="lead-alle" className="mb-1 font-medium">Alle ingevulde velden</h4>
        <p className="mb-3 text-xs text-muted-foreground">
          {w.heeftFormulier ? "Zoals ingevuld op het formulier, aangevuld met overige gegevens." : "Oudere lead: velden afgeleid uit de opgeslagen gegevens en het bericht."}
        </p>
        {alle.length ? <Lijst velden={alle} /> : <p className="text-sm text-muted-foreground">Geen aanvullende velden.</p>}
      </section>

      {w.systeem.length > 0 && (
        <details className="border-t pt-4 text-sm">
          <summary className="cursor-pointer font-medium">Systeemgegevens ({w.systeem.length})</summary>
          <div className="mt-3"><Lijst velden={w.systeem} /></div>
        </details>
      )}
    </div>
  );
}

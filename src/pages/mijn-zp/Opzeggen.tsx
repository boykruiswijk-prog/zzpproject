import { useState } from "react";
import { format, parseISO } from "date-fns";
import { nl } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import {
  ServiceWizardShell,
  IdentificatieStep,
  validateIdentificatie,
} from "@/components/mijn-zp/ServiceWizardShell";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { formatDateNL } from "@/lib/dateFormat";
import {
  OPZEG_MAX_DAGEN_VOORUIT,
  OPZEG_TOELICHTING_MAX,
  OPZEG_TOELICHTING_MIN,
  plusDagen,
  valideerOpzegdatum,
  valideerToelichting,
  vandaagNL,
} from "@/lib/opzegValidatie";

export const OPZEG_REDENEN = [
  "Wijzigen entiteit (bijvoorbeeld omzetting naar BV)",
  "(Tijdelijke) loondienst",
  "Stoppen met zelfstandig ondernemen",
  "Anders",
];

export function valideerRedenStap(d: Record<string, any>): Record<string, string> {
  const e: Record<string, string> = {};
  if (!d.reden) e.reden = "Kies een reden.";
  const t = valideerToelichting(d.reden, d.toelichting);
  if (t) e.toelichting = t;
  return e;
}

export function valideerDatumStap(d: Record<string, any>, vandaag?: string): Record<string, string> {
  const f = valideerOpzegdatum(d.opzegdatum, vandaag);
  return f ? { opzegdatum: f } : {};
}

const Fout = ({ id, tekst }: { id: string; tekst?: string }) =>
  tekst ? <p id={id} role="alert" className="text-sm text-destructive mt-1">{tekst}</p> : null;

function DatumKiezer({ waarde, onKies, fout }: { waarde?: string; onKies: (v: string) => void; fout?: string }) {
  const [open, setOpen] = useState(false);
  const vandaag = vandaagNL();
  const min = parseISO(vandaag);
  const max = parseISO(plusDagen(vandaag, OPZEG_MAX_DAGEN_VOORUIT));
  const gekozen = waarde ? parseISO(waarde) : undefined;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id="opzegdatum"
          type="button"
          variant="outline"
          aria-invalid={!!fout}
          aria-describedby={fout ? "fout-opzegdatum" : "uitleg-opzegdatum"}
          className={cn("w-full sm:w-[280px] justify-start text-left font-normal", !gekozen && "text-muted-foreground", fout && "border-destructive")}
        >
          <CalendarIcon className="h-4 w-4" />
          {gekozen ? format(gekozen, "EEEE d MMMM yyyy", { locale: nl }) : "Kies een datum"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          locale={nl}
          weekStartsOn={1}
          selected={gekozen}
          defaultMonth={gekozen ?? min}
          fromDate={min}
          toDate={max}
          disabled={[{ before: min }, { after: max }]}
          onSelect={(d) => {
            if (!d) return;
            onKies(format(d, "yyyy-MM-dd"));
            setOpen(false);
          }}
          initialFocus
          className="p-3 pointer-events-auto"
        />
      </PopoverContent>
    </Popover>
  );
}

export default function OpzeggenWizard() {
  return (
    <ServiceWizardShell
      type="opzeggen"
      pageTitle="Verzekering opzeggen | Mijn ZP, ZP Zaken"
      pageDescription="Zeg je BAV-verzekering bij ZP Zaken eenvoudig op. Dagelijks opzegbaar, binnen 24 uur verwerkt."
      introTitle="Verzekering opzeggen"
      introText="Je BAV-verzekering opzeggen kan dagelijks. Vul het formulier in. Wij verwerken je opzegging binnen 24 uur en sturen je per mail een bevestiging."
      submitLabel="Verstuur opzegging"
      successTitle="Je opzegging is ontvangen"
      successText={(email) => `We verwerken je opzegging binnen 24 uur. Je ontvangt een bevestiging op ${email}.`}
      steps={[
        {
          title: "Identificatie",
          render: IdentificatieStep,
          validate: (f) => validateIdentificatie(f),
        },
        {
          title: "Reden van opzeggen",
          render: ({ details, setDetails, errors }) => (
            <fieldset className="space-y-3" aria-describedby={errors.reden ? "fout-reden" : undefined}>
              <legend className="sr-only">Kies een reden</legend>
              {OPZEG_REDENEN.map((r) => (
                <label
                  key={r}
                  className="flex items-start gap-2 p-3 rounded border border-border hover:bg-secondary/50 cursor-pointer has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
                >
                  <input
                    type="radio"
                    name="reden"
                    value={r}
                    checked={details.reden === r}
                    onChange={() => setDetails({ ...details, reden: r })}
                    className="mt-1 accent-[hsl(var(--accent))]"
                  />
                  <span className="text-sm">{r}</span>
                </label>
              ))}
              <Fout id="fout-reden" tekst={errors.reden} />
              {details.reden === "Anders" && (
                <div className="space-y-1">
                  <Label htmlFor="toelichting">Toelichting *</Label>
                  <Textarea
                    id="toelichting"
                    maxLength={OPZEG_TOELICHTING_MAX}
                    aria-invalid={!!errors.toelichting}
                    aria-describedby="teller-toelichting fout-toelichting"
                    value={details.toelichting ?? ""}
                    onChange={(e) => setDetails({ ...details, toelichting: e.target.value })}
                    placeholder="Vertel kort waarom je de verzekering wilt opzeggen…"
                  />
                  <p id="teller-toelichting" className="text-xs text-muted-foreground">
                    Minimaal {OPZEG_TOELICHTING_MIN}, maximaal {OPZEG_TOELICHTING_MAX} tekens ({(details.toelichting ?? "").length}/{OPZEG_TOELICHTING_MAX}).
                  </p>
                  <Fout id="fout-toelichting" tekst={errors.toelichting} />
                </div>
              )}
            </fieldset>
          ),
          validate: (_, d) => valideerRedenStap(d),
        },
        {
          title: "Gewenste opzegdatum",
          render: ({ details, setDetails, errors }) => (
            <div className="space-y-2">
              <Label htmlFor="opzegdatum">Opzegdatum *</Label>
              <DatumKiezer
                waarde={details.opzegdatum}
                fout={errors.opzegdatum}
                onKies={(v) => setDetails({ ...details, opzegdatum: v })}
              />
              <Fout id="fout-opzegdatum" tekst={errors.opzegdatum} />
              <p id="uitleg-opzegdatum" className="text-xs text-muted-foreground">
                Per dag opzegbaar, ten vroegste vanaf vandaag. Wij verwerken je opzegging binnen 24 uur en sturen je een
                bevestiging per mail.
              </p>
            </div>
          ),
          validate: (_, d) => valideerDatumStap(d),
        },
        {
          title: "Bevestiging",
          render: ({ formData, details, setDetails, errors }) => (
            <div className="space-y-4 text-sm">
              <div className="bg-muted/50 rounded-lg p-4 space-y-1 break-words">
                <div><span className="font-medium">Naam:</span> {formData.voornaam} {formData.achternaam}</div>
                <div><span className="font-medium">E-mail:</span> {formData.email}</div>
                <div><span className="font-medium">Telefoon:</span> {formData.telefoon}</div>
                <div><span className="font-medium">Polisnummer:</span> {formData.polisnummer}</div>
                <div><span className="font-medium">Reden:</span> {details.reden}</div>
                {details.reden === "Anders" && details.toelichting && (
                  <div><span className="font-medium">Toelichting:</span> {details.toelichting}</div>
                )}
                <div><span className="font-medium">Opzegdatum:</span> {formatDateNL(details.opzegdatum)}</div>
              </div>
              <div className="flex items-start gap-2">
                <Checkbox
                  id="bevestigd"
                  aria-invalid={!!errors.bevestigd}
                  aria-describedby={errors.bevestigd ? "fout-bevestigd" : undefined}
                  checked={!!details.bevestigd}
                  onCheckedChange={(c) => setDetails({ ...details, bevestigd: c === true })}
                  className="mt-0.5"
                />
                <Label htmlFor="bevestigd" className="font-normal leading-snug cursor-pointer">
                  Ik bevestig dat ik mijn BAV-verzekering bij ZP Zaken wil opzeggen per{" "}
                  <strong>{formatDateNL(details.opzegdatum)}</strong>
                </Label>
              </div>
              <Fout id="fout-bevestigd" tekst={errors.bevestigd} />
            </div>
          ),
          validate: (_, d) => (d.bevestigd ? {} : { bevestigd: "Vink aan dat je de opzegging bevestigt." }),
        },
      ]}
    />
  );
}

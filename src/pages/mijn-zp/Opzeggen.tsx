import {
  ServiceWizardShell,
  IdentificatieStep,
  validateIdentificatie,
} from "@/components/mijn-zp/ServiceWizardShell";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

const REDENEN = [
  "Wijzigen entiteit (bijvoorbeeld omzetting naar BV)",
  "(Tijdelijke) loondienst",
  "Stoppen met zelfstandig ondernemen",
  "Anders",
];

function defaultDate(offsetDays: number) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split("T")[0];
}

export default function OpzeggenWizard() {
  return (
    <ServiceWizardShell
      type="opzeggen"
      pageTitle="Verzekering opzeggen | Mijn ZP — ZP Zaken"
      pageDescription="Zeg je BAV-verzekering bij ZP Zaken eenvoudig op. Dagelijks opzegbaar, binnen 24 uur verwerkt."
      introTitle="Verzekering opzeggen"
      introText="Je BAV-verzekering opzeggen kan dagelijks. Vul de wizard in — wij verwerken je opzegging binnen 24 uur en sturen je per mail een bevestiging."
      steps={[
        {
          title: "Identificatie",
          render: IdentificatieStep,
          validate: (f) => validateIdentificatie(f),
        },
        {
          title: "Reden van opzeggen",
          render: ({ details, setDetails }) => (
            <div className="space-y-3">
              {REDENEN.map((r) => (
                <label
                  key={r}
                  className="flex items-start gap-2 p-3 rounded border border-border hover:bg-secondary/50 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="reden"
                    checked={details.reden === r}
                    onChange={() => setDetails({ ...details, reden: r })}
                    className="mt-1"
                  />
                  <span className="text-sm">{r}</span>
                </label>
              ))}
              {details.reden === "Anders" && (
                <div>
                  <Label>Toelichting * (minimaal 20 tekens)</Label>
                  <Textarea
                    value={details.toelichting ?? ""}
                    onChange={(e) => setDetails({ ...details, toelichting: e.target.value })}
                    placeholder="Vertel kort waarom je de verzekering wilt opzeggen…"
                  />
                </div>
              )}
            </div>
          ),
          validate: (_, d) => {
            const e: Record<string, string> = {};
            if (!d.reden) e.reden = "Kies een reden";
            if (d.reden === "Anders" && (d.toelichting?.trim().length ?? 0) < 20)
              e.toelichting = "Geef minimaal 20 tekens toelichting";
            return e;
          },
        },
        {
          title: "Gewenste opzegdatum",
          render: ({ details, setDetails }) => (
            <div className="space-y-2">
              <Label>Opzegdatum *</Label>
              <Input
                type="date"
                min={defaultDate(0)}
                max={defaultDate(180)}
                value={details.opzegdatum ?? defaultDate(30)}
                onChange={(e) => setDetails({ ...details, opzegdatum: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Per dag opzegbaar. Wij verwerken je opzegging binnen 24 uur en sturen je een
                bevestiging per mail.
              </p>
            </div>
          ),
          validate: (_, d) => (d.opzegdatum ? {} : { opzegdatum: "Kies een opzegdatum" }),
        },
        {
          title: "Bevestiging",
          render: ({ formData, details, setDetails }) => (
            <div className="space-y-4 text-sm">
              <div className="bg-muted/50 rounded-lg p-4 space-y-1">
                <div><span className="font-medium">Naam:</span> {formData.voornaam} {formData.achternaam}</div>
                <div><span className="font-medium">Email:</span> {formData.email}</div>
                <div><span className="font-medium">Telefoon:</span> {formData.telefoon}</div>
                <div><span className="font-medium">Polisnummer:</span> {formData.polisnummer}</div>
                <div><span className="font-medium">Reden:</span> {details.reden}</div>
                {details.toelichting && (
                  <div><span className="font-medium">Toelichting:</span> {details.toelichting}</div>
                )}
                <div><span className="font-medium">Opzegdatum:</span> {details.opzegdatum ?? defaultDate(30)}</div>
              </div>
              <label className="flex items-start gap-2 cursor-pointer">
                <Checkbox
                  checked={!!details.bevestigd}
                  onCheckedChange={(c) => setDetails({ ...details, bevestigd: c === true })}
                />
                <span>
                  Ik bevestig dat ik mijn BAV verzekering bij ZP Zaken wil opzeggen per{" "}
                  <strong>{details.opzegdatum ?? defaultDate(30)}</strong>
                </span>
              </label>
            </div>
          ),
          validate: (_, d) => (d.bevestigd ? {} : { bevestigd: "Bevestiging vereist" }),
        },
      ]}
    />
  );
}

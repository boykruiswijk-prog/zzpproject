import {
  ServiceWizardShell,
  IdentificatieStep,
  validateIdentificatie,
} from "@/components/mijn-zp/ServiceWizardShell";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ShieldCheck } from "lucide-react";

const REDENEN = [
  "Tijdelijke loondienst",
  "Pensioen",
  "Geen opdracht / tussen opdrachten in",
  "Anders",
];

export default function PauzerenWizard() {
  return (
    <ServiceWizardShell
      type="pauzeren"
      pageTitle="Verzekering pauzeren | Mijn ZP, ZP Zaken"
      pageDescription="Pauzeer tijdelijk je BAV/AVB. Je uitlooprisico blijft behouden. Binnen 24 uur verwerkt."
      introTitle="Verzekering pauzeren"
      introText="Tijdelijk geen opdracht of in loondienst? Pauzeer je verzekering: je uitlooprisico blijft behouden."
      steps={[
        {
          title: "Identificatie",
          render: IdentificatieStep,
          validate: (f) => validateIdentificatie(f),
        },
        {
          title: "Reden van pauzeren",
          render: ({ details, setDetails }) => (
            <div className="space-y-3">
              {REDENEN.map((r) => (
                <label key={r} className="flex items-start gap-2 p-3 rounded border border-border hover:bg-secondary/50 cursor-pointer">
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
                  <Label>Toelichting *</Label>
                  <Textarea
                    value={details.toelichting ?? ""}
                    onChange={(e) => setDetails({ ...details, toelichting: e.target.value })}
                  />
                </div>
              )}
            </div>
          ),
          validate: (_, d) => {
            const e: Record<string, string> = {};
            if (!d.reden) e.reden = "Kies een reden";
            if (d.reden === "Anders" && !d.toelichting?.trim()) e.toelichting = "Toelichting vereist";
            return e;
          },
        },
        {
          title: "Periode",
          render: ({ details, setDetails }) => (
            <div className="space-y-4">
              <div>
                <Label>Pauzeer vanaf *</Label>
                <Input
                  type="date"
                  min={new Date().toISOString().split("T")[0]}
                  value={details.vanaf ?? ""}
                  onChange={(e) => setDetails({ ...details, vanaf: e.target.value })}
                />
              </div>
              <div>
                <Label>Verwachte hervattingsdatum (optioneel)</Label>
                <Input
                  type="date"
                  value={details.hervatting ?? ""}
                  onChange={(e) => setDetails({ ...details, hervatting: e.target.value })}
                />
              </div>
            </div>
          ),
          validate: (_, d) => (d.vanaf ? {} : { vanaf: "Kies een startdatum" }),
        },
        {
          title: "Bevestiging",
          render: ({ details, setDetails }) => (
            <div className="space-y-4">
              <div className="p-4 rounded-lg border border-accent/30 bg-accent/5 flex gap-3">
                <ShieldCheck className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-sm mb-1">Goed om te weten</p>
                  <p className="text-sm text-muted-foreground">
                    Jouw uitlooprisico blijft tijdens de pauze gewoon behouden. Schades die voortvloeien
                    uit werkzaamheden van vóór de pauze blijven gedekt.
                  </p>
                </div>
              </div>
              <label className="flex items-start gap-2 cursor-pointer">
                <Checkbox
                  checked={!!details.bevestigd}
                  onCheckedChange={(c) => setDetails({ ...details, bevestigd: c === true })}
                />
                <span className="text-sm">Ik begrijp de pauzeringsregeling</span>
              </label>
            </div>
          ),
          validate: (_, d) => (d.bevestigd ? {} : { bevestigd: "Bevestiging vereist" }),
        },
      ]}
    />
  );
}

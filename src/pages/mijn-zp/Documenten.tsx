import {
  ServiceWizardShell,
  IdentificatieStep,
  validateIdentificatie,
} from "@/components/mijn-zp/ServiceWizardShell";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Mail } from "lucide-react";

const DOCS = [
  "Polisblad",
  "Polisvoorwaarden",
  "Verzekeringskaart",
  "Premiebewijs / factuur",
  "Schadehistorie",
];

export default function DocumentenWizard() {
  return (
    <ServiceWizardShell
      type="documenten"
      pageTitle="Documenten opvragen | Mijn ZP — ZP Zaken"
      pageDescription="Vraag eenvoudig je polisstukken op (polisblad, voorwaarden, premiebewijs). Binnen 24 uur per mail."
      introTitle="Documenten ontvangen"
      introText="Vraag je polisstukken op. Je ontvangt ze binnen 24 uur per mail."
      steps={[
        {
          title: "Identificatie",
          render: IdentificatieStep,
          validate: (f) => validateIdentificatie(f),
        },
        {
          title: "Welke documenten?",
          render: ({ details, setDetails }) => {
            const selected: string[] = details.documenten ?? [];
            const toggle = (d: string) => {
              setDetails({
                ...details,
                documenten: selected.includes(d) ? selected.filter((x) => x !== d) : [...selected, d],
              });
            };
            return (
              <div className="space-y-2">
                {DOCS.map((d) => (
                  <label key={d} className="flex items-center gap-2 p-2 rounded border border-border hover:bg-secondary/50 cursor-pointer">
                    <Checkbox checked={selected.includes(d)} onCheckedChange={() => toggle(d)} />
                    <span className="text-sm">{d}</span>
                  </label>
                ))}
                <div>
                  <Label>Anders (toelichting)</Label>
                  <Textarea
                    value={details.anders ?? ""}
                    onChange={(e) => setDetails({ ...details, anders: e.target.value })}
                  />
                </div>
              </div>
            );
          },
          validate: (_, d) =>
            (d.documenten?.length ?? 0) > 0 || d.anders?.trim()
              ? {}
              : { documenten: "Selecteer minimaal één document of vul 'Anders' in" },
        },
        {
          title: "Bevestiging",
          render: ({ formData }) => (
            <div className="p-4 rounded-lg border border-accent/30 bg-accent/5 flex gap-3">
              <Mail className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold mb-1">Verzending per e-mail</p>
                <p className="text-muted-foreground">
                  We sturen je documenten per e-mail naar{" "}
                  <strong>{formData.email || "het adres dat je hebt opgegeven in stap 1"}</strong>.
                  Je ontvangt ze binnen 24 uur.
                </p>
              </div>
            </div>
          ),
        },
      ]}
    />
  );
}

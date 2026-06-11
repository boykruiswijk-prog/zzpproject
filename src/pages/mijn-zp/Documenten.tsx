import {
  ServiceWizardShell,
  IdentificatieStep,
  validateIdentificatie,
} from "@/components/mijn-zp/ServiceWizardShell";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

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
      pageDescription="Vraag eenvoudig je polisstukken op (polisblad, voorwaarden, premiebewijs). Binnen 24 uur."
      introTitle="Documenten ontvangen"
      introText="Vraag je polisstukken op. Je ontvangt ze binnen 24 uur per mail of post."
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
          title: "Verzendwijze",
          render: ({ details, setDetails }) => (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {["email", "post"].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setDetails({ ...details, verzending: v })}
                    className={`p-3 rounded border-2 text-sm font-medium transition-colors ${
                      details.verzending === v ? "border-accent bg-accent/5" : "border-border"
                    }`}
                  >
                    {v === "email" ? "Per e-mail" : "Per post"}
                  </button>
                ))}
              </div>
              {details.verzending === "post" && (
                <div className="space-y-3">
                  <div>
                    <Label>Straat + huisnummer *</Label>
                    <Input value={details.straat ?? ""} onChange={(e) => setDetails({ ...details, straat: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Postcode *</Label>
                      <Input value={details.postcode ?? ""} onChange={(e) => setDetails({ ...details, postcode: e.target.value })} />
                    </div>
                    <div>
                      <Label>Plaats *</Label>
                      <Input value={details.plaats ?? ""} onChange={(e) => setDetails({ ...details, plaats: e.target.value })} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          ),
          validate: (_, d) => {
            const e: Record<string, string> = {};
            if (!d.verzending) e.verzending = "Kies verzendwijze";
            if (d.verzending === "post") {
              if (!d.straat?.trim()) e.straat = "Verplicht";
              if (!d.postcode?.trim()) e.postcode = "Verplicht";
              if (!d.plaats?.trim()) e.plaats = "Verplicht";
            }
            return e;
          },
        },
      ]}
    />
  );
}

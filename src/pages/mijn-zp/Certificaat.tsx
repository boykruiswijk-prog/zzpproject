import {
  ServiceWizardShell,
  IdentificatieStep,
  validateIdentificatie,
} from "@/components/mijn-zp/ServiceWizardShell";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function PolisWizard() {
  return (
    <ServiceWizardShell
      type="certificaat"
      pageTitle="Polis opvragen | Mijn ZP, ZP Zaken"
      pageDescription="Vraag een verzekeringspolis (BAV/AVB) aan via Mijn ZP. Binnen 24 uur per mail."
      introTitle="Polis opvragen"
      introText="Heb je een verzekeringspolis nodig voor een opdrachtgever? Vul het formulier in. We sturen hem binnen 24 uur op."
      steps={[
        {
          title: "Identificatie",
          render: IdentificatieStep,
          validate: (f) => validateIdentificatie(f),
        },
        {
          title: "Waarvoor heb je de polis nodig?",
          render: ({ details, setDetails }) => (
            <div className="space-y-4">
              <div>
                <Label>Doel *</Label>
                <select
                  className="w-full border border-input rounded-md px-3 py-2 bg-background"
                  value={details.doel ?? ""}
                  onChange={(e) => setDetails({ ...details, doel: e.target.value })}
                >
                  <option value="">- kies -</option>
                  <option>Opdrachtgever vraagt verzekeringsbewijs</option>
                  <option>Aanbesteding</option>
                  <option>Persoonlijk archief</option>
                  <option>Anders</option>
                </select>
              </div>
              <div>
                <Label>Toelichting (optioneel)</Label>
                <Textarea
                  value={details.toelichting ?? ""}
                  onChange={(e) => setDetails({ ...details, toelichting: e.target.value })}
                />
              </div>
            </div>
          ),
          validate: (_, d) => (d.doel ? {} : { doel: "Selecteer een doel" }),
        },
        {
          title: "Opdrachtgever (optioneel)",
          render: ({ details, setDetails }) => (
            <div className="space-y-4">
              <div>
                <Label>Naam opdrachtgever</Label>
                <Input value={details.opdrachtgeverNaam ?? ""}
                  onChange={(e) => setDetails({ ...details, opdrachtgeverNaam: e.target.value })} />
              </div>
              <div>
                <Label>E-mail opdrachtgever</Label>
                <Input type="email" value={details.opdrachtgeverEmail ?? ""}
                  onChange={(e) => setDetails({ ...details, opdrachtgeverEmail: e.target.value })} />
                <p className="text-xs text-muted-foreground mt-1">
                  Wij sturen de polis dan direct naar dit adres.
                </p>
              </div>
            </div>
          ),
        },
      ]}
    />
  );
}

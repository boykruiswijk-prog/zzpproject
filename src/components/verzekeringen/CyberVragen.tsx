import { CYBER_VRAGEN, type CyberAntwoorden } from "../../../supabase/functions/_shared/cyber";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

export function CyberVragen({ antwoorden, onChange }: { antwoorden: CyberAntwoorden; onChange: (antwoorden: CyberAntwoorden) => void }) {
  return <fieldset className="space-y-4 border-t border-border pt-5">
    <legend className="text-base font-semibold">Vragen over cyberdekking</legend>
    {CYBER_VRAGEN.map((q) => <div key={q.id} className="space-y-2">
      <p id={`cyber-vraag-${q.id}`} className="text-sm">{q.tekst}</p>
      <RadioGroup aria-labelledby={`cyber-vraag-${q.id}`} value={typeof antwoorden[q.id] === "boolean" ? String(antwoorden[q.id]) : ""} onValueChange={(v) => onChange({ ...antwoorden, [q.id]: v === "true" })} className="flex gap-6">
        {[true, false].map((v) => <div key={String(v)} className="flex items-center gap-2"><RadioGroupItem value={String(v)} id={`cyber-${q.id}-${v}`} /><Label htmlFor={`cyber-${q.id}-${v}`}>{v ? "Ja" : "Nee"}</Label></div>)}
      </RadioGroup>
    </div>)}
  </fieldset>;
}
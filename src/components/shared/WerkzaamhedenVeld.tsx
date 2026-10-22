import { Textarea } from "@/components/ui/textarea";
import { WERKZAAMHEDEN_MAX, werkzaamhedenFout } from "../../../supabase/functions/_shared/werkzaamheden";

export function WerkzaamhedenVeld({ id, value, onChange, error, placeholder }: { id: string; value: string; onChange: (value: string) => void; error?: string; placeholder?: string }) {
  const fout = werkzaamhedenFout(value) || error;
  return <div className="space-y-1">
    <Textarea id={id} name={id} value={value} onChange={e => onChange(e.target.value)} rows={4} placeholder={placeholder}
      aria-invalid={!!fout} aria-describedby={`${id}-teller${fout ? ` ${id}-fout` : ""}`} className={fout ? "border-destructive" : ""} />
    <p id={`${id}-teller`} className="text-xs text-muted-foreground text-right" aria-live="polite">{value.length} van {WERKZAAMHEDEN_MAX.toLocaleString("nl-NL")} tekens</p>
    {fout && <p id={`${id}-fout`} role="alert" className="text-sm text-destructive">{fout}</p>}
  </div>;
}
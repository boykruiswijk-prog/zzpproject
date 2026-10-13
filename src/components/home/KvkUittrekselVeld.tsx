import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2 } from "lucide-react";
import { UITTREKSEL_LABEL, UITTREKSEL_UITLEG, controleerUittreksel } from "@/lib/kvkUittreksel";

/** Verplicht KVK-uittreksel bij het startertarief zolang de KVK API niet operationeel is. Upload loopt via de server. */
export function KvkUittrekselVeld({ conceptId, hp, uittrekselId, onChange, fout }: {
  conceptId: () => string; hp: string; uittrekselId: string | null; onChange: (id: string | null) => void; fout?: string;
}) {
  const [bezig, setBezig] = useState(false);
  const [melding, setMelding] = useState<string | null>(null);
  const [naam, setNaam] = useState<string | null>(null);

  async function kies(f: File | undefined) {
    setMelding(null); onChange(null); setNaam(null);
    if (!f) return;
    const kop = new Uint8Array(await f.slice(0, 16).arrayBuffer());
    const c = controleerUittreksel(f.name, f.size, kop);
    if (!c.ok) { setMelding(c.fout); return; }
    setBezig(true);
    const fd = new FormData();
    fd.append("concept_id", conceptId()); fd.append("hp", hp); fd.append("bestand", f);
    const { data, error } = await supabase.functions.invoke("kvk-uittreksel-upload", { body: fd });
    setBezig(false);
    if (error || !data?.ok) { setMelding(data?.error ?? "Uploaden lukte niet. Probeer het opnieuw."); return; }
    setNaam(f.name); onChange(data.uittreksel_id);
  }

  return (
    <div className="space-y-1" data-testid="kvk-uittreksel">
      <Label htmlFor="kvkUittreksel">{UITTREKSEL_LABEL} *</Label>
      <Input id="kvkUittreksel" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={(e) => kies(e.target.files?.[0])} disabled={bezig} />
      <p className="text-xs text-muted-foreground">{UITTREKSEL_UITLEG} Alleen pdf, jpg of png, maximaal 10 MB.</p>
      {bezig && <p className="flex items-center gap-1 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />Uploaden...</p>}
      {uittrekselId && naam && <p className="flex items-center gap-1 text-xs text-foreground"><CheckCircle2 className="h-3 w-3 text-primary" />Ontvangen: {naam}</p>}
      {(melding || fout) && <p className="text-sm text-destructive">{melding ?? fout}</p>}
    </div>
  );
}

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

export const HERKOMST_KEUZES = ["Google", "Bing", "AI-assistent", "Doorverwijzing", "Social media", "Eerder klant", "Anders"] as const;

interface HerkomstRecord { keuze?: string; toelichting?: string | null; ingevuld_op?: string }

/** Alleen in beheer: wat de klant zelf zegt over hoe hij bij ons kwam. */
export function HerkomstKlant({ leadId, extraData }: { leadId: string; extraData: unknown }) {
  const huidig = ((extraData as Record<string, unknown> | null)?.herkomst_klant ?? null) as HerkomstRecord | null;
  const [bewerken, setBewerken] = useState(false);
  const [keuze, setKeuze] = useState(huidig?.keuze ?? "");
  const [toelichting, setToelichting] = useState(huidig?.toelichting ?? "");
  const [bezig, setBezig] = useState(false);
  const qc = useQueryClient();
  const { toast } = useToast();

  async function opslaan() {
    setBezig(true);
    const { error } = await supabase.rpc("zet_herkomst_klant", { p_lead_id: leadId, p_keuze: keuze, p_toelichting: toelichting });
    setBezig(false);
    if (error) return toast({ title: "Opslaan mislukt", description: error.message, variant: "destructive" });
    toast({ title: "Herkomst opgeslagen" });
    setBewerken(false);
    qc.invalidateQueries({ queryKey: ["lead", leadId] });
  }

  return (
    <div className="mt-3 rounded-md border p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-muted-foreground">Herkomst volgens klant</span>
        {!bewerken && <Button size="sm" variant="outline" onClick={() => setBewerken(true)}>{huidig ? "Wijzigen" : "Invullen"}</Button>}
      </div>
      {!bewerken ? (
        <p className="mt-1 font-medium">
          {huidig?.keuze ? <>{huidig.keuze}{huidig.toelichting ? `: ${huidig.toelichting}` : ""}</> : <span className="font-normal text-muted-foreground">Nog niet ingevuld</span>}
        </p>
      ) : (
        <div className="mt-2 space-y-2">
          <Select value={keuze} onValueChange={setKeuze}>
            <SelectTrigger aria-label="Herkomst volgens klant"><SelectValue placeholder="Kies een herkomst" /></SelectTrigger>
            <SelectContent>{HERKOMST_KEUZES.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
          </Select>
          <Textarea value={toelichting} maxLength={300} onChange={(e) => setToelichting(e.target.value)} placeholder="Toelichting (optioneel, max 300 tekens)" />
          <div className="flex gap-2">
            <Button size="sm" onClick={opslaan} disabled={!keuze || bezig}>Opslaan</Button>
            <Button size="sm" variant="ghost" onClick={() => setBewerken(false)}>Annuleren</Button>
          </div>
        </div>
      )}
    </div>
  );
}

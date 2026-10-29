import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle2, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { LEAD_STATUS_LABELS, LEAD_STATUS_TITELS, LEAD_UITKOMSTEN, AFGESLOTEN_LEAD_STATUSSEN, isUitkomst, type LeadUitkomst } from "@/lib/statusLabels";

type LeadLike = { id: string; type: string; status: string; geactiveerd_op?: string | null };

/**
 * Afgerond mag niet bij een verzekeringsaanvraag met (ooit) geactiveerde polis:
 * dat zou de polisstatus overschrijven. De database blokkeert dit ook.
 */
export function magAfronden(l: LeadLike) {
  if (l.type === "verzekering_aanvraag" && (l.geactiveerd_op || ["actief", "gepauzeerd", "opgezegd", "klant"].includes(l.status))) return false;
  return true;
}

const isAfgesloten = (s: string) => (AFGESLOTEN_LEAD_STATUSSEN as string[]).includes(s);

/** Statuskeuzes voor een medewerker: nooit "afgerond" als nieuwe keuze (alleen de huidige waarde blijft zichtbaar),
 *  wel de drie uitkomsten als afsluiten mag. Ook bestaande afgeronde leads kunnen naar een uitkomst. */
export function leadStatusKeuzes(l: LeadLike): [string, string][] {
  return Object.entries(LEAD_STATUS_LABELS).filter(([v]) => {
    if (v === "afgerond") return l.status === "afgerond";
    if (isUitkomst(v)) return v === l.status || magAfronden(l);
    if (v === "offerte_verstuurd") return l.status === v;
    return true;
  });
}

export function AfrondDialoog({ lead, open, onOpenChange, uitkomst: start }: { lead: LeadLike; open: boolean; onOpenChange: (o: boolean) => void; uitkomst?: LeadUitkomst | null }) {
  const qc = useQueryClient();
  const [toelichting, setToelichting] = useState("");
  const [gekozen, setGekozen] = useState<LeadUitkomst | null>(start ?? null);
  const uitkomst = start ?? gekozen;
  const [bezig, setBezig] = useState(false);
  async function opslaan() {
    if (!uitkomst) { toast.error("Kies een uitkomst"); return; }
    setBezig(true);
    const { error } = await supabase.rpc("lead_afsluiten", { _lead_id: lead.id, _uitkomst: uitkomst, _toelichting: toelichting.trim() || null });
    setBezig(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Afgesloten: ${LEAD_STATUS_LABELS[uitkomst]}`);
    setToelichting(""); setGekozen(null); onOpenChange(false);
    qc.invalidateQueries();
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Lead afsluiten</DialogTitle>
          <DialogDescription>Kies de uitkomst. De lead verdwijnt uit Vandaag te doen en uit de standaard leadlijst. Heropenen kan altijd.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2" role="radiogroup" aria-label="Uitkomst">
          {LEAD_UITKOMSTEN.map((u) => (
            <label key={u} className="flex cursor-pointer items-start gap-2 rounded border p-2 hover:bg-muted">
              <input type="radio" name="uitkomst" className="mt-1" checked={uitkomst === u} disabled={!!start && start !== u} onChange={() => setGekozen(u)} />
              <span><span className="font-medium">{LEAD_STATUS_LABELS[u]}</span><br /><span className="text-xs text-muted-foreground">{LEAD_STATUS_TITELS[u]}</span></span>
            </label>
          ))}
        </div>
        <div><Label>Toelichting (optioneel)</Label><Textarea value={toelichting} onChange={(e) => setToelichting(e.target.value)} rows={3} maxLength={500} placeholder="Bijvoorbeeld: teruggebeld" /></div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuleren</Button>
          <Button onClick={opslaan} disabled={bezig || !uitkomst}>{bezig && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Afsluiten</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Knop Afsluiten / Heropenen op de leaddetailpagina (alle teamleden). */
export function LeadAfrondenKnop({ lead }: { lead: LeadLike }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [bezig, setBezig] = useState(false);
  if (isAfgesloten(lead.status)) {
    return (
      <>
      <Button variant="outline" size="sm" disabled={bezig} onClick={async () => {
        setBezig(true);
        const { error } = await supabase.from("leads").update({ status: "in_behandeling" }).eq("id", lead.id);
        setBezig(false);
        if (error) toast.error(error.message); else { toast.success("Heropend, status In behandeling"); qc.invalidateQueries(); }
      }}><RotateCcw className="mr-1 h-4 w-4" />Heropenen</Button>
      {lead.status === "afgerond" && magAfronden(lead) && (<>
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}><CheckCircle2 className="mr-1 h-4 w-4" />Uitkomst kiezen</Button>
        <AfrondDialoog lead={lead} open={open} onOpenChange={setOpen} />
      </>)}
      </>
    );
  }
  if (!magAfronden(lead)) return null;
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}><CheckCircle2 className="mr-1 h-4 w-4" />Afsluiten</Button>
      <AfrondDialoog lead={lead} open={open} onOpenChange={setOpen} />
    </>
  );
}

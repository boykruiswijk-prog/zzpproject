import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle2, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

type LeadLike = { id: string; type: string; status: string; geactiveerd_op?: string | null };

/**
 * Afgerond mag niet bij een verzekeringsaanvraag met (ooit) geactiveerde polis:
 * dat zou de polisstatus overschrijven. De database blokkeert dit ook.
 */
export function magAfronden(l: LeadLike) {
  if (l.status === "afgerond") return false;
  if (l.type === "verzekering_aanvraag" && (l.geactiveerd_op || ["actief", "gepauzeerd", "opgezegd", "klant"].includes(l.status))) return false;
  return true;
}

export function AfrondDialoog({ lead, open, onOpenChange }: { lead: LeadLike; open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const [toelichting, setToelichting] = useState("");
  const [bezig, setBezig] = useState(false);
  async function opslaan() {
    setBezig(true);
    const { error } = await supabase.rpc("lead_afronden" as any, { _lead_id: lead.id, _toelichting: toelichting.trim() || null } as any);
    setBezig(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Afgerond");
    setToelichting(""); onOpenChange(false);
    qc.invalidateQueries();
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Lead afronden</DialogTitle>
          <DialogDescription>De actie is volledig afgehandeld. De lead verdwijnt uit Vandaag te doen en uit de standaard leadlijst. Heropenen kan altijd.</DialogDescription>
        </DialogHeader>
        <div><Label>Toelichting (optioneel)</Label><Textarea value={toelichting} onChange={(e) => setToelichting(e.target.value)} rows={3} maxLength={500} placeholder="Bijvoorbeeld: teruggebeld, vraag beantwoord" /></div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuleren</Button>
          <Button onClick={opslaan} disabled={bezig}>{bezig && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Afronden</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Knop Afgerond / Heropenen op de leaddetailpagina (alle teamleden). */
export function LeadAfrondenKnop({ lead }: { lead: LeadLike }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [bezig, setBezig] = useState(false);
  if (lead.status === "afgerond") {
    return (
      <Button variant="outline" size="sm" disabled={bezig} onClick={async () => {
        setBezig(true);
        const { error } = await supabase.from("leads").update({ status: "in_behandeling" }).eq("id", lead.id);
        setBezig(false);
        if (error) toast.error(error.message); else { toast.success("Heropend, status In behandeling"); qc.invalidateQueries(); }
      }}><RotateCcw className="mr-1 h-4 w-4" />Heropenen</Button>
    );
  }
  if (!magAfronden(lead)) return null;
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}><CheckCircle2 className="mr-1 h-4 w-4" />Afgerond</Button>
      <AfrondDialoog lead={lead} open={open} onOpenChange={setOpen} />
    </>
  );
}

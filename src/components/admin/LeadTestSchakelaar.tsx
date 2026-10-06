import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FlaskConical, Loader2 } from "lucide-react";
import { toast } from "sonner";

/** Knop "Markeer als test" / "Geen test" (rol verzekering, supervisor, admin), met reden; gelogd in activiteiten_log. */
export function LeadTestSchakelaar({ leadId, isTest, naam, compact = false, onGewijzigd }: {
  leadId: string; isTest: boolean; naam?: string; compact?: boolean; onGewijzigd?: () => void;
}) {
  const { isAdmin, isSupervisor, isVerzekering } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reden, setReden] = useState("");
  const [bezig, setBezig] = useState(false);
  if (!(isAdmin || isSupervisor || isVerzekering)) return null;
  const nieuw = !isTest;

  async function opslaan() {
    setBezig(true);
    const { error } = await supabase.rpc("zet_lead_test" as any, { _lead_id: leadId, _is_test: nieuw, _reden: reden } as any);
    setBezig(false);
    if (error) { toast.error(error.message); return; }
    toast.success(nieuw ? "Gemarkeerd als test" : "Testmarkering verwijderd");
    setOpen(false); setReden("");
    qc.invalidateQueries();
    onGewijzigd?.();
  }

  return (
    <>
      <Button type="button" size={compact ? "sm" : "default"} variant={isTest ? "secondary" : "outline"} onClick={() => setOpen(true)}
        className={compact ? "h-8 px-2 text-xs" : ""} aria-label={isTest ? "Geen test" : "Markeer als test"}>
        <FlaskConical className="h-4 w-4" />{!compact || isTest ? <span className="ml-1">{isTest ? "Geen test" : "Markeer als test"}</span> : null}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{nieuw ? "Markeer als test" : "Testmarkering verwijderen"}{naam ? `: ${naam}` : ""}</DialogTitle>
            <DialogDescription>
              {nieuw
                ? "Een testlead telt niet mee in dashboards, Vandaag te doen en het aanvraagdoel, krijgt geen klantmails en geen Exact-acties. De lead blijft zichtbaar via toon testdata. Er wordt niets verwijderd."
                : "De lead telt weer mee als echte aanvraag."}
            </DialogDescription>
          </DialogHeader>
          <div><Label>Reden (verplicht)</Label><Textarea value={reden} onChange={(e) => setReden(e.target.value)} rows={3} /></div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Annuleren</Button>
            <Button onClick={opslaan} disabled={bezig || reden.trim().length < 3}>{bezig && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Bevestigen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

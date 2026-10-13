import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { lijktCircle8, toonCircle8Knop, type Circle8Bron } from "@/lib/circle8";

type Props = {
  aanvraag: Circle8Bron & { id: string; type?: string; opzegging_verwerkt_op?: string | null; koppeling_status?: string | null; onderneming_id?: string | null };
  onVerwerkt?: () => void;
};

/** Knop "Circle8": registreert een opzegging van de collectieve klant Circle8 als verwerkt, zonder koppeling. */
export function Circle8Knop({ aanvraag, onVerwerkt }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [bezig, setBezig] = useState(false);
  if (!toonCircle8Knop(aanvraag)) return null;
  const lijkt = lijktCircle8(aanvraag);

  async function uitvoeren() {
    setBezig(true);
    const { error } = await (supabase.rpc as any)("verwerk_opzegging_circle8", { _aanvraag_id: aanvraag.id });
    setBezig(false);
    setOpen(false);
    if (error) return toast({ title: "Verwerken mislukt", description: error.message, variant: "destructive" });
    toast({ title: "Opzegging verwerkt als Circle8 (collectief)" });
    qc.invalidateQueries({ queryKey: ["menu-tellers"] });
    qc.invalidateQueries({ queryKey: ["dashboard-tellers"] });
    onVerwerkt?.();
  }

  return (
    <>
      <Button type="button" size="sm" variant={lijkt ? "default" : "secondary"} disabled={bezig} onClick={() => setOpen(true)}>
        {lijkt ? "Lijkt Circle8" : "Circle8"}
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Circle8</AlertDialogTitle>
            <AlertDialogDescription>
              Deze opzegging hoort bij de collectieve klant Circle8. Hij wordt als verwerkt geregistreerd, zonder koppeling, zonder wijziging van contracten en zonder creditnota. Doorgaan?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bezig}>Annuleren</AlertDialogCancel>
            <AlertDialogAction disabled={bezig} onClick={(e) => { e.preventDefault(); uitvoeren(); }}>Doorgaan</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

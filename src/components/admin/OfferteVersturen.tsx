import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FileText, Loader2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { formatDateTimeNL } from "@/lib/dateFormat";

/** Knop "Offerte versturen" met voorbeeld. Status wordt pas offerte_verstuurd na echte verzending (server). */
export function OfferteVersturen({ leadId, verstuurdOp }: { leadId: string; verstuurdOp?: string | null }) {
  const [open, setOpen] = useState(false);
  const [engels, setEngels] = useState(false);
  const [voorbeeld, setVoorbeeld] = useState<{ html: string; aan: string; onderwerp: string } | null>(null);
  const [bezig, setBezig] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const laad = async (eng: boolean) => {
    setBezig(true);
    const { data, error } = await supabase.functions.invoke("send-offerte", { body: { lead_id: leadId, modus: "voorbeeld", engels: eng } });
    setBezig(false);
    if (error || !data?.ok) { toast({ title: "Voorbeeld laden mislukt", description: error?.message ?? data?.error, variant: "destructive" }); return; }
    setVoorbeeld(data);
  };
  const verstuur = async () => {
    setBezig(true);
    const { data, error } = await supabase.functions.invoke("send-offerte", { body: { lead_id: leadId, modus: "versturen", engels } });
    setBezig(false);
    if (error || !data?.ok) { toast({ title: "Versturen mislukt", description: error?.message ?? data?.error, variant: "destructive" }); return; }
    toast({ title: data.productie ? "Offerte verstuurd" : "Testmail verstuurd (preview)", description: data.productie ? `Aan ${voorbeeld?.aan}` : "In de preview gaat de mail alleen naar Boy; de status blijft gelijk." });
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["lead", leadId] });
  };

  return (
    <div className="border-t pt-4">
      <Button size="sm" className="mt-2" onClick={() => { setOpen(true); laad(engels); }}>
        <FileText className="h-4 w-4" /> Offerte versturen
      </Button>
      {verstuurdOp && <p className="mt-2 text-xs text-muted-foreground">Laatste offerte verstuurd op {formatDateTimeNL(verstuurdOp)}</p>}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Offerte versturen</DialogTitle>
            <DialogDescription>{voorbeeld ? `Aan ${voorbeeld.aan}: ${voorbeeld.onderwerp}` : "Voorbeeld laden"}</DialogDescription>
          </DialogHeader>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={engels} onCheckedChange={(v) => { const e = v === true; setEngels(e); laad(e); }} />Korte Engelse inleiding bovenaan</label>
          {voorbeeld ? <iframe title="Voorbeeld offerte" srcDoc={voorbeeld.html} sandbox="" className="h-[50dvh] w-full rounded border" /> : <Loader2 className="h-5 w-5 animate-spin" />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuleren</Button>
            <Button onClick={verstuur} disabled={bezig || !voorbeeld}>{bezig ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Versturen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

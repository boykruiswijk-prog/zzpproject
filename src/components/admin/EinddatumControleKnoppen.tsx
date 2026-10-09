import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

type Keuze = "opzegging" | "loopt_door";

/** Twee beslisknoppen voor een contract met einddatum zonder geregistreerde opzegging. Alles via RPC einddatum_controle_beslissen. */
export function EinddatumControleKnoppen({ contractId, naam, eindDatum, onGewijzigd }: { contractId: string; naam: string; eindDatum?: string | null; onGewijzigd: () => void }) {
  const [keuze, setKeuze] = useState<Keuze | null>(null);
  const [datum, setDatum] = useState(eindDatum ?? "");
  const [toelichting, setToelichting] = useState("");
  const [bezig, setBezig] = useState(false);
  const { toast } = useToast();

  const open = (k: Keuze) => { setKeuze(k); setDatum(eindDatum ?? ""); setToelichting(""); };
  const geldig = toelichting.trim().length >= 3 && (keuze !== "opzegging" || !!datum);

  async function opslaan() {
    if (!keuze || !geldig) return;
    setBezig(true);
    const { error } = await supabase.rpc("einddatum_controle_beslissen", {
      _contract_id: contractId, _keuze: keuze, _opzegdatum: keuze === "opzegging" ? datum : null, _toelichting: toelichting.trim(),
    } as never);
    setBezig(false);
    if (error) { toast({ title: "Opslaan mislukt", description: error.message, variant: "destructive" }); return; }
    toast({ title: keuze === "opzegging" ? "Opzegging vastgelegd" : "Contract loopt door" });
    setKeuze(null);
    onGewijzigd();
  }

  return (
    <>
      <div className="flex shrink-0 flex-wrap gap-1 pr-2">
        <Button size="sm" variant="outline" onClick={() => open("opzegging")}>Opzegging bevestigen</Button>
        <Button size="sm" variant="outline" onClick={() => open("loopt_door")}>Loopt door</Button>
      </div>
      <Dialog open={!!keuze} onOpenChange={(o) => !o && setKeuze(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{keuze === "opzegging" ? "Opzegging bevestigen" : "Contract loopt door"}</DialogTitle>
            <DialogDescription>
              {keuze === "opzegging"
                ? `${naam}: er wordt een opzegging vastgelegd. De facturatie stopt na de opzegdatum.`
                : `${naam}: de einddatum uit AFAS vervalt en het contract wordt gewoon verder gefactureerd.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {keuze === "opzegging" && (
              <div className="space-y-1">
                <Label htmlFor={`opz-${contractId}`}>Opzegdatum</Label>
                <Input id={`opz-${contractId}`} type="date" value={datum} onChange={(e) => setDatum(e.target.value)} />
              </div>
            )}
            <div className="space-y-1">
              <Label htmlFor={`toel-${contractId}`}>Toelichting</Label>
              <Textarea id={`toel-${contractId}`} value={toelichting} onChange={(e) => setToelichting(e.target.value)} placeholder="Minimaal 3 tekens" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setKeuze(null)} disabled={bezig}>Annuleren</Button>
            <Button onClick={opslaan} disabled={!geldig || bezig}>{bezig ? "Bezig..." : "Bevestigen"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

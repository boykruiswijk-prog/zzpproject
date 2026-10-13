import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { formatDateNL, formatDateTimeLongNL } from "@/lib/dateFormat";
import { AlertTriangle, Pencil } from "lucide-react";
import { vroegsteIngangsdatum, dagNL } from "@/lib/ingangsdatum";

type Uitkomst = { oud: string | null; nieuw: string; starter_wijziging: string | null; contracten: number; polissen: number; waarschuwingen: string[] };

/** Interne ingangsdatum: geen klantgrenzen; server (RPC lead_ingangsdatum_wijzigen) controleert de rol. */
export function IngangsdatumAanpassen({ lead, magWijzigen }: { lead: { id: string; ingangsdatum: string | null; exact_invoice_id: string | null; created_at?: string | null; geactiveerd_op?: string | null }; magWijzigen: boolean }) {
  const [open, setOpen] = useState(false);
  const [datum, setDatum] = useState(lead.ingangsdatum ?? "");
  const [reden, setReden] = useState("");
  const [bezig, setBezig] = useState(false);
  const [uitkomst, setUitkomst] = useState<Uitkomst | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();
  const vroegst = lead.created_at ? vroegsteIngangsdatum(lead.created_at) : null;
  const teVroeg = !!(vroegst && lead.ingangsdatum && lead.ingangsdatum.slice(0, 10) < vroegst);

  const historie = useQuery({
    queryKey: ["ingangsdatum-historie", lead.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("activiteiten_log")
        .select("id, omschrijving, uitgevoerd_door_naam, aangemaakt_op")
        .eq("lead_id", lead.id).eq("actie_type", "ingangsdatum_gewijzigd")
        .order("aangemaakt_op", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function opslaan() {
    setBezig(true);
    const { data, error } = await supabase.rpc("lead_ingangsdatum_wijzigen" as any, { _lead_id: lead.id, _datum: datum, _toelichting: reden });
    setBezig(false);
    if (error) { toast({ title: "Niet opgeslagen", description: error.message, variant: "destructive" }); return; }
    setUitkomst(data as unknown as Uitkomst);
    setOpen(false); setReden("");
    toast({ title: "Ingangsdatum aangepast" });
    qc.invalidateQueries({ queryKey: ["lead", lead.id] });
    qc.invalidateQueries({ queryKey: ["ingangsdatum-historie", lead.id] });
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">Ingangsdatum</CardTitle>
          {magWijzigen && (
            <Button variant="outline" size="sm" onClick={() => { setDatum(lead.ingangsdatum ?? ""); setOpen(true); }}>
              <Pencil className="mr-2 h-4 w-4" />Aanpassen
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-lg font-semibold">{formatDateNL(lead.ingangsdatum) || "Niet ingevuld"}</p>
        {teVroeg && !lead.geactiveerd_op && (
          <Alert variant="destructive"><AlertTriangle className="h-4 w-4" />
            <AlertDescription>De ingangsdatum ligt op of voor de aanvraagdag. Pas hem aan naar {dagNL(vroegst!)} of later; activeren kan pas daarna.</AlertDescription>
          </Alert>
        )}
        {lead.exact_invoice_id && (
          <Alert variant="destructive"><AlertTriangle className="h-4 w-4" />
            <AlertDescription>Er staat al een factuur in Exact, controleer die handmatig bij een andere ingangsdatum.</AlertDescription>
          </Alert>
        )}
        {uitkomst && (
          <Alert><AlertDescription className="space-y-1">
            <p>Aangepast van {formatDateNL(uitkomst.oud) || "leeg"} naar {formatDateNL(uitkomst.nieuw)}. Contracten bijgewerkt: {uitkomst.contracten}, certificaten: {uitkomst.polissen}.</p>
            {uitkomst.starter_wijziging && <p className="font-medium">Startertarief: {uitkomst.starter_wijziging}.</p>}
            {uitkomst.waarschuwingen.map((w) => <p key={w} className="font-medium text-destructive">{w}</p>)}
          </AlertDescription></Alert>
        )}
        {(historie.data?.length ?? 0) > 0 && (
          <div className="space-y-2 border-t border-border pt-3">
            <p className="font-medium">Historie</p>
            {historie.data!.map((h) => (
              <div key={h.id} className="text-muted-foreground">
                <span className="text-foreground">{formatDateTimeLongNL(h.aangemaakt_op)}</span>, {h.uitgevoerd_door_naam ?? "onbekend"}: {h.omschrijving}
              </div>
            ))}
          </div>
        )}
      </CardContent>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ingangsdatum aanpassen</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{vroegst ? `Vroegst de dag na de aanvraag (${dagNL(vroegst)}); een latere datum mag.` : "Vroegst de dag na de aanvraag; een latere datum mag."} Contract, cyberdatum en certificaatdatum lopen mee. Er gaat geen mail naar de klant en in Exact verandert niets.</p>
          <Label htmlFor="ingang-nieuw">Nieuwe ingangsdatum</Label>
          <Input id="ingang-nieuw" type="date" min={vroegst ?? undefined} value={datum} onChange={(e) => setDatum(e.target.value)} />
          <Label htmlFor="ingang-reden">Waarom aangepast (verplicht)</Label>
          <Textarea id="ingang-reden" value={reden} maxLength={500} onChange={(e) => setReden(e.target.value)} />
          <Button disabled={bezig || !datum || (!!vroegst && datum < vroegst) || datum === lead.ingangsdatum || reden.trim().length < 3} onClick={opslaan}>Opslaan</Button>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

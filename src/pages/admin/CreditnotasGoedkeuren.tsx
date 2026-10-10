import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatDateNL } from "@/lib/dateFormat";
import { useToonTestrecords } from "@/hooks/useToonTestrecords";
import { verwachtCredit, euro } from "@/lib/creditVoorstel";

type Rij = {
  id: string; status: string; creditsleutel: string; bron: string; einddatum: string; credit_vanaf: string; credit_tm: string | null;
  bedrag: number | null; melding: string | null; foutmelding: string | null; is_test: boolean;
  onderneming_id: string | null; klant: string | null; relatiecode: string | null; product: string; itemcode: string | null; abonnement_nr: string | null;
  contract: any; planner_perioden: any[]; toelichting: string | null; waarschuwingen: string[] | null;
};

export default function CreditnotasGoedkeuren() {
  const { toonTest } = useToonTestrecords();
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["credits-ter-goedkeuring", toonTest],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("credits_ter_goedkeuring", { _toon_test: toonTest });
      if (error) throw error;
      return (data ?? []) as Rij[];
    },
  });
  const [weiger, setWeiger] = useState<Rij | null>(null);
  const [reden, setReden] = useState("");
  const [bezig, setBezig] = useState<string | null>(null);

  async function beoordeel(r: Rij, goedkeuren: boolean, tekst: string | null) {
    setBezig(r.id);
    const { error } = await (supabase.rpc as any)("credit_beoordelen", { _id: r.id, _goedkeuren: goedkeuren, _reden: tekst });
    setBezig(null);
    if (error) { toast.error(`Opslaan mislukt: ${error.message}`); return; }
    toast.success(goedkeuren ? "Goedgekeurd. De creditnota gaat morgenochtend als concept naar Exact." : "Vastgelegd: niet crediteren.");
    setWeiger(null); setReden("");
    qc.invalidateQueries({ queryKey: ["credits-ter-goedkeuring"] });
    qc.invalidateQueries({ queryKey: ["menu-tellers"] });
  }

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">Creditnota's ter goedkeuring</h1>
          <p className="text-sm text-muted-foreground">Een creditnota gaat pas naar Exact als je hem hier goedkeurt. Na goedkeuring zet de planner hem de volgende ochtend als concept klaar.</p>
        </div>
        {isLoading && <p className="text-sm text-muted-foreground">Laden...</p>}
        {error && <p className="text-sm text-destructive">Kon de lijst niet laden: {(error as Error).message}</p>}
        {data && !data.length && <p className="text-sm text-muted-foreground">Er wachten geen creditnota's op goedkeuring.</p>}
        {data?.map((r) => {
          const v = verwachtCredit(r.contract, r.einddatum, r.planner_perioden ?? []);
          const bedrag = v?.bedrag ?? r.bedrag;
          return (
            <Card key={r.id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">
                      {r.onderneming_id ? <Link className="underline" to={`/admin/klanten/${r.onderneming_id}`}>{r.klant ?? "Onbekende klant"}</Link> : r.klant}
                      {r.is_test && <Badge variant="outline" className="ml-2">Test</Badge>}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {r.product}{r.abonnement_nr ? ` · abonnement ${r.abonnement_nr}` : ""}{r.relatiecode ? ` · relatie ${r.relatiecode}` : ""} · {r.creditsleutel}
                    </div>
                  </div>
                  <Badge variant={r.status === "fout" ? "destructive" : "secondary"}>{r.status === "fout" ? "In de wacht (10-10)" : "Wacht op akkoord"}</Badge>
                </div>
                <div className="grid gap-1 text-sm sm:grid-cols-3">
                  <div><span className="text-muted-foreground">Opgezegd per:</span> {formatDateNL(r.einddatum)}</div>
                  <div><span className="text-muted-foreground">Periode:</span> {formatDateNL(v?.vanaf ?? r.credit_vanaf)} t/m {formatDateNL(v?.tm ?? r.credit_tm)}</div>
                  <div><span className="text-muted-foreground">Bedrag:</span> <strong>{bedrag != null ? euro(Number(bedrag)) : "onbekend"}</strong></div>
                </div>
                <div className="rounded-md bg-muted/50 p-3 text-sm">
                  <span className="text-muted-foreground">Toelichting bij de opzegging:</span> {r.toelichting || "geen toelichting"}
                </div>
                {r.status === "fout" && r.foutmelding && <p className="text-xs text-muted-foreground">{r.foutmelding}</p>}
                {r.melding && <p className="text-xs text-muted-foreground">{r.melding}</p>}
                {(r.waarschuwingen ?? []).length > 0 && (
                  <div className="space-y-1 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm">
                    {(r.waarschuwingen ?? []).map((w) => (
                      <div key={w} className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" /><span>{w}</span></div>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" disabled={bezig === r.id} onClick={() => beoordeel(r, true, null)}>Goedkeuren</Button>
                  <Button size="sm" variant="outline" disabled={bezig === r.id} onClick={() => { setWeiger(r); setReden(""); }}>Niet crediteren</Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <Dialog open={!!weiger} onOpenChange={(o) => !o && setWeiger(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Niet crediteren</DialogTitle>
            <DialogDescription>{weiger?.klant}: er komt geen creditnota. Dit is definitief.</DialogDescription>
          </DialogHeader>
          <Textarea value={reden} onChange={(e) => setReden(e.target.value)} placeholder="Reden (verplicht, minimaal 3 tekens)" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setWeiger(null)}>Annuleren</Button>
            <Button disabled={reden.trim().length < 3 || !!bezig} onClick={() => weiger && beoordeel(weiger, false, reden.trim())}>Bevestigen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

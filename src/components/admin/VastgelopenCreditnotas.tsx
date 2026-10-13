import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { formatDateNL } from "@/lib/dateFormat";
import { isOudSysteemCredit, magHandmatigAfhandelen } from "@/lib/creditHandmatig";

type Rij = { id: string; status: string; melding: string | null; foutmelding: string | null; bedrag: number | null; einddatum: string | null; origineel_factuurnummer: string | null; klant_contracten: { ondernemingen: { naam: string | null } | null } | null };

/** Creditnota's die vastlopen (geblokkeerd/fout) plus open creditnota's uit het oude systeem. Gaat nooit naar Exact. */
export function VastgelopenCreditnotas() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { hash } = useLocation();
  const [kies, setKies] = useState<Rij | null>(null);
  const [reden, setReden] = useState("");
  const [bezig, setBezig] = useState(false);
  const q = useQuery({
    queryKey: ["credits-vast"],
    queryFn: async () => {
      const { data, error } = await supabase.from("factuur_credit_planning")
        .select("id,status,melding,foutmelding,bedrag,einddatum,origineel_factuurnummer,klant_contracten(ondernemingen(naam))")
        .eq("is_test", false).neq("status", "handmatig_afgehandeld")
        .or("status.in.(geblokkeerd,fout),melding.ilike.%oud systeem%")
        .order("aangemaakt_op", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as unknown as Rij[]).filter((r) => ["geblokkeerd", "fout"].includes(r.status) || magHandmatigAfhandelen(r));
    },
  });
  useEffect(() => {
    if (hash === "#creditnotas" && q.data) document.getElementById("creditnotas")?.scrollIntoView({ behavior: "smooth" });
  }, [hash, q.data]);

  async function bevestig() {
    if (!kies) return;
    setBezig(true);
    const { error } = await (supabase.rpc as any)("credit_handmatig_afgehandeld", { _id: kies.id, _toelichting: reden });
    setBezig(false);
    if (error) { toast({ title: "Niet opgeslagen", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Gemarkeerd als handmatig afgehandeld in AFAS" });
    setKies(null); setReden("");
    for (const k of ["credits-vast", "menu-tellers", "dashboard-tellers"]) qc.invalidateQueries({ queryKey: [k] });
  }

  if (!q.data?.length) return null;
  return (
    <Card id="creditnotas" className="min-w-0 scroll-mt-20">
      <CardHeader><CardTitle className="text-base">Creditnota's die vastlopen ({q.data.length})</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p className="text-muted-foreground">Uit het oude systeem: al gecrediteerd in AFAS? Markeer hem dan als handmatig afgehandeld. Er gaat niets naar Exact en er wordt niets verwijderd.</p>
        {q.data.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3">
            <div className="min-w-0">
              <p className="font-medium">{r.klant_contracten?.ondernemingen?.naam ?? "Onbekende klant"} {r.origineel_factuurnummer && <span className="text-muted-foreground">· factuur {r.origineel_factuurnummer}</span>}</p>
              <p className="text-muted-foreground">{r.melding ?? r.foutmelding ?? r.status}{r.einddatum ? ` · einddatum ${formatDateNL(r.einddatum)}` : ""}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={isOudSysteemCredit(r) ? "secondary" : "destructive"}>{isOudSysteemCredit(r) ? "Oud systeem" : r.status === "fout" ? "Fout" : "Geblokkeerd"}</Badge>
              {magHandmatigAfhandelen(r) && <Button size="sm" variant="outline" onClick={() => { setKies(r); setReden(""); }}>Handmatig afgehandeld in AFAS</Button>}
            </div>
          </div>
        ))}
      </CardContent>
      <Dialog open={!!kies} onOpenChange={(o) => !o && setKies(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Handmatig afgehandeld in AFAS</DialogTitle>
            <DialogDescription>Deze creditnota is al in AFAS gecrediteerd. Hij telt daarna niet meer mee. Er gaat niets naar Exact.</DialogDescription></DialogHeader>
          <Label htmlFor="credit-afas-reden">Toelichting (verplicht)</Label>
          <Textarea id="credit-afas-reden" value={reden} maxLength={500} onChange={(e) => setReden(e.target.value)} placeholder="Bijvoorbeeld: gecrediteerd in AFAS op 13-10-2026" />
          <Button disabled={bezig || reden.trim().length < 3} onClick={bevestig}>Opslaan</Button>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// Klantmails (alleen admin): schakelaars, concepten en tellers. Alle nieuwe klantmails staan uit tot akkoord Boy.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { formatDateNL } from "@/lib/dateFormat";
import { VOORBEELD_DATA, vulPlaceholders } from "@/lib/klantmailTekst";
import { plusDagenISO } from "@/lib/prolongatie";

interface Instelling { sleutel: string; naam: string; moment: string; actief: boolean; status: string; onderwerp: string | null; tekst: string | null; placeholders: string[]; bijgewerkt_op: string }
const vandaag = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Amsterdam" }).format(new Date());

function voorbeeld(t: string) { try { return vulPlaceholders(t, VOORBEELD_DATA); } catch (e) { return `Fout in tekst: ${(e as Error).message}`; } }

export default function Klantmails() {
  const { toast } = useToast();
  const { data, refetch } = useQuery({
    queryKey: ["klantmail-instellingen"],
    queryFn: async () => {
      const { data } = await supabase.from("klantmail_instellingen" as any).select("*").order("sleutel");
      const sinds = new Date(Date.now() - 30 * 86400000).toISOString();
      const { data: log } = await supabase.from("klantmail_log" as any).select("sleutel,status").gte("created_at", sinds);
      const tel: Record<string, number> = {};
      for (const l of (log ?? []) as any[]) if (l.status === "niet_verzonden_schakelaar_uit") tel[l.sleutel] = (tel[l.sleutel] ?? 0) + 1;
      return { rijen: (data ?? []) as unknown as Instelling[], tel };
    },
  });
  const { data: prolong } = useQuery({
    queryKey: ["komende-prolongaties"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("prolongatie_kandidaten" as any, { _van: vandaag(), _tot: plusDagenISO(vandaag(), 30) });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
  const [aanzetten, setAanzetten] = useState<Instelling | null>(null);
  const [akkoord, setAkkoord] = useState(false);

  async function schakel(r: Instelling, aan: boolean, akk = false) {
    const { error } = await supabase.rpc("zet_klantmail_actief" as any, { _sleutel: r.sleutel, _actief: aan, _akkoord_boy: akk });
    if (error) return toast({ title: "Niet gelukt", description: error.message, variant: "destructive" });
    toast({ title: aan ? "Klantmail staat aan" : "Klantmail staat uit" });
    setAanzetten(null); setAkkoord(false); refetch();
  }

  return (
    <AdminLayout>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Klantmails</h1>
        <p className="text-sm text-muted-foreground">Nieuwe klantmails staan standaard uit. Zolang een mail uit staat wordt er niets verstuurd; er komt alleen een logregel. Een gewijzigde tekst zet de mail weer uit en vraagt opnieuw akkoord van Boy.</p>
        {(data?.rijen ?? []).map((r) => <MailKaart key={r.sleutel} r={r} teller={data?.tel[r.sleutel] ?? 0} onAan={() => setAanzetten(r)} onUit={() => schakel(r, false)} onOpgeslagen={() => refetch()} />)}

        <Card><CardHeader><CardTitle className="text-base">Komende prolongaties (30 dagen): {prolong?.length ?? 0}</CardTitle></CardHeader>
          <CardContent className="text-sm">
            <p className="mb-2 text-muted-foreground">Jaarpolissen die stilzwijgend verlengen. De prolongatiemail zou 14 dagen voor de verlengdatum uitgaan.</p>
            {(prolong ?? []).length === 0 ? <p className="text-muted-foreground">Geen prolongaties in de komende 30 dagen.</p> : (
              <table className="w-full"><tbody>{(prolong ?? []).map((p) => (
                <tr key={p.klant_contract_id} className="border-t"><td className="py-1 pr-2">{p.klantnaam}</td><td className="py-1 pr-2">{p.itemcode}</td>
                  <td className="py-1 pr-2">verlengt {formatDateNL(p.verlengdatum)}</td><td className="py-1 pr-2 text-muted-foreground">mail {formatDateNL(plusDagenISO(p.verlengdatum, -14))}</td></tr>))}</tbody></table>)}
          </CardContent>
        </Card>
      </div>
      {aanzetten && <Dialog open onOpenChange={(o) => !o && setAanzetten(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{aanzetten.naam} aanzetten</DialogTitle>
            <DialogDescription>Vanaf nu gaat deze mail echt naar klanten.</DialogDescription></DialogHeader>
          {aanzetten.status === "wacht_op_akkoord_boy" && <label className="flex items-center gap-2 text-sm"><Checkbox checked={akkoord} onCheckedChange={(v) => setAkkoord(v === true)} />Boy heeft de tekst goedgekeurd</label>}
          <DialogFooter><Button variant="outline" onClick={() => setAanzetten(null)}>Annuleren</Button>
            <Button disabled={aanzetten.status === "wacht_op_akkoord_boy" && !akkoord} onClick={() => schakel(aanzetten, true, akkoord)}>Aanzetten</Button></DialogFooter>
        </DialogContent>
      </Dialog>}
    </AdminLayout>
  );
}

function MailKaart({ r, teller, onAan, onUit, onOpgeslagen }: { r: Instelling; teller: number; onAan: () => void; onUit: () => void; onOpgeslagen: () => void }) {
  const { toast } = useToast();
  const [onderwerp, setOnderwerp] = useState(r.onderwerp ?? "");
  const [tekst, setTekst] = useState(r.tekst ?? "");
  const gewijzigd = onderwerp !== (r.onderwerp ?? "") || tekst !== (r.tekst ?? "");
  async function opslaan() {
    const { error } = await supabase.rpc("klantmail_tekst_opslaan" as any, { _sleutel: r.sleutel, _onderwerp: onderwerp, _tekst: tekst });
    if (error) return toast({ title: "Opslaan mislukt", description: error.message, variant: "destructive" });
    toast({ title: "Tekst opgeslagen", description: "De mail staat uit en wacht op akkoord van Boy." }); onOpgeslagen();
  }
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <div><CardTitle className="text-base">{r.naam}</CardTitle><p className="text-sm text-muted-foreground">{r.moment}</p></div>
        <div className="flex items-center gap-3">
          {r.status === "wacht_op_akkoord_boy" && <Badge variant="secondary">Wacht op akkoord Boy</Badge>}
          <span className="text-sm">{r.actief ? "Aan" : "Uit"}</span>
          <Switch checked={r.actief} onCheckedChange={(v) => (v ? onAan() : onUit())} aria-label={`${r.naam} aan of uit`} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {r.status === "wacht_op_akkoord_boy" && <p className="font-medium text-destructive">Concept, wacht op akkoord Boy</p>}
        <p className="text-muted-foreground">Laatste 30 dagen zou deze mail {teller} keer verstuurd zijn (niet verzonden, mail staat uit).</p>
        <div><Label htmlFor={`o-${r.sleutel}`}>Onderwerp</Label><Input id={`o-${r.sleutel}`} value={onderwerp} onChange={(e) => setOnderwerp(e.target.value)} /></div>
        <div><Label htmlFor={`t-${r.sleutel}`}>Concepttekst</Label><Textarea id={`t-${r.sleutel}`} rows={10} value={tekst} onChange={(e) => setTekst(e.target.value)} />
          <p className="mt-1 text-xs text-muted-foreground">Invulvelden: {r.placeholders.map((p) => `{${p}}`).join(" ")}</p></div>
        {gewijzigd && <Button size="sm" onClick={opslaan}>Opslaan</Button>}
        <div className="rounded-md border bg-muted/40 p-3"><p className="mb-1 text-xs font-medium text-muted-foreground">Voorbeeld</p>
          <p className="font-medium">{voorbeeld(onderwerp)}</p><p className="whitespace-pre-wrap">{voorbeeld(tekst)}</p></div>
      </CardContent>
    </Card>
  );
}

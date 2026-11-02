import { useState } from "react";
import { Loader2, Send, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

type Optie = { email: string; soort: "persoon" | "factuur" };
type LogRij = { op: string; soort: string; aan: string; verzonden: boolean; fout: string | null; aflevering: string };

/** Individuele uitnodiging voor Mijn ZP: kies adres, bekijk voorbeeld, verstuur pas na klik. */
export function PortalUitnodigen({ ondernemingId, onVerstuurd }: { ondernemingId: string; onVerstuurd?: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [opties, setOpties] = useState<Optie[]>([]);
  const [email, setEmail] = useState("");
  const [html, setHtml] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);
  const [log, setLog] = useState<LogRij[] | null>(null);
  const laadLog = async () => {
    const { data } = await roep({ modus: "log" });
    setLog((data?.log ?? []) as LogRij[]);
  };
  const roep = (body: Record<string, unknown>) => supabase.functions.invoke("crm-portal-uitnodigen", { body: { onderneming_id: ondernemingId, ...body } });

  const kies = async (e: string) => {
    setEmail(e); setHtml(null);
    const { data, error } = await roep({ modus: "voorbeeld", email: e });
    if (error || !data?.ok) { toast({ title: "Voorbeeld mislukt", description: error?.message ?? data?.error, variant: "destructive" }); return; }
    setHtml(data.html);
  };
  const openen = async () => {
    setOpen(true); setHtml(null); setEmail(""); setLog(null); void laadLog();
    const { data } = await roep({ modus: "opties" });
    const o = (data?.opties ?? []) as Optie[];
    setOpties(o);
    if (o[0]) kies(o[0].email);
  };
  const verstuur = async () => {
    setBezig(true);
    const { data, error } = await roep({ modus: "versturen", email });
    setBezig(false);
    if (error || !data?.ok) { toast({ title: "Uitnodigen mislukt", description: error?.message ?? data?.error, variant: "destructive" }); return; }
    toast({ title: "Uitnodiging verstuurd", description: `Aan ${data.aan}` });
    void laadLog(); onVerstuurd?.();
  };

  return (<>
    <Button size="sm" variant="outline" onClick={openen}><UserPlus className="h-4 w-4" /> Uitnodigen voor Mijn ZP</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>Uitnodigen voor Mijn ZP</DialogTitle><DialogDescription>Er wordt pas iets verstuurd als je op Versturen klikt.</DialogDescription></DialogHeader>
        {opties.length === 0 ? <p className="text-sm text-muted-foreground">Geen e-mailadres bekend bij deze klant.</p> : (
          <Select value={email} onValueChange={kies}>
            <SelectTrigger><SelectValue placeholder="Kies e-mailadres" /></SelectTrigger>
            <SelectContent>{opties.map((o) => <SelectItem key={o.email + o.soort} value={o.email}>{o.email} ({o.soort === "factuur" ? "factuur-e-mail" : "persoon"})</SelectItem>)}</SelectContent>
          </Select>)}
        {email && (html ? <iframe title="Voorbeeld uitnodiging" srcDoc={html} sandbox="" className="h-[50dvh] w-full rounded border" /> : <Loader2 className="h-5 w-5 animate-spin" />)}
        <div className="space-y-1 text-sm">
          <p className="font-medium">Eerder verstuurde Mijn ZP-mails</p>
          {log === null ? <Loader2 className="h-4 w-4 animate-spin" /> : log.length === 0 ? <p className="text-muted-foreground">Nog geen uitnodiging of inloglink verstuurd.</p> : (
            <ul className="space-y-1">{log.map((r, i) => (
              <li key={i} className="flex flex-wrap gap-x-2 text-muted-foreground">
                <span>{new Date(r.op).toLocaleString("nl-NL", { timeZone: "Europe/Amsterdam", dateStyle: "short", timeStyle: "short" })}</span>
                <span>{r.soort} aan {r.aan}</span>
                <span className={r.verzonden ? "text-foreground" : "text-destructive"}>{r.aflevering}{r.fout ? ` (${r.fout})` : ""}</span>
              </li>))}</ul>)}
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Annuleren</Button><Button onClick={verstuur} disabled={bezig || !html}>{bezig ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Versturen</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>);
}

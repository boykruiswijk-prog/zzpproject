import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { formatDateNL } from "@/lib/dateFormat";
import { Pencil } from "lucide-react";

export function CyberDatums({ leadId, contractId, ingang, eind, nieuwePer, onGewijzigd }: { leadId?: string; contractId?: string; ingang?: string | null; eind?: string | null; nieuwePer?: string | null; onGewijzigd?: () => void }) {
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(ingang ?? ""); const [tot, setTot] = useState(eind ?? ""); const [per, setPer] = useState(nieuwePer ?? "");
  const [reden, setReden] = useState(""); const [bezig, setBezig] = useState(false); const { toast } = useToast();
  return <div className="space-y-2 border-t border-border pt-3 text-sm">
    <div className="flex flex-wrap items-center gap-3"><strong>Cyber</strong><span>Ingang {formatDateNL(ingang)} · einde lopend cyberjaar {formatDateNL(eind)}</span><Button variant="ghost" size="icon" title="Cyberdatums wijzigen" aria-label="Cyberdatums wijzigen" onClick={() => setOpen(true)}><Pencil className="h-4 w-4" /></Button></div>
    <p className="text-muted-foreground">Nieuwe cybervoorwaarden per verlengingsdatum: {formatDateNL(nieuwePer)}</p>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>Cyberdatums wijzigen</DialogTitle></DialogHeader>
      <Label htmlFor="cyber-ingang">Cyber-ingangsdatum</Label><Input id="cyber-ingang" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
      <Label htmlFor="cyber-eind">Einde lopend cyberjaar</Label><Input id="cyber-eind" type="date" value={tot} onChange={(e) => setTot(e.target.value)} />
      <Label htmlFor="cyber-nieuw">Nieuwe cybervoorwaarden per verlengingsdatum</Label><Input id="cyber-nieuw" type="date" value={per} onChange={(e) => setPer(e.target.value)} />
      <Label htmlFor="cyber-reden">Toelichting</Label><Textarea id="cyber-reden" value={reden} maxLength={500} onChange={(e) => setReden(e.target.value)} />
      <Button disabled={bezig || reden.trim().length < 3} onClick={async () => {
        setBezig(true); const { error } = await supabase.rpc("cyber_datums_wijzigen", { _lead_id: leadId ?? null, _contract_id: contractId ?? null, _ingang: start || null, _eind: tot || null, _nieuwe_per: per || null, _toelichting: reden }); setBezig(false);
        if (error) { toast({ title: "Niet opgeslagen", description: error.message, variant: "destructive" }); return; }
        toast({ title: "Cyberdatums opgeslagen" }); setOpen(false); onGewijzigd?.();
      }}>Opslaan</Button>
    </DialogContent></Dialog>
  </div>;
}
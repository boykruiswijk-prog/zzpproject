// Openstaande betalingen (besluit Boy 12-11-2026): contact vastleggen en handmatig betaald met verplichte notitie.
// Alleen via RPC's; niets naar Exact en geen klantmail.
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

export function ContactGelegdKnop({ id, onKlaar }: { id: string; onKlaar: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [wijze, setWijze] = useState<"gebeld" | "gemaild">("gebeld");
  const [notitie, setNotitie] = useState("");
  const [bezig, setBezig] = useState(false);
  async function opslaan() {
    setBezig(true);
    const { error } = await supabase.rpc("incasso_contact_gelegd" as any, { _id: id, _wijze: wijze, _notitie: notitie.trim() || null });
    setBezig(false);
    if (error) return toast({ title: "Vastleggen mislukt", description: error.message, variant: "destructive" });
    toast({ title: "Contact vastgelegd", description: "De notitie staat op de klantkaart." });
    setOpen(false); setNotitie(""); onKlaar();
  }
  return (<>
    <Button size="sm" variant="outline" onClick={() => setOpen(true)}>Gebeld/gemaild</Button>
    {open && <Dialog open onOpenChange={(o) => !o && setOpen(false)}>
      <DialogContent>
        <DialogHeader><DialogTitle>Contact met de klant</DialogTitle>
          <DialogDescription>Zet een notitie op de klantkaart en werkt de datum van het laatste contact bij. Er wordt niets gemaild.</DialogDescription></DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="flex gap-2">
            <Button size="sm" variant={wijze === "gebeld" ? "default" : "outline"} onClick={() => setWijze("gebeld")}>Gebeld</Button>
            <Button size="sm" variant={wijze === "gemaild" ? "default" : "outline"} onClick={() => setWijze("gemaild")}>Gemaild</Button>
          </div>
          <div><Label htmlFor="cg-n">Notitie (optioneel)</Label><Textarea id="cg-n" rows={3} maxLength={1000} value={notitie} onChange={(e) => setNotitie(e.target.value)} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Annuleren</Button>
          <Button onClick={opslaan} disabled={bezig}>Vastleggen</Button></DialogFooter>
      </DialogContent>
    </Dialog>}
  </>);
}

export function BetaaldMetNotitieKnop({ id, onKlaar }: { id: string; onKlaar: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [notitie, setNotitie] = useState("");
  const [bezig, setBezig] = useState(false);
  const geldig = notitie.trim().length >= 3 && notitie.trim().length <= 500;
  async function opslaan() {
    setBezig(true);
    const { error } = await supabase.rpc("incasso_handmatig_betaald" as any, { _id: id, _notitie: notitie.trim() });
    setBezig(false);
    if (error) return toast({ title: "Op betaald zetten mislukt", description: error.message, variant: "destructive" });
    toast({ title: "Op betaald gezet", description: "De notitie staat op de klantkaart." });
    setOpen(false); onKlaar();
  }
  return (<>
    <Button size="sm" variant="outline" onClick={() => setOpen(true)}>Op betaald zetten</Button>
    {open && <Dialog open onOpenChange={(o) => !o && setOpen(false)}>
      <DialogContent>
        <DialogHeader><DialogTitle>Op betaald zetten</DialogTitle>
          <DialogDescription>Vul in hoe en wanneer er is betaald. Er gaat niets naar Exact.</DialogDescription></DialogHeader>
        <div><Label htmlFor="bm-n">Notitie (verplicht, 3 tot 500 tekens)</Label><Textarea id="bm-n" rows={3} maxLength={500} value={notitie} onChange={(e) => setNotitie(e.target.value)} /></div>
        <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Annuleren</Button>
          <Button onClick={opslaan} disabled={bezig || !geldig}>Op betaald zetten</Button></DialogFooter>
      </DialogContent>
    </Dialog>}
  </>);
}

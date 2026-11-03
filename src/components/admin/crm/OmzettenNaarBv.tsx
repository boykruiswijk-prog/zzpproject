import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { omzettenInvoerFout } from "@/lib/omzetting";

type Ond = { id: string; naam: string; kvk: string | null; rechtsvorm?: string | null };

/** Omzetten naar BV: zelfde polis en BAV-nummer naar de nieuwe onderneming als nieuwe versie (generate-certificate actie omzetten). Contracten en facturatie blijven ongewijzigd. */
export function OmzettenNaarBv({ polis, vanNaam, onKlaar }: { polis: { id: string; certificate_number: string | null }; vanNaam: string; onKlaar: () => void }) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [res, setRes] = useState<Ond[]>([]);
  const [naar, setNaar] = useState<Ond | null>(null);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [datum, setDatum] = useState("");
  const [reden, setReden] = useState("Eenmanszaak -> BV");
  const [bezig, setBezig] = useState(false);

  const zoek = async () => {
    const t = term.trim();
    if (t.length < 2) return;
    const q = supabase.from("ondernemingen").select("id,naam,kvk,rechtsvorm").is("samengevoegd_naar", null).limit(10);
    const { data } = /^\d{8}$/.test(t) ? await q.eq("kvk", t) : await q.ilike("naam", `%${t.replace(/[%_,()]/g, " ")}%`);
    setRes((data ?? []) as Ond[]);
  };
  const kies = async (o: Ond) => {
    setNaar(o); setRes([]);
    if (o.kvk) {
      const { data } = await supabase.from("leads").select("id").eq("type", "verzekering_aanvraag").eq("kvk_nummer", o.kvk).order("created_at", { ascending: false }).limit(1);
      setLeadId(data?.[0]?.id ?? null);
    } else setLeadId(null);
  };
  const fout = omzettenInvoerFout({ naarId: naar?.id ?? null, datum, reden });
  const voerUit = async () => {
    if (fout || !naar) return;
    setBezig(true);
    const { data, error } = await supabase.functions.invoke("generate-certificate", {
      body: { actie: "omzetten", policy_id: polis.id, naar_onderneming_id: naar.id, naar_lead_id: leadId, ingangsdatum: datum, reden: reden.trim() },
    });
    setBezig(false);
    let melding = (data as any)?.error as string | undefined;
    if (error && !melding) { try { melding = (await (error as any)?.context?.json?.())?.error; } catch { /* geen body */ } }
    if (error || melding) { toast.error(`Omzetten mislukt: ${melding ?? error?.message}`); return; }
    toast.success(`Certificaat ${polis.certificate_number} staat nu op ${naar.naam}. De oude versie is bewaard; er is geen mail verstuurd.`);
    setOpen(false); onKlaar();
  };

  return (<>
    <Button size="sm" variant="outline" onClick={() => setOpen(true)}>Omzetten naar BV</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Omzetten naar BV</DialogTitle>
          <DialogDescription>Certificaat {polis.certificate_number} van {vanNaam} gaat met hetzelfde BAV-nummer naar de nieuwe onderneming. De oude versie blijft zichtbaar als vervangen. Contracten en facturatie veranderen niet; die regel je apart.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          {naar ? (
            <p>Nieuwe onderneming: <span className="font-medium">{naar.naam}</span>{naar.kvk ? ` · KvK ${naar.kvk}` : ""} <Button size="sm" variant="link" onClick={() => setNaar(null)}>wijzig</Button>
              <span className="block text-xs text-muted-foreground">{leadId ? "De aanvraag van deze onderneming wordt aan het certificaat gekoppeld." : "Geen aanvraag gevonden voor deze onderneming."}</span></p>
          ) : (
            <div className="space-y-2">
              <Label>Nieuwe onderneming (naam of KvK-nummer)</Label>
              <div className="flex gap-2"><Input value={term} onChange={(e) => setTerm(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") zoek(); }} /><Button size="sm" onClick={zoek}>Zoeken</Button></div>
              {res.map((o) => <button key={o.id} type="button" className="block w-full truncate rounded px-2 py-1 text-left hover:bg-secondary" onClick={() => kies(o)}>{o.naam} <span className="text-xs text-muted-foreground">{o.rechtsvorm ?? ""} {o.kvk ? `· KvK ${o.kvk}` : ""}</span></button>)}
            </div>
          )}
          <div><Label htmlFor="omzet-datum">Ingangsdatum BV</Label><Input id="omzet-datum" type="date" value={datum} onChange={(e) => setDatum(e.target.value)} /></div>
          <div><Label htmlFor="omzet-reden">Toelichting</Label><Textarea id="omzet-reden" rows={2} value={reden} onChange={(e) => setReden(e.target.value)} /></div>
          {fout && <p className="text-xs text-muted-foreground">{fout}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Annuleren</Button>
          <Button disabled={!!fout || bezig} onClick={voerUit}>{bezig && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Omzetten</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>);
}

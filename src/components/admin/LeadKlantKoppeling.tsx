import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToonTestrecords } from "@/hooks/useToonTestrecords";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link2, Unlink, FilePlus, Loader2 } from "lucide-react";
import { zoekUniverseel, type ZoekResultaat } from "./UniverseleZoeker";
import { type LeadVoorinvulling } from "@/lib/handmatigeLead";

type Bron = LeadVoorinvulling & { id: string; gekoppeld_onderneming_id?: string | null; is_test?: boolean };
export function LeadKlantKoppeling({ lead, bron = "leads", onGewijzigd }: { lead: Bron; bron?: "leads" | "aanvraag_concepten"; onGewijzigd?: () => void }) {
  const { user, isTeamMember, isSupervisorOrAdmin } = useAuth(); const { toonTest } = useToonTestrecords();
  const [open, setOpen] = useState(false); const [zoek, setZoek] = useState(""); const [resultaten, setResultaten] = useState<ZoekResultaat[]>([]);
  const [keuze, setKeuze] = useState<ZoekResultaat | null>(null); const [personen, setPersonen] = useState<any[]>([]); const [persoon, setPersoon] = useState("nieuw");
  const [notitie, setNotitie] = useState(""); const [bezig, setBezig] = useState(false); const [zoeken, setZoeken] = useState(false); const [fout, setFout] = useState("");
  const qc = useQueryClient(); const nav = useNavigate();
  const gekoppeld = lead.gekoppeld_onderneming_id;
  useEffect(() => {
    if (!open || zoek.trim().length < 2 || gekoppeld) { setResultaten([]); return; }
    let weg = false;
    const timer = setTimeout(async () => {
      setZoeken(true);
      try { const r = await zoekUniverseel(zoek, toonTest); if (!weg) { setResultaten(r.klanten ?? []); setFout(""); } }
      catch(e: any) { if (!weg) setFout(e.message ?? "Zoeken mislukt"); }
      finally { if (!weg) setZoeken(false); }
    }, 300);
    return () => { weg = true; clearTimeout(timer); };
  }, [zoek, open, toonTest, gekoppeld]);
  async function kies(r: ZoekResultaat) {
    setKeuze(r); setPersoon("nieuw"); setFout("");
    const { data, error } = await supabase.from("persoon_onderneming").select("persoon_id,personen(id,voornaam,achternaam,email_weergave,is_test)").eq("onderneming_id", r.onderneming_id ?? r.id);
    if (error) { setFout(error.message); return; }
    setPersonen((data ?? []).map((p: any) => p.personen).filter((p: any) => p && p.is_test === !!lead.is_test));
  }
  async function bevestig() {
    if (!gekoppeld && !keuze) return;
    if (gekoppeld && notitie.trim().length < 3) { setFout("Vul de reden voor ontkoppelen in (minstens 3 tekens)"); return; }
    setBezig(true); setFout("");
    try {
      const r = gekoppeld
        ? await supabase.rpc("lead_klant_ontkoppelen", { _bron_tabel: bron, _bron_id: lead.id, _notitie: notitie })
        : await supabase.rpc("lead_klant_koppelen", { _bron_tabel: bron, _bron_id: lead.id, _onderneming_id: keuze?.onderneming_id ?? keuze?.id ?? "", _persoon_id: persoon === "nieuw" ? undefined : persoon, _notitie: notitie });
      if (r.error) throw r.error;
      await qc.invalidateQueries(); onGewijzigd?.(); setOpen(false); setKeuze(null); setNotitie("");
    } catch(e: any) { setFout(e.message ?? "Koppeling opslaan mislukt"); } finally { setBezig(false); }
  }
  if (!isTeamMember) return null;
  const magOntkoppelen = isSupervisorOrAdmin || user?.email?.toLowerCase() === "ellen.baars@zpzaken.nl";
  return <>
    {gekoppeld ? <><Button variant="outline" asChild><Link to={`/admin/klanten/${gekoppeld}`}>Klantkaart</Link></Button>{magOntkoppelen && <Button variant="outline" onClick={() => setOpen(true)}><Unlink className="h-4 w-4" />Ontkoppelen</Button>}</> : <Button variant="outline" onClick={() => setOpen(true)}><Link2 className="h-4 w-4" />Koppel aan klant</Button>}
    {!gekoppeld && <Button variant="outline" onClick={() => nav("/verzekeringen#combinatiepolis", { state: { aanvraagVanLead: { bron, id: lead.id } } })}><FilePlus className="h-4 w-4" />Aanvraag starten</Button>}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>{gekoppeld ? "Lead ontkoppelen" : "Koppel aan klant"}</DialogTitle></DialogHeader>
      <div className="space-y-4">
        {!gekoppeld && <><Input aria-label="Zoek een klantkaart" placeholder="Naam, e-mail, telefoon, KvK of BAV-nummer" value={zoek} onChange={e => { setZoek(e.target.value); setKeuze(null); }} />
          {zoeken && <Loader2 className="h-4 w-4 animate-spin" />}
          {!zoeken && zoek.length >= 2 && !resultaten.length && !fout && <p className="text-sm text-muted-foreground">Geen klantkaart gevonden</p>}
          <ul className="max-h-56 space-y-2 overflow-y-auto">{resultaten.map(r => <li key={r.bron_id ?? r.id}><Button className="h-auto w-full justify-start whitespace-normal text-left" variant={keuze?.id === r.id ? "secondary" : "outline"} onClick={() => kies(r)}>{r.titel} {r.kvk ? `· KvK ${r.kvk}` : ""}</Button></li>)}</ul>
          {keuze && <div className="space-y-2"><p className="font-medium">Gekozen: {keuze.titel}</p><Label>Contactpersoon</Label><Select value={persoon} onValueChange={setPersoon}><SelectTrigger aria-label="Contactpersoon"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="nieuw">Deze lead als nieuwe contactpersoon</SelectItem>{personen.map(p => <SelectItem key={p.id} value={p.id}>{[p.voornaam,p.achternaam].filter(Boolean).join(" ")} {p.email_weergave}</SelectItem>)}</SelectContent></Select></div>}
        </>}
        <div className="space-y-1"><Label htmlFor={`koppel-notitie-${lead.id}`}>{gekoppeld ? "Reden ontkoppelen" : "Notitie (optioneel)"}</Label><Textarea id={`koppel-notitie-${lead.id}`} maxLength={2000} value={notitie} onChange={e => setNotitie(e.target.value)} /></div>
        {fout && <p role="alert" className="text-sm text-destructive">{fout}</p>}
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Annuleren</Button><Button disabled={bezig || (!gekoppeld && !keuze)} onClick={bevestig}>{bezig && <Loader2 className="h-4 w-4 animate-spin" />}{gekoppeld ? "Ontkoppelen bevestigen" : "Koppeling bevestigen"}</Button></div>
      </div>
    </DialogContent></Dialog>
  </>;
}
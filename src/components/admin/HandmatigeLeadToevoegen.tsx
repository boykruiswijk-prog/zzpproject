import { useState } from "react";
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
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Plus, Search } from "lucide-react";
import { HANDMATIGE_BRONNEN, LEAD_INTERESSES, legeHandmatigeLead, handmatigeLeadFout, handmatigeLeadGegevens, type HandmatigeLead } from "@/lib/handmatigeLead";

type Dubbel = { id: string; titel: string; link: string; bron: string };
export function HandmatigeLeadToevoegen() {
  const { isTeamMember } = useAuth();
  const { magSchakelen } = useToonTestrecords();
  const [open, setOpen] = useState(false);
  const [g, setG] = useState<HandmatigeLead>(legeHandmatigeLead);
  const [isTest, setIsTest] = useState(false);
  const [fout, setFout] = useState("");
  const [dubbel, setDubbel] = useState<Dubbel[] | null>(null);
  const [bezig, setBezig] = useState(false);
  const [kvkBezig, setKvkBezig] = useState(false);
  const [kvkNaam, setKvkNaam] = useState("");
  const nav = useNavigate(); const qc = useQueryClient();
  if (!isTeamMember) return null;
  const verander = (veld: keyof HandmatigeLead, waarde: string) => { setG(p => ({ ...p, [veld]: waarde })); setDubbel(null); setFout(""); if (veld === "kvk") setKvkNaam(""); };
  async function opslaan(toch = false) {
    const f = handmatigeLeadFout(g); if (f) { setFout(f); return; }
    setBezig(true); setFout("");
    try {
      const gegevens = handmatigeLeadGegevens(g);
      if (!toch) {
        const { data, error } = await supabase.rpc("handmatige_lead_dubbelcheck", { _email: gegevens.email, _telefoon: gegevens.telefoon, _kvk: gegevens.kvk, _is_test: isTest });
        if (error) throw error;
        if (Array.isArray(data) && data.length) { setDubbel(data as unknown as Dubbel[]); return; }
      }
      const { data, error } = await supabase.rpc("handmatige_lead_toevoegen", { _gegevens: gegevens, _toch_nieuw: toch, _is_test: isTest });
      if (error) throw error;
      const r = data as { id?: string; dubbel?: Dubbel[] };
      if (r.dubbel) { setDubbel(r.dubbel); return; }
      if (!r.id) throw new Error("Opslaan mislukt");
      await qc.invalidateQueries(); setOpen(false); setG(legeHandmatigeLead); setDubbel(null); nav(`/admin/leads/${r.id}`);
    } catch (e: any) { setFout(e.message ?? "Opslaan mislukt"); } finally { setBezig(false); }
  }
  async function kvkOphalen() {
    setKvkBezig(true); setFout("");
    try {
      const { data, error } = await supabase.functions.invoke("kvk-basisprofiel", { body: { modus: "handmatige_lead", kvk: g.kvk } });
      if (error) throw new Error("KvK-gegevens ophalen mislukt; controleer je tweestapscode en probeer opnieuw");
      if (!data?.ok) throw new Error(data?.melding ?? "KvK-gegevens niet beschikbaar");
      setKvkNaam(data.naam ?? "");
    } catch (e: any) { setFout(e.message); } finally { setKvkBezig(false); }
  }
  const veld = (key: keyof HandmatigeLead, label: string, type = "text") => <div className="space-y-1"><Label htmlFor={`lead-${key}`}>{label}</Label><Input id={`lead-${key}`} type={type} maxLength={key === "beroep" ? 1000 : 250} value={g[key]} onChange={e => verander(key, e.target.value)} /></div>;
  return <><Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" />Lead toevoegen</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>Lead toevoegen</DialogTitle></DialogHeader>
      <form className="space-y-4" onSubmit={e => { e.preventDefault(); void opslaan(); }}>
        <div className="grid gap-3 sm:grid-cols-2">{veld("voornaam", "Voornaam")}{veld("achternaam", "Achternaam")}{veld("bedrijfsnaam", "Bedrijfsnaam")}
          <div className="space-y-1">{veld("kvk", "KvK (optioneel)")}<Button type="button" size="sm" variant="outline" onClick={kvkOphalen} disabled={kvkBezig || !/^\d{8}$/.test(g.kvk)}>{kvkBezig ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}KvK opzoeken</Button></div>
          {veld("email", "E-mail", "email")}{veld("telefoon", "Telefoon", "tel")}{veld("beroep", "Beroep / branche")}{veld("opvolgdatum", "Opvolgdatum (optioneel)", "date")}
          {([["interesse", "Interesse", LEAD_INTERESSES], ["bron", "Bron", HANDMATIGE_BRONNEN]] as const).map(([key, label, opties]) => <div key={key} className="space-y-1"><Label>{label}</Label><Select value={g[key]} onValueChange={v => verander(key,v)}><SelectTrigger aria-label={label}><SelectValue /></SelectTrigger><SelectContent>{Object.entries(opties).map(([v,l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select></div>)}
        </div>
        {kvkNaam && <div className="flex flex-wrap items-center gap-2 text-sm"><span>{kvkNaam}</span><Button type="button" variant="outline" size="sm" onClick={() => verander("bedrijfsnaam", kvkNaam)}>Naam overnemen</Button></div>}
        <div className="space-y-1"><Label htmlFor="lead-notitie">Notitie</Label><Textarea id="lead-notitie" maxLength={2000} value={g.notitie} onChange={e => verander("notitie",e.target.value)} /></div>
        {magSchakelen && <label className="flex items-center gap-2 text-sm"><Checkbox checked={isTest} onCheckedChange={v => { setIsTest(v === true); setDubbel(null); }} />Testlead</label>}
        {dubbel && <div className="space-y-2 border-t border-border pt-3"><h3 className="font-medium">Bestaande leads of klanten gevonden</h3><ul className="space-y-2">{dubbel.map(r => <li key={`${r.bron}-${r.id}`} className="flex flex-wrap items-center justify-between gap-2 text-sm"><span className="break-words">{r.titel || "Onbekend"} · {r.bron}</span><Button variant="outline" size="sm" asChild><Link to={r.link} onClick={() => setOpen(false)}>Openen</Link></Button></li>)}</ul><Button type="button" variant="outline" disabled={bezig} onClick={() => opslaan(true)}>Toch nieuwe lead toevoegen</Button></div>}
        {fout && <p role="alert" className="text-sm text-destructive">{fout}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuleren</Button>{!dubbel && <Button type="submit" disabled={bezig}>{bezig && <Loader2 className="h-4 w-4 animate-spin" />}Opslaan</Button>}</div>
      </form>
    </DialogContent></Dialog></>;
}
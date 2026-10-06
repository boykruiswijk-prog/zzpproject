import { useEffect, useState } from "react";
import { Loader2, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { zoekPdokAdres } from "@/hooks/usePdokAdres";
import { maskeerIban } from "@/lib/klantContracten";

type Veld = { key: string; label: string; doel: "ond" | "pers" };
const VELDEN: Veld[] = [
  { key: "voornaam", label: "Voornaam", doel: "pers" }, { key: "achternaam", label: "Achternaam", doel: "pers" },
  { key: "email_weergave", label: "E-mail", doel: "pers" }, { key: "telefoon", label: "Telefoon", doel: "pers" },
  { key: "naam", label: "Bedrijfsnaam", doel: "ond" }, { key: "factuur_email", label: "Factuur-e-mail", doel: "ond" }, { key: "kvk", label: "KvK-nummer", doel: "ond" }, { key: "rechtsvorm", label: "Rechtsvorm", doel: "ond" },
  { key: "postcode", label: "Postcode", doel: "ond" }, { key: "huisnummer", label: "Huisnummer", doel: "ond" },
  { key: "straat", label: "Straat", doel: "ond" }, { key: "plaats", label: "Plaats", doel: "ond" },
];

/** "Gegevens wijzigen" op de klantkaart. Alles via RPC crm_gegevens_wijzigen (audit, tijdlijn, taak Exact bij Roxy). */
export function GegevensWijzigen({ ondernemingen, personen, onGewijzigd }: { ondernemingen: { id: string; naam: string | null }[]; personen: { id: string; voornaam?: string | null; achternaam?: string | null }[]; onGewijzigd?: () => void }) {
  const { isSupervisorOrAdmin, isVerzekering } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [ondId, setOndId] = useState(ondernemingen[0]?.id ?? "");
  const [persId, setPersId] = useState(personen[0]?.id ?? "");
  const [oud, setOud] = useState<Record<string, string>>({});
  const [waarden, setWaarden] = useState<Record<string, string>>({});
  const [ibanOud, setIbanOud] = useState<string | null>(null);
  const [iban, setIban] = useState("");
  const [pdok, setPdok] = useState<string>("");
  const [bezig, setBezig] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const [o, p] = await Promise.all([
        ondId ? supabase.from("ondernemingen").select("naam,factuur_email,kvk,rechtsvorm,straat,huisnummer,postcode,plaats,iban").eq("id", ondId).maybeSingle() : Promise.resolve({ data: null }),
        persId ? supabase.from("personen").select("voornaam,achternaam,email_weergave,telefoon").eq("id", persId).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      const w: Record<string, string> = {};
      for (const v of VELDEN) w[v.key] = String(((v.doel === "ond" ? o.data : p.data) as any)?.[v.key] ?? "");
      setOud(w); setWaarden(w); setIbanOud((o.data as any)?.iban ?? null); setIban(""); setPdok("");
    })();
  }, [open, ondId, persId]);

  useEffect(() => {
    if (!open || !waarden.postcode || !waarden.huisnummer || (waarden.postcode === oud.postcode && waarden.huisnummer === oud.huisnummer)) return;
    const t = setTimeout(async () => {
      const r = await zoekPdokAdres(waarden.postcode, waarden.huisnummer);
      if (r) { setWaarden((w) => ({ ...w, straat: r.straat, plaats: r.plaats, postcode: r.postcode })); setPdok(`Gevonden bij PDOK: ${r.straat} ${r.huisnummer}, ${r.postcode} ${r.plaats}`); }
      else setPdok("Adres niet gevonden bij PDOK. Controleer postcode en huisnummer.");
    }, 400);
    return () => clearTimeout(t);
  }, [waarden.postcode, waarden.huisnummer, open]);

  if (!(isVerzekering || isSupervisorOrAdmin)) return null;

  const opslaan = async () => {
    const w: Record<string, string> = {};
    for (const v of VELDEN) if ((waarden[v.key] ?? "") !== (oud[v.key] ?? "") && (v.doel === "ond" ? ondId : persId)) w[v.key] = waarden[v.key];
    if (iban.trim() && isSupervisorOrAdmin) w.iban = iban;
    if (!Object.keys(w).length) { setOpen(false); return; }
    setBezig(true);
    const { data, error } = await (supabase.rpc as any)("crm_gegevens_wijzigen", { _onderneming_id: ondId || null, _persoon_id: persId || null, _wijzigingen: w });
    setBezig(false);
    if (error) { toast({ title: "Opslaan mislukt", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Gegevens gewijzigd", description: data?.exact_taak ? "Er staat een taak bij Roxy om dit ook in Exact aan te passen." : undefined });
    setOpen(false); onGewijzigd?.();
  };

  return (<>
    <Button size="sm" variant="outline" onClick={() => setOpen(true)}><Pencil className="h-4 w-4" /> Gegevens wijzigen</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto">
        <DialogHeader><DialogTitle>Gegevens wijzigen</DialogTitle><DialogDescription>Elke wijziging wordt vastgelegd met oude en nieuwe waarde. Exact wordt niet automatisch aangepast.</DialogDescription></DialogHeader>
        {ondernemingen.length > 1 && <Select value={ondId} onValueChange={setOndId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ondernemingen.map((o) => <SelectItem key={o.id} value={o.id}>{o.naam}</SelectItem>)}</SelectContent></Select>}
        {personen.length > 1 && <Select value={persId} onValueChange={setPersId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{personen.map((p) => <SelectItem key={p.id} value={p.id}>{[p.voornaam, p.achternaam].filter(Boolean).join(" ")}</SelectItem>)}</SelectContent></Select>}
        <div className="grid gap-3 sm:grid-cols-2">
          {VELDEN.filter((v) => (v.doel === "ond" ? ondId : persId)).map((v) => (
            <label key={v.key} className="text-sm"><span className="text-muted-foreground">{v.label}</span>
              <Input value={waarden[v.key] ?? ""} onChange={(e) => setWaarden((w) => ({ ...w, [v.key]: e.target.value }))} /></label>
          ))}
          {ondId && isSupervisorOrAdmin && (
            <label className="text-sm sm:col-span-2"><span className="text-muted-foreground">IBAN (nu {ibanOud ? maskeerIban(ibanOud) : "leeg"})</span>
              <Input placeholder="Nieuw IBAN, leeg laten om niet te wijzigen" value={iban} onChange={(e) => setIban(e.target.value)} autoComplete="off" /></label>
          )}
        </div>
        {pdok && <p className="text-xs text-muted-foreground">{pdok}</p>}
        <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Annuleren</Button><Button onClick={opslaan} disabled={bezig}>{bezig && <Loader2 className="h-4 w-4 animate-spin" />} Opslaan</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>);
}

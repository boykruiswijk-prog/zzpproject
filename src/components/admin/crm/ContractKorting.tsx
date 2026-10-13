import { useEffect, useState } from "react";
import { Percent } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatEuro } from "@/lib/klantContracten";
import { formatDateNL } from "@/lib/dateFormat";
import { factuurRegelTekst } from "../../../../supabase/functions/_shared/factuurRegel";
import { conceptWaarschuwing, kortingVoorbeeld, pctTekst, stopKorting, zetKorting, type KortingVoorbeeld } from "@/lib/contractKorting";

type Contract = { id: string; status: string; cyclus: string; korting_pct?: number | null; korting_vanaf?: string | null; korting_tot?: string | null; korting_reden?: string | null };

const vandaag = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam" }).format(new Date());

/** Badge "30% korting tot …/onbepaald" (alleen als de korting nog loopt of nog ingaat). */
export function KortingBadge({ c }: { c: Contract }) {
  if (c.korting_pct == null || (c.korting_tot && c.korting_tot < vandaag())) return null;
  return (
    <Badge variant="outline" className="mt-1 border-primary/40 text-primary" title={c.korting_reden ?? ""}>
      {pctTekst(c.korting_pct)} korting{c.korting_vanaf && c.korting_vanaf > vandaag() ? ` vanaf ${formatDateNL(c.korting_vanaf)}` : ""} tot {c.korting_tot ? formatDateNL(c.korting_tot) : "onbepaald"}
    </Badge>
  );
}

export function ContractKortingKnop({ c, onGewijzigd }: { c: Contract; onGewijzigd: () => void }) {
  const [open, setOpen] = useState<null | "zet" | "stop">(null);
  const lopend = ["actief", "loopt_af", "einddatum_controle"].includes(c.status);
  const heeft = c.korting_pct != null && !(c.korting_tot && c.korting_tot < vandaag());
  if (!lopend && !heeft) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {lopend && <Button size="sm" variant="outline" onClick={() => setOpen("zet")}><Percent className="h-3 w-3" /> Korting</Button>}
      {heeft && <Button size="sm" variant="outline" onClick={() => setOpen("stop")}>Korting stoppen</Button>}
      {open === "zet" && <KortingDialoog c={c} onClose={() => setOpen(null)} onGewijzigd={onGewijzigd} />}
      {open === "stop" && <StopDialoog c={c} onClose={() => setOpen(null)} onGewijzigd={onGewijzigd} />}
    </div>
  );
}

function KortingDialoog({ c, onClose, onGewijzigd }: { c: Contract; onClose: () => void; onGewijzigd: () => void }) {
  const [pct, setPct] = useState("");
  const [reden, setReden] = useState("");
  const [vanaf, setVanaf] = useState("");
  const [tot, setTot] = useState("");
  const [vb, setVb] = useState<KortingVoorbeeld | null>(null);
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);
  const p = Number(pct.replace(",", "."));
  const pOk = p > 0 && p < 100;

  useEffect(() => {
    let weg = false;
    kortingVoorbeeld(c.id, pOk ? p : null, vanaf || null).then((d) => { if (weg) return; setVb(d); if (!vanaf && d.periode_start) setVanaf(d.periode_start); setFout(null); })
      .catch((e) => !weg && setFout((e as Error).message));
    return () => { weg = true; };
  }, [c.id, pct, vanaf]); // eslint-disable-line react-hooks/exhaustive-deps

  const teVroeg = !!(vb && vanaf && vanaf < vb.grens);
  const invoerFout = !pOk ? "Vul een percentage in tussen 0 en 100." : reden.trim().length < 3 ? "Reden is verplicht." : !vanaf ? "Kies een vanaf-datum."
    : teVroeg ? `Korting kan alleen vanaf de volgende factuurperiode (${formatDateNL(vb!.grens)}); al gefactureerde perioden via een creditnota.`
    : tot && tot < vanaf ? "De tot-datum ligt voor de vanaf-datum." : null;
  const omschrijving = vb?.periode_start && vb.periode_eind && pOk
    ? factuurRegelTekst({ itemcode: vb.itemcode, product: vb.product, periode_start: vb.periode_start, periode_eind: vb.periode_eind, korting_pct: p }) : "";
  const per = c.cyclus === "jaar" ? "jaar" : "maand";
  const aantal = Number(vb?.aantal ?? 1);

  const opslaan = async () => {
    if (invoerFout) return;
    setBezig(true);
    try {
      const r = await zetKorting(c.id, p, reden, vanaf, tot || null);
      toast.success(`Korting ${pctTekst(p)} opgeslagen`);
      if (r.concept_periode) toast.warning(conceptWaarschuwing(r.concept_periode), { duration: 15000 });
      onGewijzigd(); onClose();
    } catch (e) { toast.error((e as Error).message); } finally { setBezig(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Korting op deze contractregel</DialogTitle>
          <DialogDescription>Het contractbedrag blijft ongewijzigd; de korting geldt alleen vanaf de volgende factuurperiode. {c.korting_pct != null ? `Een nieuwe korting vervangt de huidige (${pctTekst(c.korting_pct)}).` : ""}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1"><Label htmlFor="k-pct">Percentage</Label><Input id="k-pct" inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value)} placeholder="30" /></div>
          <div className="space-y-1"><Label htmlFor="k-vanaf">Vanaf</Label><Input id="k-vanaf" type="date" value={vanaf} min={vb?.grens} onChange={(e) => setVanaf(e.target.value)} /></div>
          <div className="space-y-1 sm:col-span-2"><Label htmlFor="k-tot">Tot en met (optioneel, leeg = onbepaald)</Label><Input id="k-tot" type="date" value={tot} onChange={(e) => setTot(e.target.value)} /></div>
          <div className="space-y-1 sm:col-span-2"><Label htmlFor="k-reden">Reden</Label><Textarea id="k-reden" value={reden} maxLength={500} onChange={(e) => setReden(e.target.value)} /></div>
        </div>
        {vb && pOk && vb.periode_start && vb.basis != null && vb.netto != null && (
          <div className="rounded-md border bg-secondary p-3 text-sm">
            Volgende factuur {formatDateNL(vb.periode_start)}: was {formatEuro(vb.basis * aantal)} per {per}, wordt {formatEuro(vb.netto * aantal)} ({pctTekst(p)} korting). Regel in Exact: '{omschrijving}'.
          </div>
        )}
        {vb?.concept_periode && <p className="rounded-md border border-warning bg-warning/10 p-2 text-sm">{conceptWaarschuwing(vb.concept_periode)}</p>}
        {(fout || invoerFout) && <p className="text-xs text-muted-foreground">{fout ?? invoerFout}</p>}
        <DialogFooter><Button variant="outline" onClick={onClose}>Annuleren</Button><Button onClick={opslaan} disabled={!!invoerFout || bezig}>Opslaan</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StopDialoog({ c, onClose, onGewijzigd }: { c: Contract; onClose: () => void; onGewijzigd: () => void }) {
  const [toelichting, setToelichting] = useState("");
  const [vb, setVb] = useState<KortingVoorbeeld | null>(null);
  const [bezig, setBezig] = useState(false);
  useEffect(() => { kortingVoorbeeld(c.id, null, null).then(setVb).catch(() => {}); }, [c.id]);
  const ok = toelichting.trim().length >= 3 && toelichting.trim().length <= 500;
  const stop = async () => {
    setBezig(true);
    try {
      const r = await stopKorting(c.id, toelichting);
      toast.success(`Korting gestopt per ${formatDateNL(r.per)}`);
      if (r.concept_periode) toast.warning(conceptWaarschuwing(r.concept_periode), { duration: 15000 });
      onGewijzigd(); onClose();
    } catch (e) { toast.error((e as Error).message); } finally { setBezig(false); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Korting stoppen</DialogTitle>
          <DialogDescription>De korting stopt per de eerstvolgende niet-gefactureerde periode{vb ? ` (${formatDateNL(vb.grens)})` : ""}, niet met terugwerkende kracht.</DialogDescription>
        </DialogHeader>
        {vb?.concept_periode && <p className="rounded-md border border-warning bg-warning/10 p-2 text-sm">{conceptWaarschuwing(vb.concept_periode)}</p>}
        <div className="space-y-1"><Label htmlFor="k-stop">Toelichting</Label><Textarea id="k-stop" value={toelichting} maxLength={500} onChange={(e) => setToelichting(e.target.value)} /></div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Annuleren</Button><Button variant="destructive" onClick={stop} disabled={!ok || bezig}>Korting stoppen</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

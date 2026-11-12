import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatDateNL } from "@/lib/dateFormat";
import { koppelRedenFout, vorigeOndernemingUitFormulier } from "@/lib/vorigeOnderneming";
import { useMagBeeindigen } from "./LopendeProducten";

// Alleen naam, rechtsvorm en KvK: nooit rekeningnummers in deze koppeling.
type Ond = { id: string; naam: string; rechtsvorm: string | null; kvk: string | null };
const KOLOMMEN = "id,naam,rechtsvorm,kvk";

async function zoekOndernemingen(zoek: string, behalve: string): Promise<Ond[]> {
  const q = zoek.trim().replace(/[%,()]/g, "");
  if (q.length < 2) return [];
  const { data } = await supabase.from("ondernemingen").select(KOLOMMEN).or(`naam.ilike.%${q}%,kvk.eq.${q.replace(/\D/g, "") || "0"}`).neq("id", behalve).limit(8);
  return (data ?? []) as Ond[];
}

export function useKoppelingen(ondernemingId: string | undefined) {
  return useQuery({
    queryKey: ["onderneming-koppelingen", ondernemingId], enabled: !!ondernemingId,
    queryFn: async () => {
      const { data } = await (supabase.from as any)("onderneming_koppelingen").select("id,vorige_onderneming_id,nieuwe_onderneming_id,reden,vastgelegd_op")
        .or(`vorige_onderneming_id.eq.${ondernemingId},nieuwe_onderneming_id.eq.${ondernemingId}`);
      const rijen = (data ?? []) as Array<{ id: string; vorige_onderneming_id: string; nieuwe_onderneming_id: string; reden: string; vastgelegd_op: string }>;
      const ids = [...new Set(rijen.flatMap((r) => [r.vorige_onderneming_id, r.nieuwe_onderneming_id]))].filter((x) => x !== ondernemingId);
      const { data: o } = ids.length ? await supabase.from("ondernemingen").select(KOLOMMEN).in("id", ids) : { data: [] };
      const namen = Object.fromEntries(((o ?? []) as Ond[]).map((x) => [x.id, x]));
      return rijen.map((r) => {
        const isNieuw = r.nieuwe_onderneming_id === ondernemingId;
        const ander = namen[isNieuw ? r.vorige_onderneming_id : r.nieuwe_onderneming_id];
        return { id: r.id, richting: isNieuw ? "vorige" as const : "nieuwe" as const, ander: ander ?? null, reden: r.reden, op: r.vastgelegd_op };
      });
    },
  });
}

/** Toont de koppeling op beide ondernemingen, plus de knop "Koppel aan vorige onderneming". */
export function KoppelingenBlok({ ond }: { ond: Ond }) {
  const { data = [] } = useKoppelingen(ond.id);
  return (
    <div className="space-y-2" data-testid="koppelingen-blok">
      {data.map((k) => (
        <div key={k.id} className="rounded-md border border-primary/40 bg-primary/5 p-3 text-sm">
          {k.richting === "vorige" ? "Vorige onderneming: " : "Nieuwe onderneming: "}
          {k.ander ? <Link to={`/admin/klanten/${k.ander.id}`} className="font-medium text-primary hover:underline">{k.ander.naam}</Link> : "onbekend"}
          {k.ander?.kvk ? ` (KvK ${k.ander.kvk})` : ""}, gekoppeld op {formatDateNL(k.op)}. <span className="text-muted-foreground">Reden: {k.reden}</span>
        </div>
      ))}
      <KoppelVorigeKnop ond={ond} />
    </div>
  );
}

export function KoppelVorigeKnop({ ond, beginZoek = "", leadId, label = "Koppel aan vorige onderneming" }: { ond: Ond; beginZoek?: string; leadId?: string; label?: string }) {
  const mag = useMagBeeindigen();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [zoek, setZoek] = useState(beginZoek);
  const [kandidaten, setKandidaten] = useState<Ond[]>([]);
  const [gekozen, setGekozen] = useState<Ond | null>(null);
  const [reden, setReden] = useState("");
  const [bezig, setBezig] = useState(false);
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => setKandidaten(await zoekOndernemingen(zoek, ond.id)), 250);
    return () => clearTimeout(t);
  }, [zoek, open, ond.id]);
  if (!mag) return null;
  const fout = koppelRedenFout(reden);

  async function opslaan() {
    if (!gekozen || fout) return;
    setBezig(true);
    const { error } = await (supabase.rpc as any)("onderneming_koppel_vorige", { _nieuw: ond.id, _vorig: gekozen.id, _reden: reden.trim(), _lead_id: leadId ?? null });
    setBezig(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${ond.naam} is gekoppeld aan ${gekozen.naam}. Polissen en contracten zijn niet verplaatst.`);
    setOpen(false); setGekozen(null); setReden("");
    qc.invalidateQueries({ queryKey: ["onderneming-koppelingen"] });
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>{label}</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Koppel {ond.naam} aan vorige onderneming</DialogTitle>
            <DialogDescription>Voor een rechtsvormwijziging, bijvoorbeeld eenmanszaak naar bv. De klant zegt de oude polis op en vraagt een nieuwe aan; deze koppeling houdt gegevens en historie bij elkaar. Er wordt geen polis, contract of BAV-nummer verplaatst en er wordt niets gemaild.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="space-y-1"><Label htmlFor="koppel-zoek">Zoek vorige onderneming op naam of KvK</Label>
              <Input id="koppel-zoek" value={zoek} onChange={(e) => setZoek(e.target.value)} />
              {kandidaten.map((k) => <button key={k.id} type="button" onClick={() => setGekozen(k)} className={`block w-full rounded border p-2 text-left ${gekozen?.id === k.id ? "border-primary" : "border-border"}`}>{k.naam} <span className="text-xs text-muted-foreground">{k.rechtsvorm ?? ""} · KvK {k.kvk ?? "-"}</span></button>)}
            </div>
            <div><Label htmlFor="koppel-reden">Reden (verplicht)</Label><Textarea id="koppel-reden" rows={3} maxLength={500} value={reden} onChange={(e) => setReden(e.target.value)} />
              {reden && fout && <p className="mt-1 text-xs text-destructive">{fout}</p>}</div>
          </div>
          <DialogFooter className="gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Annuleren</Button>
            <Button onClick={opslaan} disabled={!gekozen || !!fout || bezig}>{bezig && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Koppelen</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Suggestie op een aanvraag waarin de klant een vorige onderneming opgaf. Niets gebeurt automatisch. */
export function KoppelSuggestie({ lead }: { lead: { id: string; gekoppeld_onderneming_id?: string | null; extra_data?: any } }) {
  const vorige = vorigeOndernemingUitFormulier(lead.extra_data?.formulier);
  const ondId = lead.gekoppeld_onderneming_id ?? undefined;
  const { data: ond } = useQuery({
    queryKey: ["koppel-suggestie-ond", ondId], enabled: !!ondId && !!vorige,
    queryFn: async () => ((await supabase.from("ondernemingen").select(KOLOMMEN).eq("id", ondId!).maybeSingle()).data ?? null) as Ond | null,
  });
  const { data: koppelingen = [] } = useKoppelingen(vorige ? ondId : undefined);
  if (!vorige) return null;
  const alGekoppeld = koppelingen.some((k) => k.richting === "vorige");
  return (
    <div className="rounded-md border border-primary/40 bg-primary/5 p-4 text-sm" data-testid="koppel-suggestie">
      <p className="font-semibold">Vorige onderneming opgegeven: {vorige.naam || "naam onbekend"}{vorige.kvk ? ` (KvK ${vorige.kvk})` : ""}</p>
      {alGekoppeld ? <p className="mt-1 text-muted-foreground">Al gekoppeld aan de vorige onderneming.</p>
        : ond ? <div className="mt-2 space-y-2"><p className="text-muted-foreground">Voorstel: koppel {ond.naam} aan de vorige onderneming, zodat gegevens en historie bij elkaar blijven. Controleer ook dat de oude polis is opgezegd.</p>
            <KoppelVorigeKnop ond={ond} beginZoek={vorige.kvk || vorige.naam} leadId={lead.id} label="Koppel aan vorige onderneming" /></div>
        : <p className="mt-1 text-muted-foreground">Na activatie kun je de nieuwe onderneming koppelen via de klantkaart: Koppel aan vorige onderneming.</p>}
    </div>
  );
}

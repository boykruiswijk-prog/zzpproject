import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type Contract = { abonnement_nr: string | null; product: string; status: string | null; begin: string | null; eind: string | null; bedrag: number; cyclus: string };
type Rij = { onderneming_id: string; naam: string | null; kvk: string | null; exact_relatie_code: string | null; afas: string[] | null; klantopgave: string[] | null; contracten: Contract[] | null; later: { op: string; toelichting: string | null } | null };

const datum = (d: string | null) => (d ? new Date(d).toLocaleDateString("nl-NL") : "-");

function RijKaart({ r, onKlaar }: { r: Rij; onKlaar: () => void }) {
  const [nummer, setNummer] = useState(r.klantopgave?.[0] ?? "");
  const [toelichting, setToelichting] = useState("");
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const rpc = async (naam: string, args: Record<string, unknown>, ok: string) => {
    setBezig(true); setFout(null);
    const { error } = await (supabase.rpc as any)(naam, args);
    setBezig(false);
    if (error) { setFout(error.message); return; }
    toast.success(ok); onKlaar();
  };
  return (
    <Card><CardContent className="space-y-3 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Link to={`/admin/klanten/${r.onderneming_id}`} className="font-semibold hover:underline">{r.naam ?? "Onbekend"}</Link>
        {r.later && <Badge variant="secondary">Later ({datum(r.later.op)}){r.later.toelichting ? `: ${r.later.toelichting}` : ""}</Badge>}
      </div>
      <dl className="grid gap-1 text-sm sm:grid-cols-2">
        <div><dt className="inline text-muted-foreground">KVK: </dt><dd className="inline">{r.kvk ?? "-"}</dd></div>
        <div><dt className="inline text-muted-foreground">Exact-relatiecode: </dt><dd className="inline">{r.exact_relatie_code ?? "-"}</dd></div>
        <div><dt className="inline text-muted-foreground">AFAS-abonnementsnummer (oud systeem): </dt><dd className="inline">{r.afas?.join(", ") ?? "-"}</dd></div>
        <div><dt className="inline text-muted-foreground">Klantopgave (onbevestigd): </dt><dd className="inline">{r.klantopgave?.join(", ") ?? "-"}</dd></div>
        <div className="sm:col-span-2"><dt className="text-muted-foreground">BAV-nummer: </dt><dd>BAV-nummer onbekend</dd></div>
      </dl>
      {r.contracten?.length ? <ul className="space-y-0.5 text-xs text-muted-foreground">{r.contracten.map((c, i) => <li key={i}>{c.product} · {c.status ?? "-"} · {datum(c.begin)} t/m {datum(c.eind)} · EUR {Number(c.bedrag).toFixed(2)}/{c.cyclus}{c.abonnement_nr ? ` · AFAS ${c.abonnement_nr}` : ""}</li>)}</ul> : null}
      <div className="grid gap-2 sm:grid-cols-[10rem_1fr_auto_auto]">
        <Input aria-label="BAV-nummer" placeholder="BAV-nummer, bv. ZPBAV0123" value={nummer} onChange={e => setNummer(e.target.value)} />
        <Input aria-label="Toelichting" placeholder="Toelichting: waar komt het nummer vandaan?" value={toelichting} onChange={e => setToelichting(e.target.value)} />
        <Button disabled={bezig || nummer.trim().length < 3 || toelichting.trim().length < 3} onClick={() => rpc("bav_nummer_handmatig_bevestigen", { _onderneming_id: r.onderneming_id, _nummer: nummer, _toelichting: toelichting }, "BAV-nummer bevestigd")}>Bevestigen</Button>
        <Button variant="outline" disabled={bezig} onClick={() => rpc("bav_nummer_later", { _onderneming_id: r.onderneming_id, _toelichting: toelichting }, "Gemarkeerd als later")}>Later</Button>
      </div>
      {fout && <p role="alert" className="text-sm text-destructive">{fout}</p>}
    </CardContent></Card>
  );
}

export default function BavNummerNakijken() {
  const qc = useQueryClient();
  const [zoek, setZoek] = useState("");
  const { data, isLoading, error } = useQuery({
    queryKey: ["bav-nummer-werklijst"],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("bav_nummer_werklijst");
      if (error) throw error;
      return (data ?? []) as Rij[];
    },
  });
  const ververs = () => { qc.invalidateQueries({ queryKey: ["bav-nummer-werklijst"] }); qc.invalidateQueries({ queryKey: ["menu-tellers"] }); };
  const q = zoek.trim().toLowerCase();
  const rijen = (data ?? []).filter(r => !q || [r.naam, r.kvk, r.exact_relatie_code, ...(r.afas ?? []), ...(r.klantopgave ?? [])].some(v => v?.toLowerCase().includes(q)));
  const open = (data ?? []).filter(r => !r.later).length;
  return (
    <AdminLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">BAV-nummer nakijken</h1>
          <p className="text-sm text-muted-foreground">Klanten met alleen een AFAS-abonnementsnummer (oud systeem) en geen bevestigd BAV-nummer. Er wordt niets automatisch ingevuld. Een nummer dat al bij een andere klant bekend is, wordt geweigerd.</p>
          <p className="mt-1 text-sm">{open} open · {(data?.length ?? 0) - open} op later</p>
        </div>
        <Input placeholder="Zoek op naam, KVK, Exact-relatiecode of nummer" value={zoek} onChange={e => setZoek(e.target.value)} />
        {isLoading && <p>Laden...</p>}
        {error && <p className="text-destructive">{(error as Error).message}</p>}
        {rijen.map(r => <RijKaart key={r.onderneming_id} r={r} onKlaar={ververs} />)}
      </div>
    </AdminLayout>
  );
}

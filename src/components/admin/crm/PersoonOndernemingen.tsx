import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Link2, Loader2, Unlink } from "lucide-react";

type Ond = { id: string; naam: string; rechtsvorm?: string | null; kvk?: string | null };

/** Ondernemingen van een persoon; koppelen/ontkoppelen alleen via RPC persoon_onderneming_(ont)koppelen (audit + tijdlijnnotitie). */
export function PersoonOndernemingen({ persoonId, ondernemingen, onGewijzigd }: { persoonId: string; ondernemingen: Ond[]; onGewijzigd: () => void }) {
  const { toast } = useToast();
  const [zoekOpen, setZoekOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [resultaten, setResultaten] = useState<Ond[]>([]);
  const [bezig, setBezig] = useState(false);
  const [ontkoppel, setOntkoppel] = useState<string | null>(null);
  const [reden, setReden] = useState("");

  const zoek = async () => {
    const t = term.trim();
    if (t.length < 2) return;
    setBezig(true);
    const q = supabase.from("ondernemingen").select("id,naam,rechtsvorm,kvk").is("samengevoegd_naar", null).limit(10);
    const { data, error } = /^\d{8}$/.test(t) ? await q.eq("kvk", t) : await q.ilike("naam", `%${t.replace(/[%_,()]/g, " ")}%`);
    setBezig(false);
    if (error) { toast({ title: "Zoeken mislukt", description: error.message, variant: "destructive" }); return; }
    setResultaten(((data ?? []) as Ond[]).filter((o) => !ondernemingen.some((x) => x.id === o.id)));
  };

  const koppel = async (o: Ond) => {
    setBezig(true);
    const { data, error } = await supabase.rpc("persoon_onderneming_koppelen", { _persoon_id: persoonId, _onderneming_id: o.id });
    setBezig(false);
    if (error) { toast({ title: "Koppelen mislukt", description: error.message, variant: "destructive" }); return; }
    const n = (data as { polissen_gekoppeld?: number } | null)?.polissen_gekoppeld ?? 0;
    toast({ title: `Gekoppeld aan ${o.naam}`, description: n ? `${n} polis(sen) nu zichtbaar in Mijn ZP.` : undefined });
    setZoekOpen(false); setTerm(""); setResultaten([]); onGewijzigd();
  };

  const ontkoppelBevestig = async (o: Ond) => {
    setBezig(true);
    const { error } = await supabase.rpc("persoon_onderneming_ontkoppelen", { _persoon_id: persoonId, _onderneming_id: o.id, _reden: reden });
    setBezig(false);
    if (error) { toast({ title: "Ontkoppelen mislukt", description: error.message, variant: "destructive" }); return; }
    toast({ title: `Ontkoppeld van ${o.naam}` });
    setOntkoppel(null); setReden(""); onGewijzigd();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">Ondernemingen</CardTitle>
        <Button size="sm" variant="outline" onClick={() => setZoekOpen((v) => !v)}><Link2 className="mr-1 h-4 w-4" />Onderneming koppelen</Button>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {zoekOpen && (
          <div className="space-y-2 rounded-md border p-3">
            <div className="flex gap-2">
              <Input value={term} onChange={(e) => setTerm(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") zoek(); }} placeholder="Naam of KvK-nummer" aria-label="Zoek onderneming op naam of KvK-nummer" />
              <Button size="sm" onClick={zoek} disabled={bezig || term.trim().length < 2}>{bezig ? <Loader2 className="h-4 w-4 animate-spin" /> : "Zoeken"}</Button>
            </div>
            {resultaten.map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate">{o.naam} <span className="text-xs text-muted-foreground">{o.rechtsvorm ?? ""} {o.kvk ? `· KvK ${o.kvk}` : ""}</span></span>
                <Button size="sm" variant="secondary" disabled={bezig} onClick={() => koppel(o)}>Koppelen</Button>
              </div>
            ))}
          </div>
        )}
        {ondernemingen.length === 0 ? <p className="text-muted-foreground">Niet gekoppeld aan een onderneming.</p> : ondernemingen.map((o) => (
          <div key={o.id} className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Link to={`/admin/klanten/${o.id}`} className="min-w-0 truncate font-medium hover:text-primary">{o.naam} <span className="text-xs font-normal text-muted-foreground">{o.rechtsvorm ?? ""} {o.kvk ? `· KvK ${o.kvk}` : ""}</span></Link>
              <Button size="sm" variant="ghost" onClick={() => { setOntkoppel(ontkoppel === o.id ? null : o.id); setReden(""); }}><Unlink className="mr-1 h-4 w-4" />Ontkoppelen</Button>
            </div>
            {ontkoppel === o.id && (
              <div className="flex gap-2">
                <Input value={reden} onChange={(e) => setReden(e.target.value)} placeholder="Reden (verplicht)" aria-label="Reden voor ontkoppelen" />
                <Button size="sm" variant="destructive" disabled={bezig || reden.trim().length < 5} onClick={() => ontkoppelBevestig(o)}>Bevestigen</Button>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

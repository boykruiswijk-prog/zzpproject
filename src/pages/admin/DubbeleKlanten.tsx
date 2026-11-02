import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { formatDateNL } from "@/lib/dateFormat";
import { Copy, RotateCw } from "lucide-react";

export type DubbeleKaart = {
  id: string; naam: string | null; aangemaakt: string; bron: string | null; exact_relatie_code: string | null;
  actief_contract: boolean; contactpersonen: number; portaal: boolean; bav_nummers: string[];
};
export type DubbeleGroep = { kvk: string; kaarten: DubbeleKaart[] };

/** Gewone-taal fout uit de database. */
function foutTekst(e: any) {
  const m = String(e?.message ?? e ?? "");
  if (m.includes("geen toegang")) return "Je hebt geen rechten om klantkaarten samen te voegen (of je 2FA-sessie is verlopen).";
  return m || "Onbekende fout";
}

export default function DubbeleKlanten() {
  const { toast } = useToast();
  const [groepen, setGroepen] = useState<DubbeleGroep[] | null>(null);
  const [fout, setFout] = useState<string | null>(null);
  const [keuze, setKeuze] = useState<{ groep: DubbeleGroep; doel: DubbeleKaart } | null>(null);
  const [bezig, setBezig] = useState(false);

  const laad = useCallback(async () => {
    setFout(null);
    const { data, error } = await supabase.rpc("dubbele_klanten" as any);
    if (error) { setFout(foutTekst(error)); setGroepen([]); return; }
    setGroepen((data as unknown as DubbeleGroep[]) ?? []);
  }, []);
  useEffect(() => { laad(); }, [laad]);

  const samenvoegen = async () => {
    if (!keuze) return;
    setBezig(true);
    try {
      for (const k of keuze.groep.kaarten.filter((k) => k.id !== keuze.doel.id)) {
        const { error } = await supabase.rpc("onderneming_samenvoegen" as any, { _van: k.id, _naar: keuze.doel.id, _reden: "Dubbele klanten (zelfde KvK)" });
        if (error) throw error;
      }
      toast({ title: "Samengevoegd", description: `KvK ${keuze.groep.kvk} staat nu op één klantkaart.` });
      setKeuze(null);
      await laad();
    } catch (e) {
      toast({ title: "Samenvoegen lukte niet", description: foutTekst(e), variant: "destructive" });
    } finally { setBezig(false); }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold"><Copy className="h-6 w-6" />Dubbele klanten</h1>
            <p className="text-sm text-muted-foreground">Klantkaarten met hetzelfde KvK-nummer. Kies per KvK de kaart die blijft; de andere kaart wordt daarin samengevoegd. Er wordt niets verwijderd.</p>
          </div>
          <Button variant="outline" onClick={laad}><RotateCw className="mr-2 h-4 w-4" />Vernieuwen</Button>
        </div>
        {fout && <p className="text-sm text-destructive">{fout}</p>}
        {groepen === null ? <p className="text-sm text-muted-foreground">Laden...</p> :
          groepen.length === 0 ? <p className="text-sm text-muted-foreground">Geen dubbele klanten gevonden.</p> : <>
            <p className="text-sm font-medium">{groepen.length} KvK-nummers met meer dan één kaart</p>
            {groepen.map((g) => (
              <div key={g.kvk} className="rounded-lg border bg-card p-4">
                <p className="mb-3 font-semibold">KvK {g.kvk}</p>
                <div className="grid gap-3 md:grid-cols-2">
                  {g.kaarten.map((k) => (
                    <div key={k.id} className="space-y-2 rounded-md border p-3 text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <Link to={`/admin/klanten/${k.id}`} className="font-medium text-primary hover:underline">{k.naam || "(zonder naam)"}</Link>
                        <span className="text-xs text-muted-foreground">{formatDateNL(k.aangemaakt)}{k.bron ? ` · ${k.bron}` : ""}</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant={k.actief_contract ? "default" : "outline"}>{k.actief_contract ? "Actief contract" : "Geen actief contract"}</Badge>
                        <Badge variant={k.contactpersonen > 0 ? "secondary" : "outline"}>{k.contactpersonen > 0 ? `Contactpersoon (${k.contactpersonen})` : "Geen contactpersoon"}</Badge>
                        <Badge variant={k.portaal ? "secondary" : "outline"}>{k.portaal ? "Mijn ZP-toegang" : "Geen Mijn ZP"}</Badge>
                        <Badge variant={k.bav_nummers.length ? "secondary" : "outline"}>{k.bav_nummers.length ? `BAV ${k.bav_nummers.join(", ")}` : "Geen BAV-nummer"}</Badge>
                        <Badge variant={k.exact_relatie_code ? "secondary" : "outline"}>{k.exact_relatie_code ? `Exact ${k.exact_relatie_code}` : "Geen Exact-relatie"}</Badge>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => setKeuze({ groep: g, doel: k })}>Samenvoegen naar deze kaart</Button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>}
      </div>
      <AlertDialog open={!!keuze} onOpenChange={(o) => { if (!o && !bezig) setKeuze(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Klantkaarten samenvoegen?</AlertDialogTitle>
            <AlertDialogDescription>
              {keuze && <>De {keuze.groep.kaarten.length - 1 === 1 ? "andere kaart" : `${keuze.groep.kaarten.length - 1} andere kaarten`} met KvK {keuze.groep.kvk} {keuze.groep.kaarten.length - 1 === 1 ? "gaat" : "gaan"} op in "{keuze.doel.naam}" (aangemaakt {formatDateNL(keuze.doel.aangemaakt)}). Contactpersonen, BAV-nummers, polissen, contracten, notities, taken en logs gaan mee. Er wordt niets verwijderd, niets naar Exact gestuurd en niets naar de klant gemaild.</>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bezig}>Annuleren</AlertDialogCancel>
            <AlertDialogAction disabled={bezig} onClick={(e) => { e.preventDefault(); samenvoegen(); }}>{bezig ? "Bezig..." : "Samenvoegen"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}

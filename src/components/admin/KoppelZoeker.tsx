import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { zoekUniverseel } from "@/components/admin/UniverseleZoeker";

export type KoppelKandidaat = {
  onderneming_id: string; naam: string | null; exact_relatie_code: string | null; kvk: string | null;
  score: number; redenen: string[]; contactpersoon: string | null; email: string | null;
  bav_nummer: string | null; contract_status: string | null;
};

/**
 * Kandidatenlijst voor het koppelen van een melding aan een klant (RPC zoek_koppel_kandidaten).
 * Zoekt op Exact-relatiecode, BAV-nummer, KVK, e-mail(domein), bedrijfsnaam en contactpersoon.
 * Koppelen gaat alleen via de bestaande RPC koppel_opzegging, en alleen als `kanKoppelen`.
 */
export function KoppelZoeker({ aanvraagId, kanKoppelen, onGekoppeld, onKoppel, gekoppeldId, extBezig }: { aanvraagId: string; kanKoppelen: boolean; onGekoppeld?: () => void; onKoppel?: (ondId: string) => void; gekoppeldId?: string | null; extBezig?: boolean }) {
  const { toast } = useToast();
  const [zoek, setZoek] = useState("");
  const [lijst, setLijst] = useState<KoppelKandidaat[]>([]);
  const [laden, setLaden] = useState(false);
  const [bezig, setBezig] = useState<string | null>(null);

  useEffect(() => {
    let weg = false;
    const t = setTimeout(async () => {
      setLaden(true);
      const term = zoek.trim();
      const [{ data, error }, uni] = await Promise.all([
        (supabase.rpc as any)("zoek_koppel_kandidaten", { _aanvraag_id: aanvraagId, _zoek: zoek || null }),
        // Universele zoekfunctie vult aan met o.a. IBAN, telefoon, postcode en plaats (alleen bij een eigen zoekterm).
        term.length >= 2 ? zoekUniverseel(term).catch(() => null) : Promise.resolve(null),
      ]);
      if (weg) return;
      setLaden(false);
      if (error) return toast({ title: "Zoeken mislukt", description: error.message, variant: "destructive" });
      const basis = ((data ?? []) as KoppelKandidaat[]).map((k) => ({ ...k, redenen: [...k.redenen] }));
      for (const u of uni?.klanten ?? []) {
        const b = basis.find((k) => k.onderneming_id === u.id);
        if (b) { b.score = Math.max(b.score, u.score); b.redenen = Array.from(new Set([...b.redenen, ...u.redenen])); }
        else basis.push({ onderneming_id: u.id, naam: u.titel, exact_relatie_code: u.exact_relatie_code ?? null, kvk: u.kvk ?? null, score: u.score,
          redenen: u.redenen, contactpersoon: u.contactpersoon ?? null, email: u.email ?? null, bav_nummer: u.bav_nummer ?? null, contract_status: null });
      }
      basis.sort((a, b) => b.score - a.score);
      setLijst(basis.slice(0, 12));
    }, 300);
    return () => { weg = true; clearTimeout(t); };
  }, [aanvraagId, zoek]);

  async function koppel(k: KoppelKandidaat) {
    if (onKoppel) return onKoppel(k.onderneming_id);
    setBezig(k.onderneming_id);
    const { error } = await supabase.rpc("koppel_opzegging", { _aanvraag_id: aanvraagId, _onderneming_id: k.onderneming_id });
    setBezig(null);
    if (error) return toast({ title: "Koppelen mislukt", description: error.message, variant: "destructive" });
    toast({ title: "Gekoppeld", description: k.naam ?? undefined });
    onGekoppeld?.();
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="min-h-10 pl-8" value={zoek} onChange={(e) => setZoek(e.target.value)} aria-label="Zoek klant om te koppelen"
          placeholder="Exact-relatiecode, BAV-nummer, KVK, e-mail, domein of naam" />
      </div>
      <p className="text-xs text-muted-foreground">Zonder zoekterm worden de gegevens uit de melding gebruikt. Best passende klant bovenaan.</p>
      {laden ? <div className="flex justify-center p-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
        : lijst.length === 0 ? <p className="text-sm text-muted-foreground">Geen kandidaten gevonden.</p> : (
        <ul className="space-y-2">
          {lijst.map((k, i) => (
            <li key={k.onderneming_id} className="min-w-0 rounded-md border border-border p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link to={`/admin/klanten/${k.onderneming_id}`} className="font-medium hover:text-primary">{k.naam ?? "Onbekend"}</Link>
                    {i === 0 && <Badge variant="secondary">Beste match</Badge>}
                    <Badge variant="outline" className="tabular-nums">{k.score}</Badge>
                  </div>
                  <p className="break-words text-xs text-muted-foreground">
                    {[k.contactpersoon, k.email].filter(Boolean).join(" · ") || "Geen contactgegevens"}
                  </p>
                  <p className="break-words text-xs">
                    <span className="text-muted-foreground">Exact-relatiecode </span><span className="font-medium tabular-nums">{k.exact_relatie_code ?? "onbekend"}</span>
                    <span className="text-muted-foreground"> · BAV-nummer </span><span className="font-medium tabular-nums">{k.bav_nummer ?? "onbekend"}</span>
                    {k.kvk && <><span className="text-muted-foreground"> · KVK </span><span className="tabular-nums">{k.kvk}</span></>}
                    <span className="text-muted-foreground"> · contract </span>{k.contract_status ?? "geen"}
                  </p>
                  <ul className="list-disc pl-4 text-xs text-muted-foreground">{k.redenen.map((r) => <li key={r}>{r}</li>)}</ul>
                </div>
                {gekoppeldId === k.onderneming_id ? <Badge variant="secondary">Gekoppeld</Badge> : kanKoppelen && <Button size="sm" className="min-h-9" disabled={!!bezig || extBezig} onClick={() => koppel(k)}>{bezig === k.onderneming_id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Koppelen"}</Button>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { branches } from "@/data/documentenLijst";
import { formatDateNL } from "@/lib/dateFormat";

type Soort = "certificaat" | "factuur" | "verzekeringskaart";
const KAARTEN = Array.from(new Map(branches.flatMap((b: any) => (b.documenten ?? b.docs ?? []).filter((d: any) => d.type === "verzekeringskaart").map((d: any) => [d.path, { path: d.path as string, titel: `${b.naam ?? b.titel ?? ""} ${d.productCode ?? ""}`.trim() }]))).values());

async function roep(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("klant-document-versturen", { body });
  if (error) { let d: any = null; try { d = await (error as any).context?.json?.(); } catch { /* */ } throw new Error(d?.melding ?? d?.error ?? error.message); }
  return data;
}

/** Klantkaart: document naar klant versturen. Altijd eerst voorbeeld, verzenden alleen na eigen klik. */
export function DocumentVersturen({ ondernemingId, onVerstuurd }: { ondernemingId: string; onVerstuurd?: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [soort, setSoort] = useState<Soort | null>(null);
  const [laden, setLaden] = useState(false);
  const [lijst, setLijst] = useState<any>(null);
  const [keuze, setKeuze] = useState<{ invoice_id?: string; kaart_pad?: string; kaart_titel?: string } | null>(null);
  const [ontvanger, setOntvanger] = useState("");
  const [voorbeeld, setVoorbeeld] = useState<any>(null);
  const [afas, setAfas] = useState(false);
  const [periode, setPeriode] = useState("");

  const reset = () => { setSoort(null); setLijst(null); setKeuze(null); setVoorbeeld(null); setAfas(false); setPeriode(""); };
  const fout = (e: unknown) => toast({ title: "Niet gelukt", description: e instanceof Error ? e.message : String(e), variant: "destructive" });

  const kies = async (s: Soort) => {
    reset(); setSoort(s);
    if (s === "certificaat") return;
    setLaden(true);
    try { const d = await roep({ actie: "facturen", onderneming_id: ondernemingId }); setLijst(d); setOntvanger(d.adressen?.[0] ?? ""); } catch (e) { fout(e); } finally { setLaden(false); }
  };
  const toonVoorbeeld = async (k: typeof keuze) => {
    setKeuze(k); setLaden(true);
    try { setVoorbeeld(await roep({ actie: "voorbeeld", onderneming_id: ondernemingId, soort, ontvanger, ...k })); } catch (e) { fout(e); } finally { setLaden(false); }
  };
  const verstuur = async () => {
    setLaden(true);
    try { const d = await roep({ actie: "versturen", bevestigd: true, onderneming_id: ondernemingId, soort, ontvanger, ...keuze }); toast({ title: "Verstuurd", description: d.redirected ? "Testomgeving: omgeleid naar het testadres." : `Naar ${ontvanger}` }); onVerstuurd?.(); setOpen(false); reset(); } catch (e) { fout(e); } finally { setLaden(false); }
  };
  const meldAfas = async () => {
    setLaden(true);
    try { await roep({ actie: "afas_melding", onderneming_id: ondernemingId, periode }); toast({ title: "Taak voor Sandra aangemaakt" }); onVerstuurd?.(); setOpen(false); reset(); } catch (e) { fout(e); } finally { setLaden(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild><Button size="sm" variant="outline"><Send className="mr-1 h-4 w-4" />Document versturen naar klant</Button></DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>Document versturen naar klant</DialogTitle></DialogHeader>
        <div className="flex flex-wrap gap-2">
          {(["certificaat", "factuur", "verzekeringskaart"] as Soort[]).map((s) => <Button key={s} size="sm" variant={soort === s ? "default" : "outline"} onClick={() => kies(s)}>{s === "certificaat" ? "Verzekeringscertificaat" : s === "factuur" ? "Factuur" : "Verzekeringskaart"}</Button>)}
        </div>
        {laden && <Loader2 className="h-4 w-4 animate-spin" />}
        {soort === "certificaat" && <p className="text-sm">Gebruik de bestaande certificaatflow op deze pagina (blok Verzekeringscertificaat): daar maak je het certificaat en mail je het naar de klant. <Button size="sm" variant="link" onClick={() => { setOpen(false); document.getElementById("klant-certificaat")?.scrollIntoView({ behavior: "smooth" }); }}>Ga naar certificaat</Button></p>}
        {lijst && soort !== "certificaat" && (
          <div className="space-y-3 text-sm">
            <div><Label>Naar e-mailadres (bij ons bekend)</Label>
              {lijst.adressen?.length ? <select className="mt-1 w-full rounded border border-border bg-background p-2" value={ontvanger} onChange={(e) => { setOntvanger(e.target.value); setVoorbeeld(null); }}>{lijst.adressen.map((a: string) => <option key={a}>{a}</option>)}</select> : <p className="text-destructive">Geen e-mailadres bekend bij deze klant.</p>}
            </div>
            {soort === "factuur" && (<>
              <p className="text-muted-foreground">Facturen in Exact voor relatiecode {lijst.relatiecode ?? "-"} (alleen lezen):</p>
              {lijst.facturen?.length ? lijst.facturen.map((f: any) => (
                <div key={f.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-border p-2">
                  <span>{f.soort === "creditnota" ? "Creditnota" : "Factuur"} {f.nummer} · {formatDateNL(f.datum)}{f.periode_start ? ` · periode ${formatDateNL(f.periode_start)} t/m ${formatDateNL(f.periode_eind)}` : ""} · EUR {f.bedrag.toFixed(2)}</span>
                  <Button size="sm" variant="outline" disabled={!ontvanger} onClick={() => toonVoorbeeld({ invoice_id: f.id })}>Voorbeeld</Button>
                </div>)) : <p>Geen facturen in Exact gevonden.</p>}
              <Button size="sm" variant="link" className="px-0" onClick={() => setAfas(!afas)}>Gevraagde factuur staat er niet bij?</Button>
              {afas && <div className="space-y-2 rounded border border-amber-300 p-3">
                <p>Deze factuur staat in het oude systeem (AFAS). Vraag Sandra om de pdf.</p>
                <Label>Gevraagde periode</Label><Input value={periode} onChange={(e) => setPeriode(e.target.value)} placeholder="bijvoorbeeld september 2026" />
                <Button size="sm" disabled={periode.trim().length < 3 || laden} onClick={meldAfas}>Taak en melding voor Sandra aanmaken</Button>
              </div>}
            </>)}
            {soort === "verzekeringskaart" && KAARTEN.map((k) => (
              <div key={k.path} className="flex flex-wrap items-center justify-between gap-2 rounded border border-border p-2">
                <a href={k.path} target="_blank" rel="noreferrer" className="text-primary hover:underline">{k.titel || k.path.split("/").pop()}</a>
                <Button size="sm" variant="outline" disabled={!ontvanger} onClick={() => toonVoorbeeld({ kaart_pad: k.path, kaart_titel: k.titel })}>Voorbeeld</Button>
              </div>))}
          </div>)}
        {voorbeeld && (
          <div className="space-y-2 rounded border border-primary/40 p-3 text-sm">
            <p className="font-medium">Voorbeeld (nog niet verstuurd)</p>
            <p>Aan: {voorbeeld.aan}<br />Onderwerp: {voorbeeld.onderwerp}<br />Bijlage: {voorbeeld.bijlage?.naam} ({voorbeeld.bijlage?.kb} kB)</p>
            <div className="rounded bg-muted/50 p-2" dangerouslySetInnerHTML={{ __html: voorbeeld.html }} />
            <Button onClick={verstuur} disabled={laden}>Versturen</Button>
          </div>)}
      </DialogContent>
    </Dialog>
  );
}

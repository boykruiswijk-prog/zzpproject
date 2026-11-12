import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { INGEKLAPT_VANAF, zichtbareReacties } from "@/lib/notitieDraad";

/** Knop "Reageren" die een klein tekstveld opent; Enter of "Plaatsen" plaatst de reactie. */
export function ReactieInvoer({ onPlaatsen }: { onPlaatsen: (tekst: string) => Promise<boolean> }) {
  const [open, setOpen] = useState(false);
  const [tekst, setTekst] = useState("");
  const [bezig, setBezig] = useState(false);
  async function plaats() {
    if (!tekst.trim() || bezig) return;
    setBezig(true);
    const ok = await onPlaatsen(tekst.trim());
    setBezig(false);
    if (ok) { setTekst(""); setOpen(false); }
  }
  if (!open) return <button type="button" className="text-xs text-muted-foreground hover:text-primary" onClick={() => setOpen(true)}>Reageren</button>;
  return (
    <div className="mt-2 flex items-center gap-2">
      <Input autoFocus value={tekst} onChange={(e) => setTekst(e.target.value)} aria-label="Reactie" placeholder="Schrijf een reactie" className="h-8 text-sm"
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); plaats(); } if (e.key === "Escape") setOpen(false); }} />
      <Button size="sm" className="h-8" onClick={plaats} disabled={bezig || !tekst.trim()}>{bezig && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}Plaatsen</Button>
    </div>
  );
}

/** Ingesprongen reacties; bij meer dan 2 ingeklapt met "N reacties tonen". */
export function ReactieLijst<T>({ reacties, render }: { reacties: T[]; render: (r: T) => ReactNode }) {
  const [uit, setUit] = useState(false);
  if (reacties.length === 0) return null;
  const zichtbaar = zichtbareReacties(reacties, uit);
  return (
    <div className="mt-2 space-y-2 border-l-2 border-border pl-3 ml-2">
      {zichtbaar.map(render)}
      {reacties.length >= INGEKLAPT_VANAF && (
        <button type="button" className="text-xs text-muted-foreground hover:text-primary" onClick={() => setUit(!uit)}>
          {uit ? "Reacties verbergen" : `${reacties.length} reacties tonen`}
        </button>
      )}
    </div>
  );
}

export function FilterKeuze({ waarde, onChange }: { waarde: "alles" | "handgeschreven"; onChange: (v: "alles" | "handgeschreven") => void }) {
  return (
    <div className="inline-flex rounded-md border border-border p-0.5 text-xs" role="group" aria-label="Notities filteren">
      {(["alles", "handgeschreven"] as const).map((v) => (
        <button key={v} type="button" aria-pressed={waarde === v} onClick={() => onChange(v)}
          className={`rounded px-2 py-1 ${waarde === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
          {v === "alles" ? "Alles" : "Alleen handgeschreven"}
        </button>
      ))}
    </div>
  );
}

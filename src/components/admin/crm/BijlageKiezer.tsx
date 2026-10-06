import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Paperclip, X } from "lucide-react";
import { bestandenUitTransfer, controleerBijlage } from "@/lib/crmBijlagen";
import { toast } from "sonner";

/** Kiezen, slepen of plakken van bijlagen. Plakken wordt door de ouder (onPaste op tekstveld) doorgegeven via voegToe. */
export function BijlageKiezer({ bestanden, onChange }: { bestanden: File[]; onChange: (f: File[]) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const voegToe = (nieuw: File[]) => {
    const goed: File[] = [];
    for (const f of nieuw) { const fout = controleerBijlage(f); if (fout) toast.error(fout); else goed.push(f); }
    if (goed.length) onChange([...bestanden, ...goed]);
  };
  return (
    <div
      className="rounded-md border border-dashed border-border p-2 text-sm"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); voegToe(bestandenUitTransfer(e.dataTransfer)); }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => ref.current?.click()}><Paperclip className="mr-1 h-4 w-4" /> Bijlage</Button>
        <span className="text-xs text-muted-foreground">Sleep hierheen of plak een schermafbeelding (Ctrl/Cmd+V). Afbeelding of pdf, max 10 MB.</span>
        <input ref={ref} type="file" multiple accept="image/png,image/jpeg,image/webp,image/heic,image/heif,.heic,.heif,application/pdf" className="hidden"
          onChange={(e) => { voegToe(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
      </div>
      {bestanden.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {bestanden.map((f, i) => (
            <div key={i} className="relative flex items-center gap-2 rounded border border-border bg-muted/40 p-1 pr-6">
              {f.type.startsWith("image/") && !/heic|heif/.test(f.type)
                ? <img src={URL.createObjectURL(f)} alt="" className="h-10 w-10 rounded object-cover" />
                : <FileText className="h-6 w-6 text-muted-foreground" />}
              <span className="max-w-[10rem] truncate text-xs">{f.name}</span>
              <button type="button" aria-label="Bijlage weghalen" className="absolute right-1 top-1 text-muted-foreground hover:text-foreground"
                onClick={() => onChange(bestanden.filter((_, j) => j !== i))}><X className="h-3 w-3" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function plakBestanden(e: React.ClipboardEvent, bestanden: File[], onChange: (f: File[]) => void) {
  const nieuw = bestandenUitTransfer(e.clipboardData);
  if (!nieuw.length) return;
  e.preventDefault();
  const goed = nieuw.filter((f) => { const fout = controleerBijlage(f); if (fout) toast.error(fout); return !fout; });
  if (goed.length) onChange([...bestanden, ...goed]);
}

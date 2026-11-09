import { useEffect, useState } from "react";
import { Download, ExternalLink, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

/** Haalt een PDF via de ingelogde client op als blob en toont die zelf. Een ondertekende
 *  URL van een ander domein in een iframe wordt door de CSP geblokkeerd. */
export async function laadPdfBlob(bucket: string, pad: string): Promise<Blob> {
  const r = await supabase.storage.from(bucket).download(pad);
  if (r.error || !r.data) throw new Error("PDF kon niet worden opgehaald");
  return r.data.type === "application/pdf" ? r.data : new Blob([r.data], { type: "application/pdf" });
}

export function PdfWeergave({ bucket, pad, titel, bestandsnaam }: { bucket: string; pad: string; titel: string; bestandsnaam?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [fout, setFout] = useState("");
  useEffect(() => {
    let weg = false; let gemaakt: string | null = null;
    setUrl(null); setFout("");
    laadPdfBlob(bucket, pad).then(b => { if (weg) return; gemaakt = URL.createObjectURL(b); setUrl(gemaakt); })
      .catch(e => { if (!weg) setFout(e instanceof Error ? e.message : "PDF kon niet worden opgehaald"); });
    return () => { weg = true; if (gemaakt) URL.revokeObjectURL(gemaakt); };
  }, [bucket, pad]);
  if (fout) return <p role="alert" className="text-sm text-destructive">{fout}</p>;
  if (!url) return <Loader2 aria-label="PDF laden" className="h-4 w-4 animate-spin" />;
  const naam = bestandsnaam ?? pad.split("/").pop() ?? "certificaat.pdf";
  return <div className="space-y-2">
    <div className="flex flex-wrap gap-2">
      <Button asChild variant="outline" size="sm"><a href={url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" />Openen in nieuw tabblad</a></Button>
      <Button asChild variant="outline" size="sm"><a href={url} download={naam}><Download className="h-4 w-4" />Downloaden</a></Button>
    </div>
    <iframe title={titel} src={url} className="h-[55vh] w-full border border-border" />
  </div>;
}

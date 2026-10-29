import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { AOV_IFRAME_TEKST, AOV_REKENTOOL_URL } from "@/config/aovPagina";
import { aovLink } from "@/lib/aovDoorverwijzing";
import { ExternalLink } from "lucide-react";

export function AovRekentool({ referentie }: { referentie: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [hoogte, setHoogte] = useState(1000);
  useEffect(() => {
    const ontvangen = (event: MessageEvent) => {
      if (event.origin !== new URL(AOV_REKENTOOL_URL).origin || event.source !== frame.current?.contentWindow) return;
      const waarde = event.data && typeof event.data === "object" ? event.data.height : undefined;
      if (typeof waarde === "number" && Number.isFinite(waarde) && waarde >= 300 && waarde <= 10000) setHoogte(Math.ceil(waarde));
    };
    window.addEventListener("message", ontvangen);
    return () => window.removeEventListener("message", ontvangen);
  }, []);
  const url = aovLink("rekentool", referentie);
  return (
    <div className="space-y-5">
      <p role="status" className="font-semibold">Je aanmelding staat bij ZP Zaken.</p>
      <p className="text-base leading-relaxed">{AOV_IFRAME_TEKST}</p>
      <iframe ref={frame} src={url} title="Rekentool en aanvraag van onze externe adviseur" height={hoogte} className="w-full min-h-[900px] border-0" referrerPolicy="strict-origin-when-cross-origin" />
      <Button variant="outline" asChild className="h-auto min-h-12 whitespace-normal">
        <a href={url} target="_blank" rel="noopener noreferrer">Open de rekentool in een nieuw tabblad <ExternalLink className="h-4 w-4 shrink-0" /></a>
      </Button>
    </div>
  );
}
import type { BavKeuze } from "@/lib/bavNummer";

/** Toont "BAV-nummer X (bron)" en eventueel de Hiscox-polis. */
export function BavNummer({ keuze, compact = false }: { keuze: BavKeuze; compact?: boolean }) {
  if (!keuze) return <span className="text-xs text-muted-foreground">BAV-nummer onbekend</span>;
  return (
    <span className="inline-flex min-w-0 flex-wrap items-baseline gap-x-2 text-xs">
      {keuze.nummer ? (
        <span className="min-w-0">
          {!compact && <span className="text-muted-foreground">BAV-nummer </span>}
          <span className="font-medium tabular-nums text-foreground">{keuze.nummer}</span>
          <span className="ml-1 text-[10px] text-muted-foreground">{keuze.bron}</span>
        </span>
      ) : <span className="text-muted-foreground">BAV-nummer onbekend</span>}
      {!compact && keuze.opgave && keuze.opgave !== keuze.nummer && (
        <span className="min-w-0"><span className="text-muted-foreground">Opgegeven door klant (niet bevestigd) </span><span className="tabular-nums text-foreground">{keuze.opgave}</span></span>
      )}
      {keuze.afas.length > 0 && (
        <span className="min-w-0"><span className="text-muted-foreground">{compact ? "AFAS-abon. (oud) " : "AFAS-abonnementsnummer (oud systeem) "}</span><span className="tabular-nums text-foreground">{keuze.afas.join(", ")}</span></span>
      )}
      {keuze.hiscox && (
        <span className="min-w-0"><span className="text-muted-foreground">Hiscox-polis </span><span className="font-medium tabular-nums text-foreground">{keuze.hiscox}</span></span>
      )}
    </span>
  );
}

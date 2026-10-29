import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownUp, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { statusLabel } from "@/lib/statusLabels";
import { formatEuro } from "@/lib/klantContracten";
import { productNaam, type Doorklik, type GrafiekRecord } from "@/lib/grafiekDoorklik";

const datumTijd = (s: string | null) => s
  ? new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Amsterdam" }).format(new Date(s))
  : "";
const dagTekst = (d: string) => new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Amsterdam" }).format(new Date(`${d}T12:00:00Z`));

/** Zijpaneel met de records achter een aangeklikt grafiekelement. Gegevens alleen via RPC admin_grafiek_records. */
export function GrafiekLijst({ keuze, toonTest = false, onClose }: { keuze: Doorklik | null; toonTest?: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [oplopend, setOplopend] = useState(false);
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["grafiek-records", keuze?.grafiek, keuze?.sleutel, keuze?.van, keuze?.tot, toonTest],
    enabled: !!keuze,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_grafiek_records" as never, {
        _grafiek: keuze!.grafiek, _sleutel: keuze!.sleutel ?? null, _van: keuze!.van ?? null, _tot: keuze!.tot ?? null, _toon_test: toonTest,
      } as never);
      if (error) throw new Error((error as { message?: string }).message ?? "Onbekende fout");
      return (data ?? []) as unknown as GrafiekRecord[];
    },
  });
  const rijen = useMemo(() => {
    const r = [...(data ?? [])];
    r.sort((a, b) => { const x = `${a.dag}${a.binnengekomen ?? ""}`, y = `${b.dag}${b.binnengekomen ?? ""}`; return oplopend ? x.localeCompare(y) : y.localeCompare(x); });
    return r;
  }, [data, oplopend]);
  const isArr = keuze?.grafiek.startsWith("arr_");

  return (
    <Sheet open={!!keuze} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>{keuze?.titel}</SheetTitle>
          <SheetDescription>
            {isLoading ? "Laden..." : `${rijen.length.toLocaleString("nl-NL")} ${rijen.length === 1 ? "regel" : "regels"}, zelfde bron als de grafiek. Klik op een regel voor de detailpagina.`}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4">
          {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : isError ? <p role="alert" className="text-sm text-destructive">Kon niet laden: {(error as Error).message}</p> :
            rijen.length === 0 ? <p className="text-sm text-muted-foreground">Geen regels.</p> :
            <div className="overflow-x-auto"><table className="w-full text-sm" data-testid="grafiek-lijst">
              <thead className="text-left text-muted-foreground"><tr>
                <th className="py-2 pr-3 font-medium">{isArr ? "Klant" : "Naam"}</th>
                {!isArr && <th className="py-2 pr-3 font-medium">Bedrijf</th>}
                {!isArr && <th className="py-2 pr-3 font-medium">E-mail</th>}
                <th className="py-2 pr-3 font-medium">Product</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 pr-3 font-medium">
                  <button type="button" className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => setOplopend((v) => !v)} aria-label="Sorteer op datum">
                    {isArr ? "Datum" : "Binnengekomen"} <ArrowDownUp className="h-3 w-3" />
                  </button>
                </th>
                {isArr ? <th className="py-2 pr-3 font-medium text-right">ARR</th> : <><th className="py-2 pr-3 font-medium">Bron</th><th className="py-2 pr-3 font-medium">Behandelaar</th></>}
              </tr></thead>
              <tbody>{rijen.map((r, i) => (
                <tr key={`${r.id}-${i}`} className={`border-t border-border ${r.link ? "cursor-pointer hover:bg-muted/50" : ""}`}
                  onClick={() => r.link && navigate(r.link)} tabIndex={r.link ? 0 : -1} onKeyDown={(e) => e.key === "Enter" && r.link && navigate(r.link)}>
                  <td className="py-1.5 pr-3">{isArr ? (r.bedrijfsnaam ?? "Onbekend") : (r.naam ?? "")}</td>
                  {!isArr && <td className="py-1.5 pr-3">{r.bedrijfsnaam ?? ""}</td>}
                  {!isArr && <td className="py-1.5 pr-3 break-all">{r.email ?? ""}</td>}
                  <td className="py-1.5 pr-3">{productNaam(r.product)}</td>
                  <td className="py-1.5 pr-3">{r.status ? statusLabel(r.status) : ""}</td>
                  <td className="py-1.5 pr-3 tabular-nums whitespace-nowrap">{isArr || !r.binnengekomen ? dagTekst(r.dag) : datumTijd(r.binnengekomen)}</td>
                  {isArr ? <td className="py-1.5 pr-3 text-right tabular-nums">{formatEuro(Number(r.bedrag ?? 0))}</td>
                    : <><td className="py-1.5 pr-3">{r.bron ?? ""}</td><td className="py-1.5 pr-3">{r.behandelaar ?? ""}</td></>}
                </tr>
              ))}</tbody>
            </table></div>}
          <Button variant="outline" size="sm" className="mt-4" onClick={onClose}>Sluiten</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Tooltip met hint dat het element aanklikbaar is. */
export function KlikTooltip({ active, payload, label, labelFormatter, valueFormatter }: {
  active?: boolean; payload?: { name?: string; value?: number; payload?: Record<string, unknown> }[]; label?: string | number;
  labelFormatter?: (l: string) => string; valueFormatter?: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const titel = labelFormatter ? labelFormatter(String(label ?? payload[0].name ?? "")) : String(label ?? payload[0].name ?? "");
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <div className="font-medium">{titel}</div>
      {payload.map((p, i) => <div key={i} className="tabular-nums">{p.name}: {valueFormatter ? valueFormatter(Number(p.value)) : Number(p.value).toLocaleString("nl-NL")}</div>)}
      <div className="mt-1 text-muted-foreground">Klik voor de lijst</div>
    </div>
  );
}

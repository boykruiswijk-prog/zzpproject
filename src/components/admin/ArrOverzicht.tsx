import { useQuery } from "@tanstack/react-query";
import { LineChart, RefreshCw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatEuro } from "@/lib/klantContracten";

type ArrData = {
  arr_totaal: number; aantal_klanten: number; aantal_contracten: number;
  arr_loopt_af: number; arr_cyber: number; aandeel_cyber_pct: number;
  gemiddelde_arr_per_klant: number; netto_sinds_1_okt: number;
  maanden: { maand: string; nieuw: number; aflopend: number; netto: number }[];
};

const signedEuro = (n: number) => `${n > 0 ? "+" : ""}${formatEuro(n)}`;

export function ArrOverzicht() {
  const { isSupervisorOrAdmin, isAal2, user } = useAuth();
  const enabled = isSupervisorOrAdmin && isAal2;
  const { data, isError, isFetching, refetch } = useQuery({
    queryKey: ["arr-overzicht", user?.id],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("arr_overzicht");
      if (error) throw new Error(error.message);
      if (!data || typeof data !== "object") throw new Error("ARR ontbreekt");
      return data as unknown as ArrData;
    },
    refetchInterval: 60_000,
    retry: 1,
  });
  if (!enabled) return null;
  return (
    <Card className="min-w-0 sm:col-span-2" aria-label="ARR-overzicht">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">ARR</CardTitle>
        <LineChart className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="space-y-3">
        {isError ? <div role="alert" className="flex items-center justify-between gap-2 text-sm text-destructive">
          ARR kon niet worden geladen
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className="h-4 w-4" /> Opnieuw
          </Button>
        </div> : !data ? <div className="text-2xl font-bold">…</div> : <>
          <div className="break-words text-2xl font-bold tabular-nums">{formatEuro(data.arr_totaal)}</div>
          <div className="text-xs text-muted-foreground">
            <p>{data.aantal_klanten.toLocaleString("nl-NL")} klanten · {data.aantal_contracten.toLocaleString("nl-NL")} actieve contracten</p>
            <p className="font-medium text-foreground">{signedEuro(data.netto_sinds_1_okt)} netto sinds 1 oktober 2026</p>
            <p>Nieuw minus aflopend · huidige contractwaarden</p>
          </div>
          <dl className="grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
            <div><dt className="text-muted-foreground">Loopt af</dt><dd className="tabular-nums">{formatEuro(data.arr_loopt_af)}</dd></div>
            <div><dt className="text-muted-foreground">Cyber in actieve ARR</dt><dd className="tabular-nums">{formatEuro(data.arr_cyber)} ({data.aandeel_cyber_pct.toLocaleString("nl-NL")}%)</dd></div>
            <div><dt className="text-muted-foreground">Gemiddelde ARR per klant</dt><dd className="tabular-nums">{formatEuro(data.gemiddelde_arr_per_klant)}</dd></div>
          </dl>
          <table className="w-full table-fixed text-right text-[11px] tabular-nums sm:text-xs">
            <thead className="text-muted-foreground"><tr><th className="w-1/5 text-left font-medium">Maand</th><th className="font-medium">Nieuw</th><th className="font-medium">Aflopend</th><th className="font-medium">Netto</th></tr></thead>
            <tbody>{data.maanden.map(m => <tr key={m.maand} className="border-t border-border">
              <th className="py-1.5 text-left font-normal">{new Intl.DateTimeFormat("nl-NL", { month: "short", timeZone: "Europe/Amsterdam" }).format(new Date(`${m.maand}T12:00:00Z`))}</th>
              <td className="whitespace-nowrap">{formatEuro(m.nieuw)}</td><td className="whitespace-nowrap">{formatEuro(m.aflopend)}</td><td className="whitespace-nowrap">{signedEuro(m.netto)}</td>
            </tr>)}</tbody>
          </table>
        </>}
      </CardContent>
    </Card>
  );
}
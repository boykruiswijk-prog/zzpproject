import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { aovCsv, aovWeekTotalen, AovOverzichtRij } from "@/lib/aovDoorverwijzing";
import { formatDateTimeNL } from "@/lib/dateFormat";
import { Download, RefreshCw } from "lucide-react";

export default function AovDoorverwijzingen() {
  const { data = [], isLoading, error, refetch } = useQuery({ queryKey: ["aov-doorverwijzingen"], queryFn: async () => {
    // PostgREST-paginering voorkomt afgekapt weektotaal/export.
    const alles: AovOverzichtRij[] = [];
    for (let start = 0; ; start += 500) {
      const { data, error } = await supabase.rpc("aov_doorverwijzingen_overzicht").range(start, start + 499);
      if (error) throw error;
      const rijen = data ?? [];
      alles.push(...rijen);
      if (rijen.length < 500) break;
    }
    return alles;
  }});
  const exporteer = () => {
    const url = URL.createObjectURL(new Blob([aovCsv(data)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "aov-doorverwijzingen.csv"; a.click(); URL.revokeObjectURL(url);
  };
  return <AdminLayout><Helmet><title>AOV-doorverwijzingen | Beheer</title></Helmet>
    <div className="flex flex-wrap items-center justify-between gap-4 mb-6"><h1 className="text-2xl font-bold">AOV-doorverwijzingen</h1>
      <div className="flex gap-2"><Button variant="outline" size="icon" aria-label="Vernieuwen" title="Vernieuwen" onClick={() => void refetch()}><RefreshCw className="h-4 w-4" /></Button><Button variant="outline" onClick={exporteer} disabled={isLoading || !!error || !data.length}><Download className="h-4 w-4 mr-2" />CSV</Button></div></div>
    {error ? <p role="alert" className="text-destructive">Het overzicht kon niet worden geladen. Probeer opnieuw.</p> : isLoading ? <p>Laden...</p> : <>
      <h2 className="text-lg font-semibold mb-3">Totaal per week</h2><dl className="flex flex-wrap gap-x-8 gap-y-3 mb-8">{aovWeekTotalen(data).map(([week, aantal]) => <div key={week}><dt className="text-sm text-muted-foreground">Vanaf {week}</dt><dd className="text-xl font-semibold tabular-nums">{aantal}</dd></div>)}</dl>
      {!data.length ? <p className="text-muted-foreground">Nog geen doorverwijzingen.</p> : <Table><TableHeader><TableRow>{["Datum/tijd", "Doel", "Bron", "Klant", "Klik_id"].map(t => <TableHead key={t}>{t}</TableHead>)}</TableRow></TableHeader><TableBody>{data.map(r => <TableRow key={r.id}><TableCell className="whitespace-nowrap">{formatDateTimeNL(r.created_at)}</TableCell><TableCell>{r.doel}</TableCell><TableCell className="max-w-xs break-all">{r.bron}</TableCell><TableCell>{r.user_id ? <>{r.klant_naam || r.klant_ref || "Ingelogde klant"}{r.klant_naam && r.klant_ref && <div className="text-xs text-muted-foreground">{r.klant_ref}</div>}</> : "anoniem"}</TableCell><TableCell className="font-mono text-xs break-all">{r.klik_id}</TableCell></TableRow>)}</TableBody></Table>}
    </>}
  </AdminLayout>;
}
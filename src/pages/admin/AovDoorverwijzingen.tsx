import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { aovAanmeldCsv, aovKopieTekst, aovWeekTotalen, AovAanmeldOverzichtRij, AOV_STATUSSEN } from "@/lib/aovDoorverwijzing";
import { formatDateTimeNL } from "@/lib/dateFormat";
import { toast } from "@/hooks/use-toast";
import { Copy, Download, RefreshCw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

async function haalAlles<T>(rpc: "aov_aanmeldingen_overzicht" | "aov_doorverwijzingen_overzicht"): Promise<T[]> {
  // PostgREST-paginering voorkomt afgekapt weektotaal/export.
  const alles: T[] = [];
  for (let start = 0; ; start += 500) {
    const { data, error } = await supabase.rpc(rpc).range(start, start + 499);
    if (error) throw error;
    alles.push(...((data ?? []) as T[]));
    if ((data ?? []).length < 500) break;
  }
  return alles;
}

function StatusCel({ rij }: { rij: AovAanmeldOverzichtRij }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState(rij.status);
  const [notitie, setNotitie] = useState(rij.notitie ?? "");
  const [bezig, setBezig] = useState(false);
  const gewijzigd = status !== rij.status || notitie !== (rij.notitie ?? "");
  const opslaan = async () => {
    setBezig(true);
    const { error } = await supabase.rpc("aov_aanmelding_bijwerken", { p_id: rij.id, p_status: status, p_notitie: notitie });
    setBezig(false);
    if (error) { toast({ title: "Opslaan mislukt", description: "Log opnieuw in met je tweestapscode en probeer het opnieuw.", variant: "destructive" }); return; }
    toast({ title: "Opgeslagen" });
    void qc.invalidateQueries({ queryKey: ["aov-aanmeldingen"] });
  };
  return <div className="space-y-2 min-w-48">
    <Select value={status} onValueChange={setStatus}><SelectTrigger aria-label="Status"><SelectValue /></SelectTrigger>
      <SelectContent>{Object.entries(AOV_STATUSSEN).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select>
    <Textarea aria-label="Notitie" rows={2} maxLength={1000} value={notitie} onChange={e => setNotitie(e.target.value)} placeholder="Notitie" />
    {gewijzigd && <Button size="sm" onClick={() => void opslaan()} disabled={bezig}>Opslaan</Button>}
  </div>;
}

export default function AovDoorverwijzingen() {
  const { isAdmin } = useAuth();
  const aanmeldingen = useQuery({ queryKey: ["aov-aanmeldingen"], queryFn: () => haalAlles<AovAanmeldOverzichtRij>("aov_aanmeldingen_overzicht") });
  const kliks = useQuery({ queryKey: ["aov-doorverwijzingen"], queryFn: () => haalAlles<{ created_at: string }>("aov_doorverwijzingen_overzicht") });
  const data = aanmeldingen.data ?? [];
  const exporteer = () => {
    const url = URL.createObjectURL(new Blob([aovAanmeldCsv(data)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "aov-aanmeldingen.csv"; a.click(); URL.revokeObjectURL(url);
  };
  const kopieer = async (r: AovAanmeldOverzichtRij) => {
    try { await navigator.clipboard.writeText(aovKopieTekst(r)); toast({ title: "Gekopieerd voor Tjepkema" }); }
    catch { toast({ title: "Kopiëren lukte niet", variant: "destructive" }); }
  };
  const error = aanmeldingen.error || kliks.error;
  const isLoading = aanmeldingen.isLoading || kliks.isLoading;
  return <AdminLayout><Helmet><title>AOV-aanmeldingen | Beheer</title></Helmet>
    <div className="flex flex-wrap items-center justify-between gap-4 mb-6"><h1 className="text-2xl font-bold">AOV-aanmeldingen</h1>
      <div className="flex gap-2"><Button variant="outline" size="icon" aria-label="Vernieuwen" title="Vernieuwen" onClick={() => { void aanmeldingen.refetch(); void kliks.refetch(); }}><RefreshCw className="h-4 w-4" /></Button><Button variant="outline" onClick={exporteer} disabled={isLoading || !!error || !data.length}><Download className="h-4 w-4 mr-2" />CSV</Button></div></div>
    <p className="text-sm text-muted-foreground mb-6">Er gaan geen automatische mails uit. Geef aanmeldingen handmatig door met "Kopieer voor Tjepkema".</p>
    {error ? <p role="alert" className="text-destructive">Het overzicht kon niet worden geladen. Log opnieuw in met je tweestapscode en probeer opnieuw.</p> : isLoading ? <p>Laden...</p> : <>
      <div className="grid md:grid-cols-2 gap-8 mb-8">
        <div><h2 className="text-lg font-semibold mb-3">Aanmeldingen per week</h2><dl className="flex flex-wrap gap-x-8 gap-y-3">{aovWeekTotalen(data).map(([week, aantal]) => <div key={week}><dt className="text-sm text-muted-foreground">Vanaf {week}</dt><dd className="text-xl font-semibold tabular-nums">{aantal}</dd></div>)}</dl></div>
        <div><h2 className="text-lg font-semibold mb-3">Doorkliks per week</h2><dl className="flex flex-wrap gap-x-8 gap-y-3">{aovWeekTotalen(kliks.data ?? []).map(([week, aantal]) => <div key={week}><dt className="text-sm text-muted-foreground">Vanaf {week}</dt><dd className="text-xl font-semibold tabular-nums">{aantal}</dd></div>)}</dl></div>
      </div>
      {!data.length ? <p className="text-muted-foreground">Nog geen aanmeldingen.</p> : <Table><TableHeader><TableRow>{["Datum/tijd", "Naam", "E-mail", "Telefoon", "Doel", "Bron", "Bestaande klant", "Ref", "Status en notitie", ""].map(t => <TableHead key={t}>{t}</TableHead>)}</TableRow></TableHeader>
        <TableBody>{data.map(r => <TableRow key={r.id}>
          <TableCell className="whitespace-nowrap">{formatDateTimeNL(r.created_at)}</TableCell>
          <TableCell>{r.naam}</TableCell><TableCell className="break-all">{r.email}</TableCell><TableCell>{r.telefoon || "-"}</TableCell>
          <TableCell>{r.doel}</TableCell><TableCell className="max-w-xs break-all">{r.bron}</TableCell>
          <TableCell>{r.lead_id ? <a className="underline underline-offset-2" href={`/admin/leads/${r.lead_id}`}>Ja{r.lead_status ? ` (${r.lead_status})` : ""}</a> : "Nee"}</TableCell>
          <TableCell className="font-mono text-xs break-all">{r.id}</TableCell>
          <TableCell>{isAdmin ? <StatusCel rij={r} /> : AOV_STATUSSEN[r.status as keyof typeof AOV_STATUSSEN] ?? r.status}</TableCell>
          <TableCell><Button variant="outline" size="sm" onClick={() => void kopieer(r)}><Copy className="h-4 w-4 mr-2" />Kopieer voor Tjepkema</Button></TableCell>
        </TableRow>)}</TableBody></Table>}
    </>}
  </AdminLayout>;
}

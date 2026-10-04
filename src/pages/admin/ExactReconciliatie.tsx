import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { fetchAlle } from "@/lib/fetchAlle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw } from "lucide-react";
import { formatDateNL, formatDateTimeNL } from "@/lib/dateFormat";
import { formatEuro } from "@/lib/klantContracten";
import { useToast } from "@/hooks/use-toast";

export const KLASSE_LABEL: Record<string, string> = {
  match: "Match",
  prijsverschil: "Prijsverschil",
  cyclusverschil: "Cyclusverschil",
  datumverschil: "Datumverschil",
  alleen_crm: "Alleen in CRM",
  alleen_exact: "Alleen in Exact",
  exact_opgezegd_crm_actief: "Exact opgezegd, CRM actief",
  crm_opgezegd_exact_actief: "CRM opgezegd, Exact actief",
};
const KOPPEL_LABEL: Record<string, string> = { gekoppeld: "Gekoppeld", niet_gevonden: "Niet gevonden", dubbel: "Dubbel" };
const SYNC_STAPPEN = ["accounts", "artikelen", "abonnementen", "regels", "afleiden", "koppel"];

export default function ExactReconciliatie() {
  const { toast } = useToast();
  const [laden, setLaden] = useState(true);
  const [rijen, setRijen] = useState<any[]>([]);
  const [onds, setOnds] = useState<any[]>([]);
  const [laatste, setLaatste] = useState<any>(null);
  const [klasse, setKlasse] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);

  async function laad() {
    setLaden(true);
    const [r, o, l] = await Promise.all([
      fetchAlle((a, b) => supabase.from("exact_reconciliatie_v").select("*").range(a, b)),
      fetchAlle((a, b) => supabase.from("ondernemingen").select("id,naam,exact_relatie_code,exact_account_naam,exact_koppeling_status,exact_naam_gelijkenis").not("exact_relatie_code", "is", null).range(a, b)),
      supabase.from("exact_sync_log").select("created_at,status,payload,error_message").eq("trigger_type", "spiegel_sync").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    setRijen(r.data); setOnds(o.data); setLaatste(l.data); setLaden(false);
  }
  useEffect(() => { laad(); }, []);

  async function verversen() {
    setBezig(true);
    for (const stap of SYNC_STAPPEN) {
      const { data, error } = await supabase.functions.invoke("exact-spiegel-sync", { body: { stap } });
      if (error || !data?.success) { toast({ title: `Spiegel-sync gestopt bij "${stap}"`, description: "Bekijk het Exact-synclog.", variant: "destructive" }); break; }
    }
    setBezig(false); laad();
  }

  const tellingen = useMemo(() => {
    const t: Record<string, number> = {};
    for (const r of rijen) t[r.klasse] = (t[r.klasse] ?? 0) + 1;
    return t;
  }, [rijen]);
  const koppel = useMemo(() => {
    const t: Record<string, number> = { gekoppeld: 0, niet_gevonden: 0, dubbel: 0 };
    for (const o of onds) if (o.exact_koppeling_status) t[o.exact_koppeling_status]++;
    return t;
  }, [onds]);
  const naamverschil = onds.filter((o) => o.exact_naam_gelijkenis != null && o.exact_naam_gelijkenis < 0.6);
  const zichtbaar = klasse ? rijen.filter((r) => r.klasse === klasse) : rijen;

  return (
    <AdminLayout>
      <Helmet><title>Exact-reconciliatie | ZP Zaken beheer</title></Helmet>
      <div className="space-y-6 min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="break-words text-xl font-bold sm:text-2xl">Exact-reconciliatie</h1>
          <Button onClick={verversen} disabled={bezig} variant="outline">{bezig ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Spiegel verversen (alleen lezen)</Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Exact wordt hier alleen gelezen. "Exact-stand overnemen" gebeurt pas na een besluit en nooit automatisch.
          {laatste && <> Laatste sync: {formatDateTimeNL(laatste.created_at)} ({laatste.status === "success" ? `stap ${laatste.payload?.stap}` : `fout bij stap ${laatste.payload?.stap}`}).</>}
        </p>
        {laden ? <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin" /></div> : (
          <>
            <div className="grid gap-6 md:grid-cols-2">
              <Card><CardHeader><CardTitle className="text-base">Relaties koppelen</CardTitle></CardHeader><CardContent className="space-y-1 text-sm">
                {Object.entries(koppel).map(([k, n]) => <div key={k} className="flex justify-between"><span>{KOPPEL_LABEL[k]}</span><span className="tabular-nums">{n}</span></div>)}
                <div className="flex justify-between"><span>Naamverschil (ter info)</span><span className="tabular-nums">{naamverschil.length}</span></div>
              </CardContent></Card>
              <Card><CardHeader><CardTitle className="text-base">Contractregels per klasse</CardTitle></CardHeader><CardContent className="flex flex-wrap gap-2">
                <Button size="sm" variant={klasse === null ? "default" : "outline"} onClick={() => setKlasse(null)}>Alle ({rijen.length})</Button>
                {Object.keys(KLASSE_LABEL).map((k) => (
                  <Button key={k} size="sm" variant={klasse === k ? "default" : "outline"} onClick={() => setKlasse(k)}>{KLASSE_LABEL[k]} ({tellingen[k] ?? 0})</Button>
                ))}
              </CardContent></Card>
            </div>
            <Card><CardContent className="overflow-x-auto pt-6">
              <table className="w-full table-fixed text-sm min-w-[1100px]">
                <thead><tr className="text-left text-muted-foreground">
                  <th className="p-2 font-normal w-[20%]">Klant</th><th className="p-2 font-normal">Rij / artikel</th><th className="p-2 font-normal">Klasse</th>
                  <th className="p-2 text-right font-normal">CRM-bedrag</th><th className="p-2 text-right font-normal">Exact-bedrag</th>
                  <th className="p-2 font-normal">CRM gefactureerd t/m</th><th className="p-2 font-normal">Exact gefactureerd t/m</th><th className="p-2 font-normal">Exact-abonnement</th>
                </tr></thead>
                <tbody>{zichtbaar.slice(0, 500).map((r, i) => (
                  <tr key={(r.contract_id ?? r.regel_id) + i} className="border-t border-border">
                    <td className="p-2 min-w-0">{r.onderneming_id ? <Link to={`/admin/klanten/${r.onderneming_id}`} className="block truncate hover:text-primary" title={r.klant_naam}>{r.klant_naam || "—"}</Link> : <span className="truncate">{r.klant_naam || "—"}</span>}<div className="text-xs text-muted-foreground">{r.exact_relatie_code}</div></td>
                    <td className="p-2">{r.bron_rij ?? "—"} · {r.itemcode ?? "—"}</td>
                    <td className="p-2"><Badge variant={r.klasse === "match" ? "secondary" : "outline"} className="max-w-full" title={(r.verschillen ?? []).map((v: string) => KLASSE_LABEL[v] ?? v).join(", ")}><span className="truncate">{KLASSE_LABEL[r.klasse] ?? r.klasse}</span></Badge></td>
                    <td className="p-2 text-right tabular-nums">{r.crm_bedrag != null ? formatEuro(r.crm_bedrag) : "—"}</td>
                    <td className="p-2 text-right tabular-nums">{r.exact_bedrag != null ? formatEuro(r.exact_bedrag) : "—"}</td>
                    <td className="p-2 tabular-nums">{formatDateNL(r.crm_gefactureerd_tm) || "—"}</td>
                    <td className="p-2 tabular-nums">{formatDateNL(r.exact_invoiced_to) || "—"}{r.invoiced_to_bron === "afgeleid" && <span className="text-xs text-muted-foreground"> (afgeleid)</span>}</td>
                    <td className="p-2">{r.exact_nummer ?? "—"}</td>
                  </tr>))}</tbody>
              </table>
              {zichtbaar.length > 500 && <p className="mt-2 text-xs text-muted-foreground">Eerste 500 van {zichtbaar.length} regels; filter op klasse voor de rest.</p>}
            </CardContent></Card>
          </>
        )}
      </div>
    </AdminLayout>
  );
}

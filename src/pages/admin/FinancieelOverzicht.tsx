// Financieel overzicht (alleen supervisor/admin). Cijfers uit finance_overzicht en finance_aansluiting (een bron voor admin en agents).
// Exact wordt alleen gelezen door exact-finance-sync; deze pagina schrijft niets.
import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { formatDateNL } from "@/lib/dateFormat";

const vandaag = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Amsterdam" }).format(new Date());
const euro = (n: number | null | undefined) => `€ ${Number(n ?? 0).toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const maandNaam = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("nl-NL", { month: "long", year: "numeric", timeZone: "UTC" });

interface Regel { maand: string; onderneming_id: string | null; klant: string | null; gefactureerd: number; betaald: number; openstaand: number; gecrediteerd: number;
  incasso_mislukt: number; incasso_mislukt_bedrag: number; gestopt: number; geroyeerd: number }
interface Soort { soort: string; label: string; aantal: number; rijen: any[] }

export default function FinancieelOverzicht() {
  const { toast } = useToast();
  const [van, setVan] = useState("2026-01-01");
  const [tot, setTot] = useState(vandaag());
  const [bezig, setBezig] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const runs = useQuery({
    queryKey: ["finance-runs"],
    queryFn: async () => (await supabase.from("exact_finance_runs" as any).select("*").order("gestart_op", { ascending: false }).limit(1)).data?.[0] as any,
  });
  const overzicht = useQuery({
    queryKey: ["finance-overzicht", van, tot],
    queryFn: async () => { const { data, error } = await supabase.rpc("finance_overzicht" as any, { _van: van, _tot: tot }); if (error) throw error; return (data ?? []) as Regel[]; },
  });
  const aansluiting = useQuery({
    queryKey: ["finance-aansluiting", van, tot],
    queryFn: async () => { const { data, error } = await supabase.rpc("finance_aansluiting" as any, { _van: van, _tot: tot }); if (error) throw error; return (data ?? []) as Soort[]; },
  });

  async function verversen() {
    setBezig(true);
    const { data, error } = await supabase.functions.invoke("exact-finance-sync", { body: {} });
    setBezig(false);
    if (error || (data as any)?.error) return toast({ title: "Verversen mislukt", description: error?.message ?? String((data as any)?.error), variant: "destructive" });
    toast({ title: "Gegevens uit Exact opgehaald", description: `Status: ${(data as any)?.status}` });
    runs.refetch(); overzicht.refetch(); aansluiting.refetch();
  }

  const perMaand = new Map<string, Regel[]>();
  for (const r of overzicht.data ?? []) perMaand.set(r.maand, [...(perMaand.get(r.maand) ?? []), r]);
  const som = (rs: Regel[], k: keyof Regel) => rs.reduce((a, r) => a + Number(r[k] ?? 0), 0);
  const verschillen = (aansluiting.data ?? []).filter((s) => s.aantal > 0);
  const r = runs.data;

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Financieel overzicht</h1>
            <p className="text-sm text-muted-foreground">Exact wordt alleen gelezen. {r ? `Laatst opgehaald ${formatDateNL(r.gestart_op)} (${r.status}).` : "Nog niet opgehaald."}</p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div><Label htmlFor="fo-van">Van</Label><Input id="fo-van" type="date" value={van} onChange={(e) => setVan(e.target.value)} /></div>
            <div><Label htmlFor="fo-tot">Tot en met</Label><Input id="fo-tot" type="date" value={tot} onChange={(e) => setTot(e.target.value)} /></div>
            <Button onClick={verversen} disabled={bezig}>{bezig ? "Bezig..." : "Nu verversen"}</Button>
          </div>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Aansluiting planning, Exact en betalingen</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {aansluiting.isLoading && <p className="text-muted-foreground">Laden...</p>}
            {aansluiting.data && verschillen.length === 0 && <p>Alles sluit aan: geen verschillen in deze periode.</p>}
            {verschillen.map((s) => (
              <div key={s.soort} className="rounded-md border p-2">
                <button className="flex w-full items-center gap-2 text-left" onClick={() => setOpen(open === s.soort ? null : s.soort)}>
                  <Badge variant="destructive">{s.aantal}</Badge><span className="font-medium">{s.label}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{open === s.soort ? "Verbergen" : "Tonen"}</span>
                </button>
                {open === s.soort && <ul className="mt-2 space-y-1">
                  {s.rijen.map((x, i) => (
                    <li key={i} className="flex flex-wrap gap-2">
                      {x.onderneming_id ? <Link className="text-primary hover:underline" to={`/admin/klanten/${x.onderneming_id}`}>{x.klant ?? "Klant"}</Link> : <span>Relatie {x.relatiecode ?? "onbekend"}</span>}
                      {x.factuurnummer && <span>factuur {x.factuurnummer}</span>}
                      {x.bedrag != null && <span>{euro(x.bedrag)}</span>}
                      {x.planning != null && <span>planning {euro(x.planning)} / Exact {euro(x.exact)}</span>}
                      {x.vervaldatum && <span>vervallen {formatDateNL(x.vervaldatum)}</span>}
                      {x.periode_start && <span>periode {formatDateNL(x.periode_start)}</span>}
                      {x.reden && <span className="text-muted-foreground">{x.reden}</span>}
                      {x.aantal_posten && <span className="text-muted-foreground">{x.aantal_posten} posten</span>}
                    </li>))}
                </ul>}
              </div>))}
          </CardContent>
        </Card>

        {[...perMaand.entries()].map(([maand, rs]) => (
          <Card key={maand}>
            <CardHeader><CardTitle className="text-base capitalize">{maandNaam(maand)}</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto text-sm">
              <table className="w-full min-w-[900px]">
                <thead className="text-left text-muted-foreground"><tr>
                  <th className="py-1 pr-2">Klant</th><th className="pr-2">Gefactureerd</th><th className="pr-2">Betaald</th><th className="pr-2">Openstaand</th>
                  <th className="pr-2">Gecrediteerd</th><th className="pr-2">Incasso mislukt</th><th className="pr-2">Gestopt</th><th>Geroyeerd</th></tr></thead>
                <tbody>
                  <tr className="border-t font-medium"><td className="py-1 pr-2">Totaal ({rs.length})</td><td>{euro(som(rs, "gefactureerd"))}</td><td>{euro(som(rs, "betaald"))}</td>
                    <td>{euro(som(rs, "openstaand"))}</td><td>{euro(som(rs, "gecrediteerd"))}</td><td>{som(rs, "incasso_mislukt")}</td><td>{som(rs, "gestopt")}</td><td>{som(rs, "geroyeerd")}</td></tr>
                  {rs.map((x, i) => (
                    <tr key={`${x.onderneming_id}-${i}`} className="border-t">
                      <td className="py-1 pr-2">{x.onderneming_id ? <Link className="text-primary hover:underline" to={`/admin/klanten/${x.onderneming_id}`}>{x.klant ?? "Klant"}</Link> : <span className="text-muted-foreground">Niet gekoppeld</span>}</td>
                      <td>{euro(x.gefactureerd)}</td><td>{euro(x.betaald)}</td><td>{euro(x.openstaand)}</td><td>{euro(x.gecrediteerd)}</td>
                      <td>{x.incasso_mislukt ? `${x.incasso_mislukt} (${euro(x.incasso_mislukt_bedrag)})` : "-"}</td><td>{x.gestopt || "-"}</td><td>{x.geroyeerd || "-"}</td>
                    </tr>))}
                </tbody>
              </table>
            </CardContent>
          </Card>))}
        {overzicht.data && perMaand.size === 0 && <p className="text-sm text-muted-foreground">Geen gegevens in deze periode.</p>}
      </div>
    </AdminLayout>
  );
}

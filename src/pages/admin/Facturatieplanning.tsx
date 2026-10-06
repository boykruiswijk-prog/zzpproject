import { useToonTestrecords } from "@/hooks/useToonTestrecords";
import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Play } from "lucide-react";
import { formatDateNL, formatDateTimeNL } from "@/lib/dateFormat";
import { formatEuro } from "@/lib/klantContracten";
import { useToast } from "@/hooks/use-toast";

type Kandidaat = {
  klant_contract_id: string; relatiecode: string | null; klantnaam: string | null; itemcode: string; cyclus: string;
  periode_start: string; periode_eind: string; bedrag: number; achterstallig: boolean;
  blokkade: string | null; blokkade_soort: string | null;
};
const PLANNING_LABEL: Record<string, string> = {
  geclaimd: "Geclaimd (wacht op controle)", concept_aangemaakt: "Gefactureerd, wacht op verwerking", verwerkt: "Verwerkt",
  verwijderd_in_exact: "Verwijderd in Exact", te_laat: "Na 5 werkdagen niet verwerkt", fout: "Fout", vervangen: "Vervangen",
};

const CREDIT_LABEL: Record<string, string> = {
  te_maken: "Klaar om te maken", concept_niet_verwerkt: "Wacht: factuur nog concept", geen_planner_factuur: "Handmatig beoordelen",
  geclaimd: "Bezig", concept_aangemaakt: "Concept in Exact", verwerkt: "Verwerkt", verwijderd_in_exact: "Verwijderd in Exact", te_laat: "Te laat verwerkt", fout: "Fout",
};
const vandaagIso = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Amsterdam" }).format(new Date());

export default function Facturatieplanning() {
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const { toast } = useToast();
  const [van, setVan] = useState("2026-10-13");
  const [tot, setTot] = useState("2026-10-31");
  const [rijen, setRijen] = useState<Kandidaat[]>([]);
  const [laden, setLaden] = useState(false);
  const [cfg, setCfg] = useState<{ facturatie_actief: boolean; sleutel_veld: string } | null>(null);
  const [mapping, setMapping] = useState<any[]>([]);
  const [meldingen, setMeldingen] = useState<any[]>([]);
  const [runs, setRuns] = useState<any[]>([]);
  const [creditLijst, setCreditLijst] = useState<any[]>([]);
  const { toonTest } = useToonTestrecords();

  async function laadVast() {
    const [c, m, p, r] = await Promise.all([
      supabase.from("facturatie_config").select("facturatie_actief,sleutel_veld").eq("id", 1).maybeSingle(),
      supabase.from("factuur_artikel_mapping").select("*").order("itemcode_patroon"),
      supabase.from("factuur_planning").select("*").in("status", ["geclaimd", "concept_aangemaakt", "verwijderd_in_exact", "te_laat", "fout"]).order("periode_start"),
      supabase.from("factuur_planner_runs").select("*").order("gestart_op", { ascending: false }).limit(5),
    ]);
    setCfg(c.data as any); setMapping(m.data ?? []); setMeldingen(p.data ?? []); setRuns(r.data ?? []);
    const { data: cr } = await supabase.from("factuur_credit_planning").select("*").order("aangemaakt_op", { ascending: false });
    setCreditLijst(cr ?? []);
  }
  async function proefrun() {
    setLaden(true);
    const { data, error } = await supabase.rpc("facturatie_kandidaten", { _van: van, _tot: tot });
    setLaden(false);
    if (error) { toast({ title: "Proefrun mislukt", description: error.message, variant: "destructive" }); return; }
    setRijen((data ?? []) as Kandidaat[]);
  }
  useEffect(() => { laadVast(); proefrun(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sam = useMemo(() => {
    const som = (a: Kandidaat[]) => a.reduce((s, r) => s + Number(r.bedrag), 0);
    const klaar = rijen.filter((r) => !r.blokkade);
    const perMaand: Record<string, { n: number; b: number }> = {};
    const perJaar: Record<string, { n: number; b: number }> = {};
    const perDag: Record<string, Kandidaat[]> = {};
    for (const r of rijen) {
      const m = r.periode_start.slice(0, 7), j = r.periode_start.slice(0, 4);
      (perMaand[m] ??= { n: 0, b: 0 }).n++; perMaand[m].b += Number(r.bedrag);
      (perJaar[j] ??= { n: 0, b: 0 }).n++; perJaar[j].b += Number(r.bedrag);
      (perDag[r.periode_start] ??= []).push(r);
    }
    return { totaal: som(rijen), klaar: klaar.length, klaarB: som(klaar), geblokkeerd: rijen.length - klaar.length,
      achterstallig: rijen.filter((r) => r.achterstallig), perMaand, perJaar, perDag };
  }, [rijen]);

  async function schakel(aan: boolean) {
    const { error } = await supabase.rpc("zet_facturatie_actief", { _aan: aan });
    if (error) toast({ title: "Niet gewijzigd", description: error.message, variant: "destructive" });
    laadVast();
  }
  async function herberekenCredits() {
    const { error } = await supabase.functions.invoke("factuur-planner", { body: { actie: "proefrun", van: vandaagIso(), tot: vandaagIso() } });
    if (error) toast({ title: "Herberekenen mislukt", description: error.message, variant: "destructive" });
    laadVast();
  }
  async function opnieuw(id: string) {
    const { error } = await supabase.rpc("factuur_opnieuw_inplannen", { _planning_id: id });
    toast(error ? { title: "Niet gelukt", description: error.message, variant: "destructive" } : { title: "Periode vrijgegeven", description: "De planner maakt bij de volgende run een nieuw concept." });
    laadVast(); proefrun();
  }

  const Regel = ({ r }: { r: Kandidaat }) => (
    <tr className="border-t">
      <td className="py-1 pr-2 whitespace-nowrap">{r.relatiecode ?? "—"}</td>
      <td className="py-1 pr-2 max-w-[220px] truncate" title={r.klantnaam ?? ""}>{r.klantnaam}</td>
      <td className="py-1 pr-2 whitespace-nowrap">{r.itemcode}</td>
      <td className="py-1 pr-2 whitespace-nowrap">{formatDateNL(r.periode_start)} t/m {formatDateNL(r.periode_eind)}</td>
      <td className="py-1 pr-2 text-right whitespace-nowrap">{formatEuro(Number(r.bedrag))}</td>
      <td className="py-1 max-w-[280px] truncate" title={r.blokkade ?? ""}>
        {r.blokkade ? <span className="text-destructive">{r.blokkade}</span> : <Badge variant="secondary">Klaar</Badge>}
      </td>
    </tr>
  );
  const RegelKaart = ({ r }: { r: Kandidaat }) => (
    <div className="min-w-0 rounded-md border p-3 text-sm">
      <div className="flex min-w-0 items-start justify-between gap-3"><span className="break-words font-medium">{r.klantnaam || "—"}</span><span className="shrink-0 tabular-nums">{formatEuro(Number(r.bedrag))}</span></div>
      <p className="mt-1 break-words text-muted-foreground">{r.relatiecode ?? "—"} · {r.itemcode}</p>
      <p className="break-words">{formatDateNL(r.periode_start)} t/m {formatDateNL(r.periode_eind)}</p>
      <div className="mt-2 break-words">{r.blokkade ? <span className="text-destructive">{r.blokkade}</span> : <Badge variant="secondary">Klaar</Badge>}</div>
    </div>
  );

  return (
    <AdminLayout>
      <Helmet><title>Facturatieplanning | ZP Zaken beheer</title></Helmet>
      <div className="space-y-6 min-w-0">
        <h1 className="break-words text-xl font-bold sm:text-2xl">Facturatieplanning</h1>

        <Card>
          <CardHeader><CardTitle className="text-base">Hoofdschakelaar</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3 text-sm">
            <span role="status">Status: {cfg?.facturatie_actief ? "aan, de planner maakt concepten in Exact" : "uit, alleen proefrun en niets naar Exact"}</span>
            <span className="text-muted-foreground">Sleutelveld in Exact: {cfg?.sleutel_veld ?? "—"}</span>
            {isAdmin && (
              <Button size="sm" variant="outline" onClick={() => schakel(!cfg?.facturatie_actief)}>
                {cfg?.facturatie_actief ? "Zet uit" : "Zet aan"}
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Proefrun</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-end gap-2">
              <label className="w-full text-sm sm:w-auto">Van <Input type="date" value={van} onChange={(e) => setVan(e.target.value)} className="min-h-10 w-full sm:w-40" /></label>
              <label className="w-full text-sm sm:w-auto">Tot en met <Input type="date" value={tot} onChange={(e) => setTot(e.target.value)} className="min-h-10 w-full sm:w-40" /></label>
              <Button onClick={proefrun} disabled={laden}>{laden ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}Bereken</Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-4 text-sm">
              <div><div className="text-muted-foreground">Regels</div><div className="text-xl font-semibold">{rijen.length}</div><div>{formatEuro(sam.totaal)}</div></div>
              <div><div className="text-muted-foreground">Klaar om te maken</div><div className="text-xl font-semibold">{sam.klaar}</div><div>{formatEuro(sam.klaarB)}</div></div>
              <div><div className="text-muted-foreground">Geblokkeerd</div><div className="text-xl font-semibold">{sam.geblokkeerd}</div></div>
              <div><div className="text-muted-foreground">Achterstallig</div><div className="text-xl font-semibold">{sam.achterstallig.length}</div></div>
            </div>
            <div className="flex flex-wrap gap-6 text-sm">
              <div><div className="font-medium">Per maand</div>{Object.entries(sam.perMaand).map(([k, v]) => <div key={k}>{k}: {v.n} · {formatEuro(v.b)}</div>)}</div>
              <div><div className="font-medium">Per jaar</div>{Object.entries(sam.perJaar).map(([k, v]) => <div key={k}>{k}: {v.n} · {formatEuro(v.b)}</div>)}</div>
            </div>
            {sam.achterstallig.length > 0 && (
              <div>
                <h2 className="font-medium mb-1">Achterstallig (periode vóór {formatDateNL(van)})</h2>
                <div className="space-y-2 md:hidden">{sam.achterstallig.map((r) => <RegelKaart key={r.klant_contract_id + r.periode_start} r={r} />)}</div>
                <div className="hidden overflow-x-auto md:block"><table className="w-full text-sm"><tbody>{sam.achterstallig.map((r) => <Regel key={r.klant_contract_id + r.periode_start} r={r} />)}</tbody></table></div>
              </div>
            )}
            {Object.entries(sam.perDag).filter(([d]) => d >= van).map(([dag, lijst]) => (
              <div key={dag}>
                <h2 className="font-medium mb-1">{formatDateNL(dag)} · {lijst.length} regels · {formatEuro(lijst.reduce((s, r) => s + Number(r.bedrag), 0))}</h2>
                <div className="space-y-2 md:hidden">{lijst.map((r) => <RegelKaart key={r.klant_contract_id + r.periode_start} r={r} />)}</div>
                <div className="hidden overflow-x-auto md:block"><table className="w-full text-sm"><tbody>{lijst.map((r) => <Regel key={r.klant_contract_id + r.periode_start} r={r} />)}</tbody></table></div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Meldingen en open concepten</CardTitle></CardHeader>
          <CardContent className="text-sm">
            {meldingen.length === 0 ? <p className="text-muted-foreground">Geen open concepten of meldingen.</p> : (
              <><div className="space-y-2 md:hidden">{meldingen.map((p) => <div key={p.id} className="min-w-0 rounded-md border p-3"><p className="break-all font-medium">{p.planningssleutel}</p><p>{formatDateNL(p.periode_start)} t/m {formatDateNL(p.periode_eind)}</p><p>{formatEuro(Number(p.bedrag))} · {PLANNING_LABEL[p.status] ?? p.status}</p>{["verwijderd_in_exact", "te_laat", "fout"].includes(p.status) && <Button className="mt-2" size="sm" variant="outline" onClick={() => opnieuw(p.id)}>Opnieuw inplannen</Button>}</div>)}</div><div className="hidden overflow-x-auto md:block"><table className="w-full"><tbody>{meldingen.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="py-1 pr-2">{p.planningssleutel}</td>
                  <td className="py-1 pr-2 whitespace-nowrap">{formatDateNL(p.periode_start)} t/m {formatDateNL(p.periode_eind)}</td>
                  <td className="py-1 pr-2 text-right">{formatEuro(Number(p.bedrag))}</td>
                  <td className="py-1 pr-2">{PLANNING_LABEL[p.status] ?? p.status}</td>
                  <td className="py-1">{["verwijderd_in_exact", "te_laat", "fout"].includes(p.status) && <Button size="sm" variant="outline" onClick={() => opnieuw(p.id)}>Opnieuw inplannen</Button>}</td>
                </tr>))}</tbody></table></div></>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle className="text-base">Creditnota's bij opzegging</CardTitle>
            <Button size="sm" variant="outline" onClick={herberekenCredits}>Herbereken (proef)</Button>
          </CardHeader>
          <CardContent className="min-w-0 text-sm">
            {creditLijst.filter((c) => toonTest || !c.is_test).length === 0 ? <p className="text-muted-foreground">Geen creditnota's gepland.</p> : (
              <><div className="space-y-2 md:hidden">{creditLijst.filter((c) => toonTest || !c.is_test).map((c) => <div key={c.id} className="min-w-0 rounded-md border p-3"><p className="break-all font-medium">{c.creditsleutel}{c.is_test && <Badge variant="outline" className="ml-1">Test</Badge>}</p><p>{formatDateNL(c.credit_vanaf)} t/m {formatDateNL(c.credit_tm)}</p><p>{c.bedrag != null ? formatEuro(Number(c.bedrag)) : "—"} · {CREDIT_LABEL[c.status] ?? c.status}</p><p className="break-words text-muted-foreground">{c.melding ?? c.foutmelding ?? ""}</p></div>)}</div><div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[800px]"><thead><tr className="text-left text-muted-foreground"><th className="py-1 pr-2 font-normal">Sleutel</th><th className="py-1 pr-2 font-normal">Bij factuur</th><th className="py-1 pr-2 font-normal">Periode</th><th className="py-1 pr-2 text-right font-normal">Bedrag</th><th className="py-1 pr-2 font-normal">Status</th><th className="py-1 font-normal">Melding</th></tr></thead>
                <tbody>{creditLijst.filter((c) => toonTest || !c.is_test).map((c) => (
                  <tr key={c.id} className="border-t align-top">
                    <td className="py-1 pr-2 whitespace-nowrap">{c.creditsleutel}{c.is_test && <Badge variant="outline" className="ml-1">Test</Badge>}</td>
                    <td className="py-1 pr-2">{c.origineel_factuurnummer ?? "—"}</td>
                    <td className="py-1 pr-2 whitespace-nowrap">{formatDateNL(c.credit_vanaf)} t/m {formatDateNL(c.credit_tm)}</td>
                    <td className="py-1 pr-2 text-right whitespace-nowrap">{c.bedrag != null ? formatEuro(Number(c.bedrag)) : "—"}</td>
                    <td className="py-1 pr-2">{CREDIT_LABEL[c.status] ?? c.status}</td>
                    <td className="py-1 max-w-[320px]">{c.melding ?? c.foutmelding ?? ""}</td>
                  </tr>))}</tbody></table></div></>
            )}
            <p className="mt-2 text-xs text-muted-foreground">Naar rato per dag over de al gefactureerde periode na de einddatum. Met de hoofdschakelaar uit wordt niets naar Exact gestuurd.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Artikelmapping</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto text-sm">
            <table className="w-full"><tbody>{mapping.map((m) => (
              <tr key={m.id} className="border-t">
                <td className="py-1 pr-2">{m.itemcode_patroon}</td><td className="py-1 pr-2">{m.product}</td>
                <td className="py-1 pr-2">{m.exact_item_code ?? <span className="text-destructive">ontbreekt</span>}</td>
                <td className="py-1 pr-2">{m.gl_code ?? "—"}</td>
                <td className="py-1 pr-2">{m.bevestigd ? <Badge>Bevestigd</Badge> : <Badge variant="outline">Onbevestigd</Badge>}</td>
                <td className="py-1 max-w-[320px] truncate" title={m.blokkade_reden ?? m.notitie ?? ""}>{m.blokkade_reden ?? m.notitie}</td>
              </tr>))}</tbody></table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Laatste runs</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            {runs.map((r) => <div key={r.id}>{formatDateTimeNL(r.gestart_op)} · {r.modus} · {r.aantal_kandidaten} kandidaten · {r.aantal_aangemaakt} aangemaakt · {r.status}</div>)}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

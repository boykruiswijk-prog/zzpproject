import { useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatEuro } from "@/lib/klantContracten";
import { GrafiekLijst, KlikTooltip } from "@/components/admin/GrafiekLijst";
import { bucketBereik, type Doorklik, type GrafiekNaam } from "@/lib/grafiekDoorklik";
import { conversieAanvragen, type AanvragenOpbouw } from "../../../supabase/functions/_shared/dashboardOpbouw";
import {
  TEGELS, AANVRAAG_DOEL, PERIODES, periodeStart, groepeer, cumulatiefTegenSchema, schemaWaarde, verandering,
  type Periode, type Groep, type Punt, type Eenheid,
} from "@/lib/inzicht";

type Rij = Record<string, string | number | null>;
type InzichtData = {
  tegel: string; peildatum: string; huidig: number | null; bron: "bestaande_data" | "momentopname" | "geen";
  reeks: Punt[]; lijst: Rij[]; historie?: Punt[]; meting_vanaf?: string | null;
  vorige_week?: number | null; vorige_maand?: number | null;
  maanden?: { maand: string; nieuw: number; aflopend: number; netto: number }[];
  aanvragen_opbouw?: AanvragenOpbouw;
  acties?: { items?: Rij[] } & Record<string, unknown>;
};

const fmt = (n: number, e: Eenheid) =>
  e === "euro" ? formatEuro(n) : e === "procent" ? `${n.toLocaleString("nl-NL")}%` : n.toLocaleString("nl-NL");
const datum = (d: string) => new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short", timeZone: "Europe/Amsterdam" }).format(new Date(`${d}T12:00:00Z`));
const maandLabel = (d: string) => new Intl.DateTimeFormat("nl-NL", { month: "short", year: "2-digit", timeZone: "Europe/Amsterdam" }).format(new Date(`${d}T12:00:00Z`));
const kleur = { lijn: "hsl(var(--primary))", schema: "hsl(var(--muted-foreground))", nieuw: "hsl(var(--primary))", af: "hsl(var(--muted-foreground))", netto: "hsl(var(--foreground))" };

function Verandering({ label, huidig, vorige, eenheid }: { label: string; huidig: number; vorige?: number | null; eenheid: Eenheid }) {
  const v = verandering(huidig, vorige);
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      {v ? (
        <div className="tabular-nums">
          <span className="font-medium">{v.absoluut > 0 ? "+" : ""}{fmt(v.absoluut, eenheid === "procent" ? "aantal" : eenheid)}</span>
          <span className="text-muted-foreground"> ({v.procent == null ? "n.v.t." : `${v.procent > 0 ? "+" : ""}${v.procent.toLocaleString("nl-NL")}%`})</span>
        </div>
      ) : <div className="text-sm text-muted-foreground">Nog geen meting</div>}
    </div>
  );
}

function Meter({ waarde, vandaag }: { waarde: number; vandaag: string }) {
  const schema = schemaWaarde(vandaag);
  const pct = Math.min(1, waarde / AANVRAAG_DOEL.doel);
  const schemaPct = Math.min(1, schema / AANVRAAG_DOEL.doel);
  const boog = (p: number) => { const a = Math.PI * (1 - p); return { x: 100 + 80 * Math.cos(a), y: 100 - 80 * Math.sin(a) }; };
  const e = boog(pct); const s = boog(schemaPct);
  const verschil = Math.round((waarde - schema) * 10) / 10;
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 115" className="w-full max-w-xs" role="img" aria-label={`${waarde} van ${AANVRAAG_DOEL.doel}, schema ${schema}`}>
        <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="hsl(var(--muted))" strokeWidth="16" strokeLinecap="round" />
        {pct > 0 && <path d={`M20 100 A80 80 0 0 1 ${e.x} ${e.y}`} fill="none" stroke={kleur.lijn} strokeWidth="16" strokeLinecap="round" />}
        <line x1={100 + 62 * (s.x - 100) / 80} y1={100 + 62 * (s.y - 100) / 80} x2={100 + 98 * (s.x - 100) / 80} y2={100 + 98 * (s.y - 100) / 80} stroke="hsl(var(--foreground))" strokeWidth="3" />
        <text x="100" y="92" textAnchor="middle" className="fill-foreground text-2xl font-bold">{waarde}</text>
        <text x="100" y="110" textAnchor="middle" className="fill-muted-foreground text-[10px]">van {AANVRAAG_DOEL.doel}</text>
      </svg>
      <p className="text-sm">Schema vandaag: <strong className="tabular-nums">{schema.toLocaleString("nl-NL")}</strong> · {verschil >= 0 ? `${verschil.toLocaleString("nl-NL")} voor op schema` : `${Math.abs(verschil).toLocaleString("nl-NL")} achter op schema`}</p>
      <p className="text-xs text-muted-foreground">Schemalijn: 200 × verstreken dagen / 87 (6 okt t/m 31 dec). Het streepje is het schema.</p>
    </div>
  );
}

function lijstLink(tegel: string, r: Rij): string | null {
  if (tegel === "aanvragen" || tegel === "conversie") return r.lead_id ? `/admin/leads/${r.lead_id}` : null;
  if (tegel === "service_open") return `/admin/service-aanvragen/${r.id}`;
  if (tegel === "klanten") return `/admin/klanten/${r.id}`;
  if (r.onderneming_id) return `/admin/klanten/${r.onderneming_id}`;
  return null;
}

const KOLOMMEN: Record<string, [string, string][]> = {
  klanten: [["naam", "Klant"], ["contracten", "Contracten"]],
  contracten: [["naam", "Klant"], ["product", "Product"], ["status", "Status"], ["begin_datum", "Begin"], ["eind_datum", "Einde"]],
  aanvragen: [["dag", "Datum"], ["naam", "Aanvrager"], ["kvk", "KvK"], ["statusgroep", "Status"]],
  service_open: [["dag", "Datum"], ["naam", "Klant"], ["type", "Soort"], ["status", "Status"]],
  arr: [["naam", "Klant"], ["product", "Product"], ["arr", "ARR"], ["begin_datum", "Begin"]],
  loopt_af: [["naam", "Klant"], ["product", "Product"], ["arr", "ARR"], ["eind_datum", "Einde"]],
  arr_maand: [["naam", "Klant"], ["product", "Product"], ["status", "Status"], ["arr", "ARR"], ["begin_datum", "Begin"], ["eind_datum", "Einde"]],
};
KOLOMMEN.conversie = KOLOMMEN.aanvragen;

const LIJST_ELDERS: Record<string, [string, string]> = {
  leads: ["/admin/leads", "Naar alle leads"], mrr: ["/admin/klanten", "Naar klanten en contracten"],
  jaarwaarde: ["/admin/klanten", "Naar klanten en contracten"], opzeggingen: ["/admin/klanten#opzeggingen", "Naar opzeggingen"],
  vandaag: ["/admin", "Naar Vandaag te doen op het dashboard"], netto_groei: ["/admin/klanten", "Naar klanten en contracten"],
};

export default function Inzicht() {
  const { tegel = "" } = useParams();
  const def = TEGELS[tegel];
  const { isSupervisorOrAdmin, isAal2 } = useAuth();
  const mag = !!def && isAal2 && (!def.alleenSupervisor || isSupervisorOrAdmin);
  const [periode, setPeriode] = useState<Periode>("sinds6okt");
  const [groep, setGroep] = useState<Groep>("dag");
  const [alles, setAlles] = useState(false);
  const [keuze, setKeuze] = useState<Doorklik | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["inzicht", tegel],
    enabled: mag,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("inzicht_tegel" as never, { _tegel: tegel } as never);
      if (error) throw new Error((error as { message?: string }).message ?? "Onbekende fout");
      return data as unknown as InzichtData;
    },
    refetchInterval: 60_000,
  });

  const eenheid = def?.eenheid ?? "aantal";
  const isAanvraag = tegel === "aanvragen" || tegel === "conversie";
  const huidig = data ? (tegel === "conversie" ? conversieAanvragen(data.aanvragen_opbouw) : (data.huidig ?? 0)) : 0;
  const start = data ? periodeStart(periode, data.peildatum) : "";

  const grafiek = useMemo(() => {
    if (!data) return [] as Punt[];
    const bron = isAanvraag ? data.reeks : (data.historie ?? []);
    return groepeer(bron.filter((p) => p.dag >= start), groep, isAanvraag ? "som" : "laatste");
  }, [data, start, groep, isAanvraag]);
  const cumulatief = useMemo(() => data && isAanvraag ? cumulatiefTegenSchema(data.reeks, data.peildatum).filter((p) => p.dag >= start) : [], [data, isAanvraag, start]);

  return (
    <AdminLayout>
      <Helmet><title>{def?.titel ?? "Inzicht"} | Inzicht | ZP Zaken</title><meta name="robots" content="noindex" /></Helmet>
      <div className="space-y-6">
        <Link to="/admin" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Dashboard</Link>
        {!def ? <p>Deze teller bestaat niet.</p> : !mag ? <p>Je hebt geen toegang tot deze teller.</p> : isError ? <p role="alert" className="text-destructive">Kon niet laden: {(error as Error).message}</p> : isLoading || !data ? <Loader2 className="h-6 w-6 animate-spin" /> : <>
          <div>
            <h1 className="text-2xl font-bold">{def.titel}</h1>
            <p className="text-sm text-muted-foreground">{def.uitleg} Stand {datum(data.peildatum)}, zelfde getal als op het dashboard.</p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card className={isAanvraag ? "" : "md:col-span-3"}>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Huidige stand</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="text-3xl font-bold tabular-nums" data-testid="inzicht-huidig">{fmt(huidig, eenheid)}</div>
                {tegel === "conversie" ? <p className="text-xs text-muted-foreground">{data.aanvragen_opbouw?.klant} van {data.aanvragen_opbouw?.totaal} aanvragen klant.</p> : data.bron !== "geen" && tegel !== "arr_maand" && (
                  <div className="grid grid-cols-2 gap-3">
                    <Verandering label="T.o.v. vorige week" huidig={huidig} vorige={data.vorige_week} eenheid={eenheid} />
                    <Verandering label="T.o.v. vorige maand" huidig={huidig} vorige={data.vorige_maand} eenheid={eenheid} />
                  </div>
                )}
                {data.bron === "momentopname" && <p className="text-xs text-muted-foreground">Meting loopt sinds {data.meting_vanaf ? datum(data.meting_vanaf) : "vandaag"}; vergelijkingen verschijnen zodra er een week en een maand gemeten is.</p>}
              </CardContent>
            </Card>
            {isAanvraag && <Card className="md:col-span-2">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Doel {AANVRAAG_DOEL.doel} aanvragen</CardTitle></CardHeader>
              <CardContent><Meter waarde={data.huidig ?? 0} vandaag={data.peildatum} /></CardContent>
            </Card>}
          </div>

          {data.bron !== "geen" && tegel !== "conversie" && <Card>
            <CardHeader className="flex flex-col gap-3 pb-2 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-sm font-medium">Ontwikkeling</CardTitle>
              {tegel !== "arr_maand" && <div className="flex flex-wrap gap-2">
                {PERIODES.map((p) => <Button key={p.key} size="sm" variant={periode === p.key ? "default" : "outline"} onClick={() => setPeriode(p.key)}>{p.label}</Button>)}
                <span className="mx-1" />
                {(["dag", "week", "maand"] as Groep[]).map((g) => <Button key={g} size="sm" variant={groep === g ? "secondary" : "ghost"} onClick={() => setGroep(g)}>Per {g}</Button>)}
              </div>}
            </CardHeader>
            <CardContent className="space-y-6">
              {data.bron === "momentopname" && <Badge variant="secondary">Dagelijkse meting om 23:55, loopt sinds {data.meting_vanaf ? datum(data.meting_vanaf) : "vandaag"}</Badge>}
              {tegel !== "arr_maand" && (grafiek.length === 0 ? <p className="text-sm text-muted-foreground">Nog geen gegevens in deze periode.</p> :
                <div className="h-64"><ResponsiveContainer width="100%" height="100%">
                  {isAanvraag ? <BarChart data={grafiek}><CartesianGrid strokeDasharray="3 3" className="stroke-border" /><XAxis dataKey="dag" tickFormatter={datum} fontSize={11} /><YAxis allowDecimals={false} fontSize={11} /><Tooltip content={<KlikTooltip labelFormatter={(d) => groep === "dag" ? datum(d) : `${groep === "week" ? "Week van" : "Maand"} ${groep === "maand" ? maandLabel(d) : datum(d)}`} />} cursor={{ fill: "hsl(var(--muted))" }} /><Bar dataKey="waarde" name="Aanvragen" fill={kleur.lijn} className="cursor-pointer" onClick={(p: any) => { const b = bucketBereik(p.dag, groep, start); setKeuze({ grafiek: "aanvragen", ...b, waarde: p.waarde, titel: `Aanvragen ${b.van === b.tot ? `op ${datum(b.van)}` : `${datum(b.van)} t/m ${datum(b.tot)}`} (${p.waarde})` }); }} /></BarChart>
                  : <LineChart data={grafiek}><CartesianGrid strokeDasharray="3 3" className="stroke-border" /><XAxis dataKey="dag" tickFormatter={datum} fontSize={11} /><YAxis fontSize={11} tickFormatter={(v) => eenheid === "euro" ? `€${Math.round(v / 1000)}k` : String(v)} /><Tooltip labelFormatter={(d) => datum(String(d))} formatter={(v) => [fmt(v as number, eenheid), def.titel]} /><Line type="monotone" dataKey="waarde" stroke={kleur.lijn} dot={grafiek.length < 3} /></LineChart>}
                </ResponsiveContainer></div>)}
              {isAanvraag && cumulatief.length > 0 && <div>
                <h2 className="mb-2 text-sm font-medium">Cumulatief tegen de schemalijn</h2>
                <div className="h-64"><ResponsiveContainer width="100%" height="100%">
                  <LineChart data={cumulatief} className="cursor-pointer" onClick={(st: any) => { const p = st?.activePayload?.[0]?.payload; if (p) setKeuze({ grafiek: "aanvragen", tot: p.dag, waarde: p.cumulatief, titel: `Aanvragen t/m ${datum(p.dag)} (${p.cumulatief})` }); }}><CartesianGrid strokeDasharray="3 3" className="stroke-border" /><XAxis dataKey="dag" tickFormatter={datum} fontSize={11} /><YAxis fontSize={11} /><Tooltip content={<KlikTooltip labelFormatter={datum} />} /><Legend /><Line name="Aanvragen" dataKey="cumulatief" stroke={kleur.lijn} dot={false} /><Line name="Schema" dataKey="schema" stroke={kleur.schema} strokeDasharray="5 5" dot={false} /></LineChart>
                </ResponsiveContainer></div>
              </div>}
              {data.maanden && <div>
                <h2 className="mb-2 text-sm font-medium">ARR per maand: nieuw, aflopend en netto (uit begin- en einddatums)</h2>
                <div className="h-64"><ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.maanden}><CartesianGrid strokeDasharray="3 3" className="stroke-border" /><XAxis dataKey="maand" tickFormatter={maandLabel} fontSize={11} /><YAxis fontSize={11} tickFormatter={(v) => `€${Math.round(v / 1000)}k`} /><Tooltip content={<KlikTooltip labelFormatter={maandLabel} valueFormatter={formatEuro} />} cursor={{ fill: "hsl(var(--muted))" }} /><Legend />{([["nieuw", "Nieuw", "arr_nieuw", kleur.nieuw], ["aflopend", "Aflopend", "arr_aflopend", kleur.af], ["netto", "Netto", "arr_netto", kleur.netto]] as [string, string, GrafiekNaam, string][]).map(([k, n, g, f]) => <Bar key={k} name={n} dataKey={k} fill={f} className="cursor-pointer" onClick={(p: any) => setKeuze({ grafiek: g, sleutel: p.maand, waarde: p[k], titel: `${n} ARR ${maandLabel(p.maand)} (${formatEuro(p[k])})` })} />)}</BarChart>
                </ResponsiveContainer></div>
              </div>}
            </CardContent>
          </Card>}

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Achter het getal{KOLOMMEN[tegel] ? ` (${data.lijst.length.toLocaleString("nl-NL")})` : ""}</CardTitle></CardHeader>
            <CardContent>
              {!KOLOMMEN[tegel] ? (LIJST_ELDERS[tegel] && <Link className="text-sm underline" to={LIJST_ELDERS[tegel][0]}>{LIJST_ELDERS[tegel][1]}</Link>) : <>
                <div className="overflow-x-auto"><table className="w-full text-sm">
                  <thead className="text-left text-muted-foreground"><tr>{KOLOMMEN[tegel].map(([k, l]) => <th key={k} className="py-2 pr-3 font-medium">{l}</th>)}</tr></thead>
                  <tbody>{(alles ? data.lijst : data.lijst.slice(0, 100)).map((r, i) => {
                    const href = lijstLink(tegel, r);
                    return <tr key={`${r.id}-${i}`} className="border-t border-border">{KOLOMMEN[tegel].map(([k], j) => {
                      const v = r[k]; const tekst = v == null ? "" : k === "arr" ? formatEuro(Number(v)) : String(v);
                      return <td key={k} className="py-1.5 pr-3 tabular-nums">{j === 0 && href ? <Link to={href} className="underline-offset-2 hover:underline">{tekst || "Openen"}</Link> : tekst}</td>;
                    })}</tr>;
                  })}</tbody>
                </table></div>
                {data.lijst.length > 100 && !alles && <Button variant="outline" size="sm" className="mt-3" onClick={() => setAlles(true)}>Toon alle {data.lijst.length.toLocaleString("nl-NL")}</Button>}
              </>}
            </CardContent>
          </Card>
        </>}
      </div>
      <GrafiekLijst keuze={keuze} onClose={() => setKeuze(null)} />
    </AdminLayout>
  );
}

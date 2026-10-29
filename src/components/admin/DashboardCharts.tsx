import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { statusLabel, LEAD_STATUS_TITELS } from "@/lib/statusLabels";
import { useToonTestrecords } from "@/hooks/useToonTestrecords";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { plusDagen } from "@/lib/inzicht";
import { productNaam, type Doorklik, type GrafiekNaam, type GrafiekPunt } from "@/lib/grafiekDoorklik";
import { GrafiekLijst, KlikTooltip } from "@/components/admin/GrafiekLijst";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line,
} from "recharts";

const COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];
const vandaagNL = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam" }).format(new Date());
export const LEAD_TYPES: { type: string; naam: string; kleur: string }[] = [
  { type: "verzekering_aanvraag", naam: "Verzekeringsaanvraag", kleur: "hsl(var(--primary))" },
  { type: "offerte-aanvraag", naam: "Offerte-aanvraag", kleur: "#f59e0b" },
  { type: "contact", naam: "Contactvraag", kleur: "#3b82f6" },
  { type: "handmatig", naam: "Handmatig", kleur: "#8b5cf6" },
];
const statusUitleg = (s: string) => (LEAD_STATUS_TITELS as Record<string, string>)[s];

function StatusTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  return (
    <div className="rounded border bg-popover p-2 text-xs text-popover-foreground shadow-md max-w-64">
      <div className="font-medium">{r.name}: {r.totaal}</div>
      {statusUitleg(r.sleutel) && <div className="text-muted-foreground">{statusUitleg(r.sleutel)}</div>}
      {LEAD_TYPES.filter((t) => r[t.type]).map((t) => <div key={t.type}>{t.naam}: {r[t.type]}</div>)}
      <div className="mt-1 text-muted-foreground">Klik voor de lijst</div>
    </div>
  );
}

const dagLabel = (d: string) => new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short", timeZone: "Europe/Amsterdam" }).format(new Date(`${d}T12:00:00Z`));

/** Leads-grafieken; tellingen via RPC admin_grafiek, lijst via admin_grafiek_records (zelfde bron). */
export function DashboardCharts() {
  const { toonTest } = useToonTestrecords();
  const [keuze, setKeuze] = useState<Doorklik | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-grafieken", toonTest],
    queryFn: async () => {
      const haal = async (g: GrafiekNaam) => {
        const { data, error } = await supabase.rpc("admin_grafiek" as never, { _grafiek: g, _toon_test: toonTest } as never);
        if (error) throw error;
        return (data ?? []) as unknown as GrafiekPunt[];
      };
      const [dag, status, verzekering] = await Promise.all([haal("leads_dag"), haal("leads_status_type"), haal("leads_verzekering")]);
      return { dag, status, verzekering };
    },
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {[...Array(2)].map((_, i) => (
          <Card key={i}><CardHeader><div className="h-5 w-32 bg-muted animate-pulse rounded" /></CardHeader>
            <CardContent><div className="h-64 bg-muted animate-pulse rounded" /></CardContent></Card>
        ))}
      </div>
    );
  }

  const perDag = new Map((data?.dag ?? []).map((p) => [p.sleutel, p.waarde]));
  const vandaag = vandaagNL();
  const leadsOverTime = Array.from({ length: 14 }, (_, i) => plusDagen(vandaag, i - 13)).map((d) => ({ sleutel: d, date: dagLabel(d), leads: perDag.get(d) ?? 0 }));
  const perStatus = new Map<string, Record<string, any>>();
  for (const p of data?.status ?? []) {
    const [st, ty] = p.sleutel.split("|");
    const r = perStatus.get(st) ?? { sleutel: st, name: statusLabel(st), totaal: 0 };
    r[ty] = (r[ty] ?? 0) + p.waarde; r.totaal += p.waarde; perStatus.set(st, r);
  }
  const statusData = [...perStatus.values()];
  const typeNaam = (t: string) => LEAD_TYPES.find((x) => x.type === t)?.naam ?? t;
  const verzekeringData = (data?.verzekering ?? []).map((p) => ({ sleutel: p.sleutel, name: productNaam(p.sleutel), value: p.waarde }));
  const totaalVerz = verzekeringData.reduce((s, r) => s + r.value, 0);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="col-span-2">
        <CardHeader><CardTitle>Leads per dag (laatste 14 dagen)</CardTitle></CardHeader>
        <CardContent>
          <div className="h-64 cursor-pointer" data-testid="grafiek-leads-dag">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={leadsOverTime} onClick={(s: any) => {
                const p = s?.activePayload?.[0]?.payload; if (!p) return;
                setKeuze({ grafiek: "leads_dag", sleutel: p.sleutel, waarde: p.leads, titel: `Leads op ${p.date} (${p.leads})` });
              }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" fontSize={12} />
                <YAxis fontSize={12} allowDecimals={false} />
                <Tooltip content={<KlikTooltip />} />
                <Line type="linear" dataKey="leads" name="Leads" stroke="hsl(var(--accent))" strokeWidth={2} dot={{ fill: "hsl(var(--accent))", r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Leads per status</CardTitle></CardHeader>
        <CardContent>
          <div className="h-64">
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusData} layout="vertical" onClick={(s: any) => {
                  if (s?.activeTooltipIndex == null || s?.activeCoordinate == null) return;
                }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" fontSize={12} allowDecimals={false} />
                  <YAxis dataKey="name" type="category" fontSize={12} width={120} />
                  <Tooltip content={<StatusTooltip />} cursor={{ fill: "hsl(var(--muted))" }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {LEAD_TYPES.map((t) => (
                    <Bar key={t.type} dataKey={t.type} name={t.naam} stackId="type" fill={t.kleur} className="cursor-pointer"
                      onClick={(p: any) => setKeuze({ grafiek: "leads_status_type", sleutel: `${p.sleutel}|${t.type}`, waarde: p[t.type],
                        titel: `Status: ${p.name}, ${typeNaam(t.type)} (${p[t.type]})` })} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="h-full flex items-center justify-center text-muted-foreground">Nog geen data beschikbaar</div>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Aanvragen per verzekering</CardTitle><p className="text-sm text-muted-foreground">Alleen leads met een gekozen verzekering</p></CardHeader>
        <CardContent>
          {verzekeringData.length > 0 ? (
            <div className="space-y-3">
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={verzekeringData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} className="cursor-pointer"
                      onClick={(p: any) => setKeuze({ grafiek: "leads_verzekering", sleutel: p.sleutel, waarde: p.value, titel: `Verzekering: ${p.name} (${p.value})` })}>
                      {verzekeringData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip content={<KlikTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="space-y-1 text-sm" aria-label="Legenda">
                {verzekeringData.map((r, i) => (
                  <li key={r.sleutel}>
                    <button type="button" className="flex w-full items-start gap-2 rounded px-1 text-left hover:bg-muted" title="Klik voor de lijst"
                      onClick={() => setKeuze({ grafiek: "leads_verzekering", sleutel: r.sleutel, waarde: r.value, titel: `Verzekering: ${r.name} (${r.value})` })}>
                      <span className="mt-1 h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="flex-1 break-words">{r.name}</span>
                      <span className="tabular-nums text-muted-foreground">{r.value} ({totaalVerz ? Math.round((r.value / totaalVerz) * 100) : 0}%)</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : <div className="h-64 flex items-center justify-center text-muted-foreground">Nog geen data beschikbaar</div>}
        </CardContent>
      </Card>
      <GrafiekLijst keuze={keuze} toonTest={toonTest} onClose={() => setKeuze(null)} />
    </div>
  );
}

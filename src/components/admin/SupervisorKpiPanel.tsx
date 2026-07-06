import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { formatDateTimeLongNL } from "@/lib/dateFormat";
import {
  Activity,
  Users,
  Euro,
  TrendingUp,
  Clock,
  UserX,
} from "lucide-react";

type KpiActieveLead = {
  id: string;
  status: string;
  gekozen_pakket: string | null;
  omzet: string | null;
  exact_invoice_amount: number | null;
  geactiveerd_op: string | null;
  created_at: string;
  betaalritme: "maandelijks" | "jaarlijks" | "onbekend";
};

const eur = (n: number) =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(n);

const monthKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const monthLabel = (key: string) => {
  const [y, m] = key.split("-");
  const names = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
  return `${names[parseInt(m, 10) - 1]} ${y.slice(2)}`;
};

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground italic">{text}</p>;
}

export function SupervisorKpiPanel() {
  // 1+2. Actieve portefeuille + MRR-indicatie
  const { data: actieveLeads, isLoading: loadingActief } = useQuery({
    queryKey: ["kpi-actieve-leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kpi_actieve_leads" as never)
        .select("*");
      if (error) throw error;
      return (data ?? []) as unknown as KpiActieveLead[];
    },
  });

  // 3. Nieuwe leads deze maand + funnel totaal
  const { data: leadsAll } = useQuery({
    queryKey: ["kpi-leads-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("id,status,created_at,opzeg_datum,opzeg_reden")
        .eq("is_test", false);
      if (error) throw error;
      return data ?? [];
    },
  });

  // 5. Activaties uit activiteiten_log gekoppeld aan niet-test leads
  const { data: activaties } = useQuery({
    queryKey: ["kpi-activaties"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activiteiten_log")
        .select("aangemaakt_op, lead_id, leads:lead_id(id,created_at,is_test)")
        .eq("actie_type", "lead_geactiveerd")
        .order("aangemaakt_op", { ascending: false });
      if (error) throw error;
      return (data ?? []).filter((r: any) => r.leads && r.leads.is_test === false);
    },
  });

  // 9. Recente activiteit (alle types)
  const { data: recentLog } = useQuery({
    queryKey: ["kpi-recent-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activiteiten_log")
        .select("id,actie_type,omschrijving,aangemaakt_op,uitgevoerd_door_naam")
        .order("aangemaakt_op", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data ?? [];
    },
  });

  const actief = actieveLeads ?? [];
  const nMaandelijks = actief.filter((l) => l.betaalritme === "maandelijks").length;
  const nJaarlijks = actief.filter((l) => l.betaalritme === "jaarlijks").length;
  const nOnbekendRitme = actief.filter((l) => l.betaalritme === "onbekend").length;

  // MRR-indicatie
  const mrrMaand = actief
    .filter((l) => l.betaalritme === "maandelijks")
    .reduce((sum, l) => sum + (Number(l.exact_invoice_amount) || 0), 0);
  const mrrJaar = actief
    .filter((l) => l.betaalritme === "jaarlijks")
    .reduce((sum, l) => sum + (Number(l.exact_invoice_amount) || 0) / 12, 0);
  const mrrTotaal = mrrMaand + mrrJaar;
  const zonderBedrag = actief.filter((l) => !l.exact_invoice_amount).length;

  // Funnel + nieuwe leads
  const now = new Date();
  const startMaand = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const nieuweDezeMaand = (leadsAll ?? []).filter((l) => l.created_at >= startMaand).length;
  const funnelTotaal = leadsAll?.length ?? 0;

  // Conversie
  const bereikte = (leadsAll ?? []).filter((l) => l.status === "actief" || l.status === "klant").length;
  const conversie = funnelTotaal > 0 ? Math.round((bereikte / funnelTotaal) * 100) : 0;

  // Verwerkingstijd
  const doorlooptijden = (activaties ?? [])
    .map((r: any) => {
      const start = r.leads?.created_at ? new Date(r.leads.created_at).getTime() : null;
      const end = r.aangemaakt_op ? new Date(r.aangemaakt_op).getTime() : null;
      return start && end && end >= start ? end - start : null;
    })
    .filter((x): x is number => x !== null);
  const gemDoorlooptijdMs =
    doorlooptijden.length > 0
      ? doorlooptijden.reduce((a, b) => a + b, 0) / doorlooptijden.length
      : null;
  const formatDuur = (ms: number) => {
    const uur = ms / 3_600_000;
    if (uur < 1) return `${Math.round(ms / 60_000)} min`;
    if (uur < 48) return `${uur.toFixed(1)} uur`;
    return `${(uur / 24).toFixed(1)} dagen`;
  };

  // Opzeggingen
  const opzeggingen = (leadsAll ?? []).filter(
    (l) => l.status === "opgezegd" || l.opzeg_datum,
  );
  const laatsteOpzegReden =
    opzeggingen
      .slice()
      .sort((a, b) => (b.opzeg_datum ?? "").localeCompare(a.opzeg_datum ?? ""))[0]?.opzeg_reden ??
    null;

  // Grafiek: activaties per maand, laatste 6 maanden
  const bucketMaanden: { key: string; label: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    bucketMaanden.push({ key: monthKey(d), label: monthLabel(monthKey(d)) });
  }
  const activatiesPerMaand = bucketMaanden.map((b) => {
    const n = (activaties ?? []).filter(
      (r: any) => monthKey(new Date(r.aangemaakt_op)) === b.key,
    ).length;
    return { maand: b.label, aantal: n };
  });
  const activatiesTotaal = activatiesPerMaand.reduce((s, r) => s + r.aantal, 0);

  // Funnel-verdeling
  const funnelBuckets = [
    { key: "nieuw", label: "Nieuw", n: (leadsAll ?? []).filter((l) => l.status === "nieuw" || l.status === "nieuw_te_beoordelen").length },
    { key: "in_behandeling", label: "In behandeling", n: (leadsAll ?? []).filter((l) => l.status === "in_behandeling" || l.status === "afspraak_gepland").length },
    { key: "offerte_verstuurd", label: "Offerte verstuurd", n: (leadsAll ?? []).filter((l) => l.status === "offerte_verstuurd").length },
    { key: "actief", label: "Actief", n: (leadsAll ?? []).filter((l) => l.status === "actief" || l.status === "klant").length },
    { key: "afgewezen", label: "Afgewezen", n: (leadsAll ?? []).filter((l) => l.status === "afgewezen").length },
  ];

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Portefeuille & prestaties</h2>
          <p className="text-sm text-muted-foreground">
            Alleen zichtbaar voor supervisor · testrecords uitgesloten
          </p>
        </div>
        <Badge variant="outline">supervisor</Badge>
      </div>

      {/* KPI-tegels */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* 1. Actieve portefeuille */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" /> Actieve portefeuille
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{loadingActief ? "…" : actief.length}</div>
            {actief.length > 0 ? (
              <p className="text-xs text-muted-foreground mt-1">
                {nMaandelijks} maandelijks · {nJaarlijks} jaarlijks
                {nOnbekendRitme > 0 && ` · ${nOnbekendRitme} onbekend ritme`}
              </p>
            ) : (
              <Empty text="Nog geen actieve polissen zonder testmarkering." />
            )}
          </CardContent>
        </Card>

        {/* 2. Maandelijkse premie (indicatie) */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Euro className="h-4 w-4" /> Maandelijkse premie <Badge variant="secondary" className="text-[10px]">indicatief</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {mrrTotaal > 0 ? eur(mrrTotaal) : "—"}
            </div>
            {actief.length === 0 ? (
              <Empty text="Nog geen actieve polissen." />
            ) : zonderBedrag > 0 ? (
              <p className="text-xs text-muted-foreground mt-1">
                {zonderBedrag} van {actief.length} actieve polissen heeft nog geen premiebedrag in Exact. Cijfer is een ondergrens.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">
                Op basis van {actief.length} actieve polissen.
              </p>
            )}
          </CardContent>
        </Card>

        {/* 3. Nieuwe leads deze maand */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Nieuwe leads deze maand
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{nieuweDezeMaand}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Totaal in funnel: {funnelTotaal} leads (excl. test)
            </p>
          </CardContent>
        </Card>

        {/* 4. Conversie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Activity className="h-4 w-4" /> Conversie
            </CardTitle>
          </CardHeader>
          <CardContent>
            {funnelTotaal === 0 ? (
              <>
                <div className="text-3xl font-bold">—</div>
                <Empty text="Geen leads zonder testmarkering." />
              </>
            ) : (
              <>
                <div className="text-3xl font-bold">{conversie}%</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {bereikte} van {funnelTotaal} leads bereikte status actief of klant
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* 5. Gem. verwerkingstijd */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" /> Gem. verwerkingstijd
            </CardTitle>
          </CardHeader>
          <CardContent>
            {gemDoorlooptijdMs === null ? (
              <>
                <div className="text-3xl font-bold">—</div>
                <Empty text="Nog onvoldoende gegevens." />
              </>
            ) : (
              <>
                <div className="text-3xl font-bold">{formatDuur(gemDoorlooptijdMs)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Op basis van {doorlooptijden.length} activatie{doorlooptijden.length === 1 ? "" : "s"}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* 6. Opzeggingen */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <UserX className="h-4 w-4" /> Opzeggingen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{opzeggingen.length}</div>
            {opzeggingen.length === 0 ? (
              <Empty text="Nog geen opzeggingen." />
            ) : laatsteOpzegReden ? (
              <p className="text-xs text-muted-foreground mt-1">
                Laatste reden: {laatsteOpzegReden.replace(/_/g, " ")}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">Geen reden geregistreerd.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Grafieken */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* 7. Activaties per maand */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Activaties per maand</CardTitle>
            <p className="text-xs text-muted-foreground">Laatste 6 maanden, exclusief testleads</p>
          </CardHeader>
          <CardContent>
            {activatiesTotaal === 0 ? (
              <Empty text="Nog geen activaties in de laatste 6 maanden voor echte klanten." />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={activatiesPerMaand}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="maand" fontSize={12} />
                  <YAxis allowDecimals={false} fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="aantal" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* 8. Funnel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Funnel</CardTitle>
            <p className="text-xs text-muted-foreground">Aantallen per fase (excl. test)</p>
          </CardHeader>
          <CardContent>
            {funnelTotaal === 0 ? (
              <Empty text="Geen leads in de funnel." />
            ) : (
              <div className="space-y-2">
                {funnelBuckets.map((b) => {
                  const pct = funnelTotaal > 0 ? (b.n / funnelTotaal) * 100 : 0;
                  return (
                    <div key={b.key}>
                      <div className="flex justify-between text-sm mb-1">
                        <span>{b.label}</span>
                        <span className="text-muted-foreground">{b.n}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 9. Recente activiteit */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recente activiteit</CardTitle>
          <p className="text-xs text-muted-foreground">Laatste 8 gebeurtenissen uit het logboek</p>
        </CardHeader>
        <CardContent>
          {!recentLog || recentLog.length === 0 ? (
            <Empty text="Nog geen activiteit geregistreerd." />
          ) : (
            <ul className="divide-y divide-border">
              {recentLog.map((r: any) => (
                <li key={r.id} className="py-2 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm truncate">{r.omschrijving || r.actie_type}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.actie_type}
                      {r.uitgevoerd_door_naam ? ` · ${r.uitgevoerd_door_naam}` : ""}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatDateTimeLongNL(r.aangemaakt_op)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

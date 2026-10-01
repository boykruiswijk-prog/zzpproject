import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToonTestrecords } from "@/hooks/useToonTestrecords";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Building2, FileText, Euro, Users, TrendingUp, UserX, CalendarClock, AlertTriangle, RefreshCw, LineChart } from "lucide-react";
import { formatEuro } from "@/lib/klantContracten";

export type DashboardTellers = {
  klanten: number; contracten_actief: number; mrr: number; arr: number;
  leads_totaal: number; leads_week: number; leads_maand: number; leads_omgezet: number;
  opzeggingen_te_koppelen: number; opzeggingen_te_verwerken: number;
  planning_aantal: number; planning_bedrag: number;
  planning_factureerbaar_aantal: number; planning_factureerbaar_bedrag: number;
  planning_geblokkeerd_aantal: number;
};

/** Eén bron voor alle dashboardtellers: RPC dashboard_tellers (CRM). */
export function useDashboardTellers() {
  const { toonTest } = useToonTestrecords();
  return useQuery({
    queryKey: ["dashboard-tellers", toonTest],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("dashboard_tellers", { _toon_test: toonTest });
      if (error) {
        console.error("dashboard_tellers mislukt:", error);
        throw new Error(error.message || "Onbekende fout");
      }
      if (!data || typeof data !== "object") throw new Error("Lege reactie van de tellers");
      return data as unknown as DashboardTellers;
    },
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    retry: 2,
  });
}

export function DashboardStats() {
  const { data: t, isLoading, isError, error, refetch, isFetching } = useDashboardTellers();

  if (isError) {
    return (
      <Alert variant="destructive" role="alert">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Tellers konden niet worden geladen</AlertTitle>
        <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span>{(error as Error)?.message}</span>
          <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Opnieuw proberen
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const conversie = t && t.leads_totaal > 0 ? Math.round((t.leads_omgezet / t.leads_totaal) * 1000) / 10 : 0;
  const kaarten = [
    { title: "Klanten", value: t?.klanten, icon: Building2, description: "Ondernemingen met een lopend contract", href: "/admin/klanten" },
    { title: "Actieve contractregels", value: t?.contracten_actief, icon: FileText, description: "Status actief of loopt af", href: "/admin/klanten" },
    { title: "Maandwaarde (MRR)", value: t ? formatEuro(t.mrr) : undefined, icon: Euro, description: "Jaarcontracten gedeeld door 12", href: "/admin/klanten" },
    { title: "Jaarwaarde (ARR)", value: t ? formatEuro(t.arr) : undefined, icon: LineChart, description: "MRR × 12", href: "/admin/klanten" },
    { title: "Leads", value: t ? `${t.leads_week} / ${t.leads_maand}` : undefined, icon: Users, description: `deze week / deze maand · ${t?.leads_totaal ?? 0} totaal`, href: "/admin/leads" },
    { title: "Conversie leads", value: t ? `${conversie}%` : undefined, icon: TrendingUp, description: `${t?.leads_omgezet ?? 0} leads met status actief of klant`, href: "/admin/leads" },
    { title: "Opzeggingen te koppelen", value: t?.opzeggingen_te_koppelen, icon: UserX, description: `${t?.opzeggingen_te_verwerken ?? 0} gekoppeld, nog te verwerken`, href: "/admin/klanten#opzeggingen", let: (t?.opzeggingen_te_koppelen ?? 0) > 0 },
    { title: "Facturatieplanning (30 dagen)", value: t ? `${t.planning_aantal} · ${formatEuro(t.planning_bedrag)}` : undefined, icon: CalendarClock, description: t ? `${t.planning_factureerbaar_aantal} factureerbaar (${formatEuro(t.planning_factureerbaar_bedrag)}) · ${t.planning_geblokkeerd_aantal} geblokkeerd` : "Periodes die de komende 30 dagen starten", href: "/admin/facturatieplanning" },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {kaarten.map((k) => (
        <Link key={k.title} to={k.href} className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Card className={`h-full hover:bg-muted/30 ${k.let ? "border-amber-500" : ""}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{k.title}</CardTitle>
              <k.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums">{isLoading ? "…" : k.value ?? "—"}</div>
              <p className="text-xs text-muted-foreground">{k.description}</p>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}

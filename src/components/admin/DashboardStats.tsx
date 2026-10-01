import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToonTestrecords } from "@/hooks/useToonTestrecords";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, FileText, Euro, Users, TrendingUp, UserX } from "lucide-react";
import { formatEuro } from "@/lib/klantContracten";

export type DashboardTellers = {
  klanten: number; contracten_actief: number; mrr: number;
  leads_totaal: number; leads_week: number; leads_maand: number; leads_omgezet: number;
  opzeggingen_te_koppelen: number; opzeggingen_te_verwerken: number;
};

/** Eén bron voor alle dashboardtellers: RPC dashboard_tellers (CRM). */
export function useDashboardTellers() {
  const { toonTest } = useToonTestrecords();
  return useQuery({
    queryKey: ["dashboard-tellers", toonTest],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("dashboard_tellers", { _toon_test: toonTest });
      if (error) throw error;
      return data as unknown as DashboardTellers;
    },
  });
}

export function DashboardStats() {
  const { data: t, isLoading } = useDashboardTellers();
  const conversie = t && t.leads_totaal > 0 ? Math.round((t.leads_omgezet / t.leads_totaal) * 1000) / 10 : 0;
  const kaarten = [
    { title: "Klanten", value: t?.klanten, icon: Building2, description: "Ondernemingen met een lopend contract", href: "/admin/klanten" },
    { title: "Actieve contractregels", value: t?.contracten_actief, icon: FileText, description: "Status actief of loopt af", href: "/admin/klanten" },
    { title: "Maandwaarde (MRR)", value: t ? formatEuro(t.mrr) : undefined, icon: Euro, description: "Jaarcontracten gedeeld door 12", href: "/admin/klanten" },
    { title: "Leads", value: t?.leads_totaal, icon: Users, description: `${t?.leads_week ?? 0} deze week · ${t?.leads_maand ?? 0} deze maand`, href: "/admin/leads" },
    { title: "Conversie leads", value: `${conversie}%`, icon: TrendingUp, description: `${t?.leads_omgezet ?? 0} leads met status actief of klant`, href: "/admin/leads" },
    { title: "Opzeggingen te koppelen", value: t?.opzeggingen_te_koppelen, icon: UserX, description: `${t?.opzeggingen_te_verwerken ?? 0} gekoppeld, nog te verwerken`, href: "/admin/klanten#opzeggingen", let: (t?.opzeggingen_te_koppelen ?? 0) > 0 },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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

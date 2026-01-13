import { useLeadStats } from "@/hooks/useLeadStats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, TrendingUp, Target, UserCheck } from "lucide-react";

export function DashboardStats() {
  const { data: stats, isLoading } = useLeadStats();

  const statCards = [
    {
      title: "Totaal leads",
      value: stats?.totalLeads || 0,
      icon: Users,
      description: "Alle leads in het systeem",
    },
    {
      title: "Nieuwe leads (week)",
      value: stats?.newLeadsWeek || 0,
      icon: TrendingUp,
      description: "Leads deze week",
    },
    {
      title: "Conversieratio",
      value: `${stats?.conversionRate || 0}%`,
      icon: Target,
      description: "Leads omgezet naar klant",
    },
    {
      title: "Klanten",
      value: stats?.convertedLeads || 0,
      icon: UserCheck,
      description: "Totaal geconverteerde leads",
    },
  ];

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="h-4 w-24 bg-muted animate-pulse rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-16 bg-muted animate-pulse rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {statCards.map((stat) => (
        <Card key={stat.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
            <stat.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
            <p className="text-xs text-muted-foreground">{stat.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

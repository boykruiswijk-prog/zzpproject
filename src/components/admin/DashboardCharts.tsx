import { useLeadStats } from "@/hooks/useLeadStats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";

const COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

const statusLabels: Record<string, string> = {
  nieuw: "Nieuw",
  in_behandeling: "In behandeling",
  afspraak_gepland: "Afspraak gepland",
  offerte_verstuurd: "Offerte verstuurd",
  klant: "Klant",
  afgewezen: "Afgewezen",
};

export function DashboardCharts() {
  const { data: stats, isLoading } = useLeadStats();

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {[...Array(2)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <div className="h-5 w-32 bg-muted animate-pulse rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-64 bg-muted animate-pulse rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Prepare status data
  const statusData = Object.entries(stats?.statusCounts || {}).map(([status, count]) => ({
    name: statusLabels[status] || status,
    value: count,
  }));

  // Prepare verzekering data
  const verzekeringData = Object.entries(stats?.verzekeringCounts || {}).map(([type, count]) => ({
    name: type,
    value: count,
  }));

  // Prepare leads over time data
  const leadsOverTime = Object.entries(stats?.leadsPerDay || {})
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14) // Last 14 days
    .map(([date, count]) => ({
      date: new Date(date).toLocaleDateString("nl-NL", { day: "numeric", month: "short" }),
      leads: count,
    }));

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Leads over time */}
      <Card className="col-span-2">
        <CardHeader>
          <CardTitle>Leads per dag (laatste 14 dagen)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            {leadsOverTime.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={leadsOverTime}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="leads"
                    stroke="hsl(var(--accent))"
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--accent))" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                Nog geen data beschikbaar
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Status distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Leads per status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" fontSize={12} />
                  <YAxis dataKey="name" type="category" fontSize={12} width={120} />
                  <Tooltip />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={4} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                Nog geen data beschikbaar
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Verzekering distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Leads per verzekering</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            {verzekeringData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={verzekeringData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }) =>
                      `${name} (${(percent * 100).toFixed(0)}%)`
                    }
                    labelLine={false}
                  >
                    {verzekeringData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                Nog geen data beschikbaar
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const PILOT_LABELS: Record<string, string> = {
  "stroom-2026": "Collectieve Stroom 2026",
  "software-deals": "Collectieve Software Deals",
  "ai-tools-bundel": "Collectieve AI & Tools Bundel",
  telefonie: "Collectieve Telefonie",
};

export function CollectiefAanmeldingenTeller() {
  const { data = [], isLoading } = useQuery({
    queryKey: ["admin-collectief-aanmeldingen"],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("collective_signups")
        .select("pilot_slug");
      if (error) throw error;

      const counts = new Map<string, number>();
      for (const row of rows ?? []) {
        counts.set(row.pilot_slug, (counts.get(row.pilot_slug) ?? 0) + 1);
      }
      return Object.entries(PILOT_LABELS).map(([slug, label]) => ({
        slug,
        label,
        count: counts.get(slug) ?? 0,
      }));
    },
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4 text-muted-foreground" />
          Collectieve aanmeldingen
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-16 animate-pulse rounded bg-muted" />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {data.map((pilot) => (
              <div key={pilot.slug} className="min-w-0 border-l-2 border-accent pl-3">
                <p className="truncate text-sm text-muted-foreground" title={pilot.label}>{pilot.label}</p>
                <p className="text-2xl font-bold text-foreground">{pilot.count}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

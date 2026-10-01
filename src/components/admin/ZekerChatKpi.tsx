import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";

/** Kleine KPI: chatgesprekken vandaag/week en terugbelverzoeken uit de chat (zonder testgesprekken). */
export function ZekerChatKpi() {
  const [k, setK] = useState<{ vandaag: number; week: number; terugbel: number } | null>(null);
  useEffect(() => {
    const dag = new Date(); dag.setHours(0, 0, 0, 0);
    const week = new Date(Date.now() - 7 * 86400_000).toISOString();
    const basis = () => supabase.from("chat_sessions").select("id", { count: "exact", head: true }).eq("is_test", false);
    Promise.all([
      basis().gte("created_at", dag.toISOString()),
      basis().gte("created_at", week),
      basis().gte("created_at", week).not("lead_id", "is", null),
    ]).then(([a, b, c]) => setK({ vandaag: a.count ?? 0, week: b.count ?? 0, terugbel: c.count ?? 0 }));
  }, []);
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-2 py-4">
        <Link to="/admin/chatgesprekken" className="flex items-center gap-2 font-semibold hover:text-primary"><MessageCircle className="h-4 w-4" /> Chat Zeker</Link>
        <span className="text-sm">Vandaag: <strong className="tabular-nums">{k?.vandaag ?? "…"}</strong></span>
        <span className="text-sm">Afgelopen 7 dagen: <strong className="tabular-nums">{k?.week ?? "…"}</strong></span>
        <span className="text-sm">Terugbelverzoeken (7 dagen): <strong className="tabular-nums">{k?.terugbel ?? "…"}</strong></span>
      </CardContent>
    </Card>
  );
}

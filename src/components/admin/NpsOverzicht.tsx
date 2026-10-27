import { useQuery } from "@tanstack/react-query";
import { Smile } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type NpsData = { nps: number | null; antwoorden: number; verstuurd: number; respons_pct: number | null; actief: boolean | null };

/** NPS-tegel (laatste 90 dagen), alleen supervisor/admin met tweestapscode. Nooit op /tv of /scherm. */
export function NpsOverzicht() {
  const { isSupervisorOrAdmin, isAal2, user } = useAuth();
  const enabled = isSupervisorOrAdmin && isAal2;
  const { data, isError } = useQuery({
    queryKey: ["nps-overzicht", user?.id], enabled, retry: 1,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("nps_overzicht");
      if (error) throw new Error(error.message);
      return data as unknown as NpsData;
    },
  });
  if (!enabled) return null;
  return (
    <Card className="min-w-0" aria-label="NPS-overzicht">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">NPS (90 dagen)</CardTitle>
        <Smile className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isError ? <p role="alert" className="text-sm text-destructive">NPS kon niet worden geladen</p> : !data ? <div className="text-2xl font-bold">…</div> : <>
          <div className="text-2xl font-bold tabular-nums">{data.nps === null ? "Nog geen antwoorden" : data.nps}</div>
          <p className="text-xs text-muted-foreground">
            {data.antwoorden} antwoorden · respons {data.respons_pct === null ? "n.v.t." : `${data.respons_pct.toLocaleString("nl-NL")}%`}
          </p>
          {data.actief === false && <p className="text-xs text-muted-foreground">Verzending staat uit</p>}
        </>}
      </CardContent>
    </Card>
  );
}

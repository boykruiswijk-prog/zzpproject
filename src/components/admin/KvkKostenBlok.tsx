import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Overzicht = { betaald: number; kosten_bevragingen: number; cache: number; geweigerd: number; vandaag_betaald: number; abonnement: number; dag_limiet: number; maand_limiet: number; aan: boolean };
const euro = (n: number) => `EUR ${Number(n ?? 0).toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** KVK API deze maand: betaalde bevragingen, geschatte kosten en cachetreffers (A12). */
export function KvkKostenBlok() {
  const q = useQuery({
    queryKey: ["kvk-kosten"],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("kvk_kosten_overzicht");
      if (error) throw error;
      return data as Overzicht;
    },
  });
  const o = q.data;
  return (
    <Card>
      <CardHeader><CardTitle className="flex flex-wrap items-center gap-2">KVK API deze maand
        {o && <Badge variant={o.aan ? "default" : "secondary"}>{o.aan ? "Aan" : "Uit"}</Badge>}</CardTitle></CardHeader>
      <CardContent className="space-y-1 text-sm">
        {q.isError && <p className="text-destructive">Overzicht niet beschikbaar.</p>}
        {o && <>
          <p>Betaalde bevragingen: <strong>{o.betaald}</strong> (vandaag {o.vandaag_betaald}; limiet {o.dag_limiet} per dag, {o.maand_limiet} per maand)</p>
          <p>Geschatte kosten: <strong>{euro(Number(o.kosten_bevragingen) + Number(o.abonnement))}</strong> ({euro(o.kosten_bevragingen)} bevragingen + {euro(o.abonnement)} abonnement)</p>
          <p>Uit de bewaarde kopie, zonder kosten: <strong>{o.cache}</strong></p>
          <p className="text-muted-foreground">Niet bevraagd (uit, geen sleutel, limiet of ongeldig nummer): {o.geweigerd}</p>
        </>}
      </CardContent>
    </Card>
  );
}

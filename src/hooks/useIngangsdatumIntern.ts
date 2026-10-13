import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Heeft het team de ingangsdatum van deze aanvraag intern gezet (activiteiten_log 'ingangsdatum_gewijzigd')? */
export function useIngangsdatumInternGezet(leadId: string | undefined) {
  const q = useQuery({
    queryKey: ["ingangsdatum-intern", leadId],
    enabled: !!leadId,
    queryFn: async () => {
      const { count, error } = await supabase.from("activiteiten_log").select("id", { count: "exact", head: true })
        .eq("lead_id", leadId!).eq("actie_type", "ingangsdatum_gewijzigd");
      if (error) throw error;
      return (count ?? 0) > 0;
    },
  });
  return q.data === true;
}

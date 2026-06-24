import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Telt openstaande admin-taken (polling 60s):
 *  - Lifecycle-acties met succes=false uit de laatste 7 dagen
 *  - Leads gepauzeerd > 90 dagen zonder reminder verzonden
 */
export function useAdminTakenCount() {
  return useQuery({
    queryKey: ["admin-taken-count"],
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      const [{ count: failed }, { count: oldPaused }] = await Promise.all([
        supabase.from("polis_audit_log").select("id", { count: "exact", head: true })
          .eq("succes", false).gte("created_at", sevenDaysAgo),
        supabase.from("leads").select("id", { count: "exact", head: true })
          .eq("status", "gepauzeerd").lte("pauze_start_datum", ninetyDaysAgo)
          .is("pauze_reminder_verzonden_op", null),
      ]);
      return (failed ?? 0) + (oldPaused ?? 0);
    },
  });
}

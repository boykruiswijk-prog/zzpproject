import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Openstaande items per menu-item, alleen op status (RPC menu_tellers, zonder testdata). Ververst elke minuut. */
export function useMenuTellers() {
  return useQuery({
    queryKey: ["menu-tellers"],
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("menu_tellers");
      if (error) throw error;
      return data as Record<string, number>;
    },
  });
}

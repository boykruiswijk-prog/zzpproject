import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePortalAuth } from "@/contexts/PortalAuthContext";

export function usePortalPolicies() {
  const { user } = usePortalAuth();
  return useQuery({
    queryKey: ["portal-policies", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("policies")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

export function usePortalInvoices() {
  const { user } = usePortalAuth();
  return useQuery({
    queryKey: ["portal-invoices", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("user_id", user!.id)
        .neq("status", "legacy_void")
        .order("invoice_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },

  });
}

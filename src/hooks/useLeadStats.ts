import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useLeadStats() {
  return useQuery({
    queryKey: ["lead-stats"],
    queryFn: async () => {
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);

      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // Total leads
      const { count: totalLeads } = await supabase
        .from("leads")
        .select("*", { count: "exact", head: true });

      // New leads this week
      const { count: newLeadsWeek } = await supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .gte("created_at", startOfWeek.toISOString());

      // New leads this month
      const { count: newLeadsMonth } = await supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .gte("created_at", startOfMonth.toISOString());

      // Converted leads (status = 'klant')
      const { count: convertedLeads } = await supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .eq("status", "klant");

      // Leads by status
      const { data: allLeads } = await supabase.from("leads").select("status, verzekering_type, created_at");

      const statusCounts: Record<string, number> = {};
      const verzekeringCounts: Record<string, number> = {};
      
      allLeads?.forEach((lead) => {
        statusCounts[lead.status] = (statusCounts[lead.status] || 0) + 1;
        if (lead.verzekering_type) {
          verzekeringCounts[lead.verzekering_type] = (verzekeringCounts[lead.verzekering_type] || 0) + 1;
        }
      });

      // Leads per day for the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const leadsPerDay: Record<string, number> = {};
      allLeads?.forEach((lead) => {
        const date = new Date(lead.created_at).toISOString().split("T")[0];
        if (new Date(lead.created_at) >= thirtyDaysAgo) {
          leadsPerDay[date] = (leadsPerDay[date] || 0) + 1;
        }
      });

      const conversionRate = totalLeads && totalLeads > 0 
        ? ((convertedLeads || 0) / totalLeads) * 100 
        : 0;

      return {
        totalLeads: totalLeads || 0,
        newLeadsWeek: newLeadsWeek || 0,
        newLeadsMonth: newLeadsMonth || 0,
        convertedLeads: convertedLeads || 0,
        conversionRate: Math.round(conversionRate * 10) / 10,
        statusCounts,
        verzekeringCounts,
        leadsPerDay,
      };
    },
  });
}

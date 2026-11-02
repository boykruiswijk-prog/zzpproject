import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { LEAD_KOLOMMEN, metIbanMasker } from "@/lib/veiligeKolommen";

type Lead = Database["public"]["Tables"]["leads"]["Row"];
type LeadInsert = Database["public"]["Tables"]["leads"]["Insert"];
type LeadUpdate = Database["public"]["Tables"]["leads"]["Update"];
type LeadStatus = Database["public"]["Enums"]["lead_status"];

export function useLeads(filters?: {
  status?: LeadStatus;
  verzekeringType?: string;
  type?: string;
  assignedTo?: string;
  search?: string;
  toonTest?: boolean;
  toonAfgerond?: boolean;
  soort?: "aanvragen" | "leads";
}) {
  return useQuery({
    queryKey: ["leads", filters],
    placeholderData: (previousData) => previousData,
    queryFn: async () => {
      let query = supabase
        .from("leads")
        .select(LEAD_KOLOMMEN)
        .order("created_at", { ascending: false });

      if (!filters?.toonTest) {
        query = query.eq("is_test", false);
      }
      if (filters?.status) {
        query = query.eq("status", filters.status);
      } else if (!filters?.toonAfgerond) {
        query = query.not("status", "in", "(afgerond,klant_geworden,geen_interesse,vraag_beantwoord)");
      }
      if (filters?.verzekeringType) {
        query = query.eq("verzekering_type", filters.verzekeringType);
      }
      if (filters?.type) {
        query = query.eq("type", filters.type as Database["public"]["Enums"]["lead_type"]);
      }
      if (filters?.soort === "aanvragen") query = query.eq("type", "verzekering_aanvraag");
      if (filters?.soort === "leads") query = query.neq("type", "verzekering_aanvraag");
      if (filters?.assignedTo) {
        query = query.eq("assigned_to", filters.assignedTo);
      }
      if (filters?.search) {
        query = query.or(
          `voornaam.ilike.%${filters.search}%,achternaam.ilike.%${filters.search}%,email.ilike.%${filters.search}%,bedrijfsnaam.ilike.%${filters.search}%`
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Lead[];
    },
  });
}

export function useLead(id: string | undefined) {
  return useQuery({
    queryKey: ["lead", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("leads")
        .select(LEAD_KOLOMMEN)
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;
      // IBAN alleen gemaskeerd plus geldigheid; volledig via de knop met logboek.
      const [metMasker] = await metIbanMasker("lead", [data as unknown as { id: string }]);
      return metMasker as unknown as Lead & { iban_geldig: boolean };
    },
    enabled: !!id,
  });
}

export function useCreateLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (lead: LeadInsert) => {
      const { data, error } = await supabase
        .from("leads")
        .insert(lead)
        .select(LEAD_KOLOMMEN)
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });
}

export function useUpdateLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: LeadUpdate }) => {
      const { data, error } = await supabase
        .from("leads")
        .update(updates)
        .eq("id", id)
        .select(LEAD_KOLOMMEN)
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["lead", data.id] });
    },
  });
}

export function useDeleteLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("leads").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });
}

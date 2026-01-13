import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type LeadNote = Database["public"]["Tables"]["lead_notes"]["Row"];
type LeadNoteInsert = Database["public"]["Tables"]["lead_notes"]["Insert"];

export function useLeadNotes(leadId: string | undefined) {
  return useQuery({
    queryKey: ["lead-notes", leadId],
    queryFn: async () => {
      if (!leadId) return [];
      const { data, error } = await supabase
        .from("lead_notes")
        .select("*")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as LeadNote[];
    },
    enabled: !!leadId,
  });
}

export function useCreateLeadNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (note: LeadNoteInsert) => {
      const { data, error } = await supabase
        .from("lead_notes")
        .insert(note)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["lead-notes", data.lead_id] });
    },
  });
}

export function useDeleteLeadNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, leadId }: { id: string; leadId: string }) => {
      const { error } = await supabase.from("lead_notes").delete().eq("id", id);
      if (error) throw error;
      return leadId;
    },
    onSuccess: (leadId) => {
      queryClient.invalidateQueries({ queryKey: ["lead-notes", leadId] });
    },
  });
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DbaBatch {
  id: string;
  name: string;
  zip_file_url: string | null;
  zip_filename: string | null;
  total_candidates: number;
  processed_count: number;
  certified_count: number;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export function useDbaBatches() {
  return useQuery({
    queryKey: ["dba-batches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dba_batches")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as DbaBatch[];
    },
  });
}

export function useDbaBatch(id: string | undefined) {
  return useQuery({
    queryKey: ["dba-batch", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("dba_batches")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as DbaBatch | null;
    },
    enabled: !!id,
  });
}

export function useBatchChecks(batchId: string | undefined) {
  return useQuery({
    queryKey: ["dba-batch-checks", batchId],
    queryFn: async () => {
      if (!batchId) return [];
      const { data, error } = await supabase
        .from("dba_checks")
        .select("*")
        .eq("batch_id", batchId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!batchId,
    refetchInterval: 5000, // Poll for updates during processing
  });
}

export function useBulkDba() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ batchId, action }: { batchId: string; action: "process" | "analyze_all" }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bulk-dba`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ batch_id: batchId, action }),
        }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Fout bij bulk verwerking");
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dba-batches"] });
      queryClient.invalidateQueries({ queryKey: ["dba-batch"] });
      queryClient.invalidateQueries({ queryKey: ["dba-batch-checks"] });
      queryClient.invalidateQueries({ queryKey: ["dba-checks"] });
    },
  });
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DbaCheck {
  id: string;
  lead_id: string | null;
  client_name: string;
  project_description: string | null;
  uploaded_file_url: string | null;
  original_filename: string | null;
  extracted_text: string | null;
  missing_fields: string[];
  field_results: FieldResult[];
  suggestions: any[];
  rewritten_description: string | null;
  status: string;
  certificate_number: string | null;
  certificate_pdf_url: string | null;
  verification_token: string | null;
  certified_at: string | null;
  certified_by: string | null;
  kvk_file_url: string | null;
  kvk_filename: string | null;
  kvk_text: string | null;
  kvk_check_result: KvkCheckResult | null;
  created_at: string;
  updated_at: string;
}

export interface KvkCheckResult {
  match: boolean;
  kvk_activities: string;
  work_description: string;
  explanation: string;
  suggestions?: string[];
}

export interface FieldResult {
  field_name: string;
  present?: boolean;
  filled?: boolean;
  excerpt?: string;
  value?: string;
  issue?: string;
}

export interface DbaCheckField {
  id: string;
  field_name: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export function useDbaChecks() {
  return useQuery({
    queryKey: ["dba-checks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dba_checks")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as DbaCheck[];
    },
  });
}

export function useDbaCheck(id: string | undefined) {
  return useQuery({
    queryKey: ["dba-check", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("dba_checks")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as DbaCheck | null;
    },
    enabled: !!id,
  });
}

export function useDbaCheckFields() {
  return useQuery({
    queryKey: ["dba-check-fields"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dba_check_fields")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data as unknown as DbaCheckField[];
    },
  });
}

export function useCreateDbaCheck() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (check: {
      client_name: string;
      project_description?: string | null;
      uploaded_file_url?: string | null;
      original_filename?: string | null;
      extracted_text?: string | null;
      lead_id?: string;
      kvk_file_url?: string | null;
      kvk_filename?: string | null;
      kvk_text?: string | null;
    }) => {
      const { data, error } = await supabase
        .from("dba_checks")
        .insert(check as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as DbaCheck;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dba-checks"] });
    },
  });
}

export function useAnalyzeDba() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ checkId, action }: { checkId: string; action: "analyze" | "rewrite" | "certify" | "check_kvk" }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-dba`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ check_id: checkId, action }),
        }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Fout bij analyse");
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dba-checks"] });
      queryClient.invalidateQueries({ queryKey: ["dba-check"] });
    },
  });
}

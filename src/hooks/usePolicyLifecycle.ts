import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePortalAuth } from "@/contexts/PortalAuthContext";

export type LifecycleAction =
  | "pauzeren" | "hervatten" | "opzeggen"
  | "heractiveren_check" | "heractiveren_confirm";

export interface LifecyclePayload {
  action: LifecycleAction;
  lead_id: string;
  reden?: string;
  toelichting?: string;
  pauze_toelichting?: string;
  nieuwe_functie?: string;
}

export function usePolicyLifecycle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: LifecyclePayload) => {
      const { data, error } = await supabase.functions.invoke("polis-lifecycle", { body: payload });
      if (error) throw error;
      if (data?.error) throw new Error(data.error + (data.message ? `: ${data.message}` : ""));
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portal-lead"] });
      qc.invalidateQueries({ queryKey: ["portal-policies"] });
      qc.invalidateQueries({ queryKey: ["polis-audit-log"] });
      qc.invalidateQueries({ queryKey: ["lead"] });
    },
  });
}

// Haal de actieve lead op voor de ingelogde portaal-gebruiker (status, pauze-info etc.)
export function usePortalLead() {
  const { user } = usePortalAuth();
  return useQuery({
    queryKey: ["portal-lead", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: pol } = await supabase
        .from("policies").select("lead_id").eq("user_id", user!.id).limit(1).maybeSingle();
      if (!pol?.lead_id) return null;
      const { data: lead, error } = await supabase
        .from("leads").select("*").eq("id", pol.lead_id).single();
      if (error) throw error;
      return lead;
    },
  });
}

export function usePolicyAuditLog(leadId: string | undefined) {
  return useQuery({
    queryKey: ["polis-audit-log", leadId],
    enabled: !!leadId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("polis_audit_log").select("*")
        .eq("lead_id", leadId!).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

// Live pro-rata preview voor pauze/hervat-modal (geen Exact-mutatie).
export function usePauzePreview(leadId: string | undefined, action: "pauze" | "hervat" = "pauze", enabled = true) {
  return useQuery({
    queryKey: ["pauze-preview", leadId, action],
    enabled: !!leadId && enabled,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("calculate-pauze-preview", {
        body: { lead_id: leadId, action },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as {
        ok: boolean; action: "pauze" | "hervat";
        credit_bedrag?: number; factuur_bedrag?: number;
        resterende_dagen: number; dagprijs: number;
        polis_einddatum: string; jaarprijs: number;
      };
    },
  });
}

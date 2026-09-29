import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send, AlertTriangle } from "lucide-react";
import { logActiviteit } from "@/lib/activiteitenLog";
import { formatDateTimeLongNL } from "@/lib/dateFormat";

interface Props {
  leadId: string;
  email: string;
}

interface PortalStatus {
  uitgenodigd_op?: string | null;
  laatst_ingelogd?: string | null;
  laatste_fout?: { op: string; melding: string | null } | null;
}

export function PortalInviteButton({ leadId, email }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [sending, setSending] = useState(false);

  const { data: status } = useQuery({
    queryKey: ["portal-status", leadId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_portal_status", { _lead_id: leadId });
      if (error) throw error;
      return (data ?? {}) as PortalStatus;
    },
  });

  const handleInvite = async () => {
    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-portal-invite`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ lead_id: leadId }),
        }
      );
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Fout bij versturen");
      toast({ title: "Uitnodiging verstuurd", description: `Naar ${email}` });
      await logActiviteit({
        actie_type: "portaal_invite_verstuurd",
        omschrijving: `Portaaluitnodiging verstuurd naar ${email}`,
        lead_id: leadId,
        klant_email: email,
      });
    } catch (e: any) {
      toast({ title: "Fout", description: e.message, variant: "destructive" });
    } finally {
      setSending(false);
      qc.invalidateQueries({ queryKey: ["portal-status", leadId] });
    }
  };

  let regel = "Mijn ZP: nog niet uitgenodigd";
  if (status?.laatst_ingelogd) regel = `Mijn ZP: account actief (laatst ingelogd ${formatDateTimeLongNL(status.laatst_ingelogd)})`;
  else if (status?.uitgenodigd_op) regel = `Mijn ZP: uitgenodigd op ${formatDateTimeLongNL(status.uitgenodigd_op)}`;

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">{regel}</p>
      {status?.laatste_fout && (
        <p className="text-xs text-destructive flex gap-1.5 items-start">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            Uitnodigen mislukt op {formatDateTimeLongNL(status.laatste_fout.op)}: {status.laatste_fout.melding ?? "onbekende fout"}
          </span>
        </p>
      )}
      <Button variant="outline" className="w-full" onClick={handleInvite} disabled={sending}>
        {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
        Uitnodiging (opnieuw) versturen
      </Button>
    </div>
  );
}

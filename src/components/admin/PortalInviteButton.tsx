import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send } from "lucide-react";

interface Props {
  leadId: string;
  email: string;
}

export function PortalInviteButton({ leadId, email }: Props) {
  const { toast } = useToast();
  const [sending, setSending] = useState(false);

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
          body: JSON.stringify({ lead_id: leadId, email }),
        }
      );
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Fout bij versturen");
      toast({
        title: "Uitnodiging verstuurd",
        description: `Naar ${email}`,
      });
    } catch (e: any) {
      toast({ title: "Fout", description: e.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <Button variant="outline" className="w-full" onClick={handleInvite} disabled={sending}>
      {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
      Klantportaal uitnodiging versturen
    </Button>
  );
}

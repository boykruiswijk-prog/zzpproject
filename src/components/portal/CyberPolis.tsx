import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CYBER_DEKKING, CYBER_HULP, CYBER_POLISVOORWAARDEN, CYBER_LOOPTIJD } from "../../../supabase/functions/_shared/cyber";
import { formatDateNL } from "@/lib/dateFormat";
type CyberPolisRij = { lead_id: string; ingang: string; eind: string; pakket: string };
export function CyberPolis({ leadId }: { leadId?: string }) {
  const { data } = useQuery({ queryKey: ["mijn-cyber-polissen"], queryFn: async () => { const { data, error } = await supabase.rpc("mijn_cyber_polissen"); if (error) throw error; return data as unknown as CyberPolisRij[]; } });
  const rijen = (data ?? []).filter((r) => !leadId || r.lead_id === leadId);
  return <>{rijen.map((r) => <div key={r.lead_id} className="border-t border-border mt-4 pt-4 space-y-2 text-sm">
    <h3 className="font-semibold">Cyberdekking</h3><p>Ingang {formatDateNL(r.ingang)} · einde lopend cyberjaar {formatDateNL(r.eind)}</p>
    <p>{CYBER_DEKKING}</p><p>{CYBER_HULP}</p><p>{CYBER_LOOPTIJD}</p><p>{CYBER_POLISVOORWAARDEN}</p>
  </div>)}</>;
}
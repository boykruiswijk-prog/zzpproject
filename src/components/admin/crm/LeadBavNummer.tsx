import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { kiesBavNummer, useBavRijen } from "@/lib/bavNummer";
import { BavNummer } from "./BavNummer";

/** BAV-nummer bij een lead: eigen certificaat, anders via de gekoppelde onderneming (relatiecode of persoon). */
export function LeadBavNummer({ leadId, relatiecode }: { leadId: string; relatiecode?: string | null }) {
  const onds = useQuery({
    queryKey: ["lead-onderneming", leadId, relatiecode],
    queryFn: async () => {
      const ids = new Set<string>();
      if (relatiecode) for (const o of (await supabase.from("ondernemingen").select("id").eq("exact_relatie_code", relatiecode)).data ?? []) ids.add(o.id);
      const kop = (await supabase.from("persoon_bron_koppeling").select("persoon_id").eq("bron_tabel", "leads").eq("bron_id", leadId)).data ?? [];
      if (kop.length) for (const x of (await supabase.from("persoon_onderneming").select("onderneming_id").in("persoon_id", kop.map((k) => k.persoon_id))).data ?? []) ids.add(x.onderneming_id);
      return Array.from(ids);
    },
  });
  const { data } = useBavRijen(onds.data ?? [], [leadId]);
  if (!data || !onds.data) return null;
  return <div className="mt-1"><BavNummer keuze={kiesBavNummer(data)} /></div>;
}

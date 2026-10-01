import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

/** Toont links naar de klantdetailpagina('s) die bij deze lead horen (via persoonslaag of relatiecode). */
export function KlantLinkVoorLead({ leadId, relatiecode }: { leadId: string; relatiecode?: string | null }) {
  const [klanten, setKlanten] = useState<{ id: string; naam: string | null }[]>([]);
  useEffect(() => {
    (async () => {
      const ids = new Set<string>();
      const { data: kop } = await supabase.from("persoon_bron_koppeling").select("persoon_id").eq("bron_tabel", "leads").eq("bron_id", leadId);
      const pids = (kop ?? []).map((k) => k.persoon_id);
      if (pids.length) {
        const { data: po } = await supabase.from("persoon_onderneming").select("onderneming_id").in("persoon_id", pids);
        (po ?? []).forEach((x) => ids.add(x.onderneming_id));
      }
      let q = supabase.from("ondernemingen").select("id,naam,exact_relatie_code");
      const lijst: any[] = [];
      if (ids.size) lijst.push(...(((await q.in("id", Array.from(ids))).data ?? []) as any[]).filter((o) => o.exact_relatie_code));
      if (relatiecode) { q = supabase.from("ondernemingen").select("id,naam,exact_relatie_code"); lijst.push(...((await q.eq("exact_relatie_code", relatiecode)).data ?? [])); }
      const uniek = new Map(lijst.map((o) => [o.id, o]));
      setKlanten(Array.from(uniek.values()));
    })();
  }, [leadId, relatiecode]);
  if (klanten.length === 0) return null;
  return (
    <p className="text-sm">
      Klant:{" "}
      {klanten.map((k, i) => (
        <span key={k.id}>{i > 0 && ", "}<Link to={`/admin/klanten/${k.id}`} className="font-medium hover:text-primary">{k.naam || "Klantdetail"}</Link></span>
      ))}
    </p>
  );
}

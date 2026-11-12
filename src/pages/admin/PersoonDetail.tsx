import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAdminDetailTitel } from "@/lib/adminTitels";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2 } from "lucide-react";
import { CrmTijdlijn } from "@/components/admin/crm/CrmTijdlijn";
import { KlantKaart } from "@/components/admin/crm/KlantKaart";
import { LopendeProducten } from "@/components/admin/crm/LopendeProducten";
import { PersoonOndernemingen } from "@/components/admin/crm/PersoonOndernemingen";

export default function PersoonDetail() {
  const { id } = useParams();
  const [laden, setLaden] = useState(true);
  const [persoon, setPersoon] = useState<any>(null);
  const [onds, setOnds] = useState<any[]>([]);
  const [leadIds, setLeadIds] = useState<string[]>([]);
  const [herlaad, setHerlaad] = useState(0);

  useEffect(() => {
    let actief = true;
    if (persoon && persoon.id !== id) { setPersoon(null); setOnds([]); setLeadIds([]); }
    (async () => {
      setLaden(true);
      const [p, po, kop] = await Promise.all([
        supabase.from("personen").select("*").eq("id", id!).maybeSingle(),
        supabase.from("persoon_onderneming").select("onderneming_id, ondernemingen(id,naam,rechtsvorm,kvk,exact_relatie_code)").eq("persoon_id", id!),
        supabase.from("persoon_bron_koppeling").select("bron_id").eq("bron_tabel", "leads").eq("persoon_id", id!),
      ]);
      if (!actief) return;
      setPersoon(p.data);
      setOnds(((po.data ?? []) as any[]).map((x) => x.ondernemingen).filter(Boolean));
      setLeadIds(((kop.data ?? []) as any[]).map((x) => x.bron_id));
      setLaden(false);
    })();
    return () => { actief = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, herlaad]);

  const naam = persoon ? [persoon.voornaam, persoon.achternaam].filter(Boolean).join(" ") || persoon.email_weergave || "Persoon" : "Persoon";

  const juistePersoon = !!persoon && persoon.id === id;
  useAdminDetailTitel(juistePersoon ? naam : null, id, persoon?.id);

  return (
    <AdminLayout>
            <div className="min-w-0 space-y-6">
        <Link to="/admin/crm" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" /> CRM</Link>
        {laden || (persoon && !juistePersoon) ? <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin" /></div> : !persoon ? <p>Persoon niet gevonden.</p> : (
          <>
            <div>
              <h1 className="break-words text-2xl font-bold">{naam}</h1>
              <p className="break-words text-sm text-muted-foreground">{persoon.email_weergave}{persoon.is_test ? " · testrecord" : ""}</p>
            </div>
            <KlantKaart ondernemingen={onds} personen={[persoon]} leadIds={leadIds} herlaadSleutel={herlaad} onGewijzigd={() => setHerlaad((h) => h + 1)} />
            <PersoonOndernemingen persoonId={persoon.id} ondernemingen={onds} onGewijzigd={() => setHerlaad((h) => h + 1)} />
            {onds.map((o) => <LopendeProducten key={o.id + herlaad} ondernemingId={o.id} ondernemingNaam={o.naam} leadIds={leadIds} persoonId={persoon.id} onGewijzigd={() => setHerlaad((x) => x + 1)} />)}
            <CrmTijdlijn ondernemingen={onds.map((o) => ({ id: o.id, naam: o.naam }))} personen={[{ id: persoon.id, naam }]}
              invoerDoel={{ persoon_id: persoon.id }} herlaadSleutel={herlaad} />
          </>
        )}
      </div>
    </AdminLayout>
  );
}

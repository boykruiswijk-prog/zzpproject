import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useParams } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2 } from "lucide-react";
import { CrmTijdlijn } from "@/components/admin/crm/CrmTijdlijn";
import { LopendeProducten } from "@/components/admin/crm/LopendeProducten";

export default function PersoonDetail() {
  const { id } = useParams();
  const [laden, setLaden] = useState(true);
  const [persoon, setPersoon] = useState<any>(null);
  const [onds, setOnds] = useState<any[]>([]);
  const [leadIds, setLeadIds] = useState<string[]>([]);
  const [herlaad, setHerlaad] = useState(0);

  useEffect(() => {
    (async () => {
      setLaden(true);
      const [p, po, kop] = await Promise.all([
        supabase.from("personen").select("*").eq("id", id!).maybeSingle(),
        supabase.from("persoon_onderneming").select("onderneming_id, ondernemingen(id,naam,rechtsvorm,kvk,exact_relatie_code)").eq("persoon_id", id!),
        supabase.from("persoon_bron_koppeling").select("bron_id").eq("bron_tabel", "leads").eq("persoon_id", id!),
      ]);
      setPersoon(p.data);
      setOnds(((po.data ?? []) as any[]).map((x) => x.ondernemingen).filter(Boolean));
      setLeadIds(((kop.data ?? []) as any[]).map((x) => x.bron_id));
      setLaden(false);
    })();
  }, [id]);

  const naam = persoon ? [persoon.voornaam, persoon.achternaam].filter(Boolean).join(" ") || persoon.email_weergave || "Persoon" : "Persoon";

  return (
    <AdminLayout>
      <Helmet><title>{naam} | ZP Zaken beheer</title></Helmet>
      <div className="min-w-0 space-y-6">
        <Link to="/admin/crm" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" /> CRM</Link>
        {laden ? <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin" /></div> : !persoon ? <p>Persoon niet gevonden.</p> : (
          <>
            <div>
              <h1 className="break-words text-2xl font-bold">{naam}</h1>
              <p className="break-words text-sm text-muted-foreground">{persoon.email_weergave}{persoon.is_test ? " · testrecord" : ""}</p>
            </div>
            <Card><CardHeader><CardTitle className="text-base">Ondernemingen</CardTitle></CardHeader><CardContent className="space-y-1 text-sm">
              {onds.length === 0 ? <p className="text-muted-foreground">Niet gekoppeld aan een onderneming.</p> :
                onds.map((o) => <Link key={o.id} to={`/admin/klanten/${o.id}`} className="block truncate font-medium hover:text-primary">{o.naam} <span className="text-xs font-normal text-muted-foreground">{o.rechtsvorm ?? ""} {o.kvk ? `· KvK ${o.kvk}` : ""}</span></Link>)}
            </CardContent></Card>
            {onds.map((o) => <LopendeProducten key={o.id + herlaad} ondernemingId={o.id} ondernemingNaam={o.naam} leadIds={leadIds} persoonId={persoon.id} onGewijzigd={() => setHerlaad((x) => x + 1)} />)}
            <CrmTijdlijn ondernemingen={onds.map((o) => ({ id: o.id, naam: o.naam }))} personen={[{ id: persoon.id, naam }]}
              invoerDoel={{ persoon_id: persoon.id }} herlaadSleutel={herlaad} />
          </>
        )}
      </div>
    </AdminLayout>
  );
}

import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { zoekUniverseel, type ZoekResultaat } from "@/components/admin/UniverseleZoeker";
import { useToonTestrecords } from "@/hooks/useToonTestrecords";
import { Badge } from "@/components/ui/badge";

export default function ZoekRecord() {
  const { bron, id } = useParams();
  const { toonTest } = useToonTestrecords();
  const [record, setRecord] = useState<ZoekResultaat | null>(null);
  const [fout, setFout] = useState<string | null>(null);
  const [laden, setLaden] = useState(true);
  useEffect(() => {
    let weg = false;
    if (!id || !bron) { setLaden(false); return; }
    setLaden(true);
    zoekUniverseel(id, toonTest).then(groepen => {
      if (!weg) setRecord(Object.values(groepen).flat().find(r => r.bron === bron && r.bron_id === id) ?? null);
    }).catch(e => { if (!weg) setFout(e.message ?? "Laden mislukt"); })
      .finally(() => { if (!weg) setLaden(false); });
    return () => { weg = true; };
  }, [bron, id, toonTest]);
  return <AdminLayout>
    {laden ? <p>Laden...</p> : fout ? <p role="alert" className="text-destructive">{fout}</p> : !record ? <p>Geen toegankelijk record gevonden.</p> : <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{record.titel || "Contactgegevens"}</h1>
      <div className="flex flex-wrap gap-2">{record.status && <Badge variant="outline">{record.status}</Badge>}{record.is_test && <Badge variant="secondary">Test</Badge>}</div>
      <dl className="grid grid-cols-[auto,1fr] gap-x-6 gap-y-2 text-sm">
        {[["E-mail",record.email],["Telefoon",record.telefoon],["KvK",record.kvk],["Exact-relatiecode",record.exact_relatie_code],["IBAN",record.iban]].filter(([,v]) => v).map(([label,v]) => <div key={label} className="contents"><dt className="text-muted-foreground">{label}</dt><dd className="break-all">{v}</dd></div>)}
      </dl>
      {record.onderneming_id && <Link className="text-primary underline" to={`/admin/klanten/${record.onderneming_id}`}>Open klantkaart</Link>}
      {record.lead_link && <Link className="ml-4 text-primary underline" to={record.lead_link}>Open aanvraag of lead</Link>}
    </div>}
  </AdminLayout>;
}
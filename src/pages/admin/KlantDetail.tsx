import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useParams } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2 } from "lucide-react";
import { formatDateNL } from "@/lib/dateFormat";
import { CONTRACT_STATUS_LABEL, PRODUCT_LABEL, formatEuro, maskeerIban, periodeBedrag, type Product } from "@/lib/klantContracten";
import { FacturatieUitBanner } from "./KlantenContracten";

export default function KlantDetail() {
  const { id } = useParams();
  const [laden, setLaden] = useState(true);
  const [ond, setOnd] = useState<any>(null);
  const [contracten, setContracten] = useState<any[]>([]);
  const [personen, setPersonen] = useState<any[]>([]);
  const [mandaat, setMandaat] = useState<any>(null);
  const [leadMatch, setLeadMatch] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      setLaden(true);
      const { data: o } = await supabase.from("ondernemingen").select("*").eq("id", id!).maybeSingle();
      setOnd(o);
      if (o) {
        const [k, po, m, l] = await Promise.all([
          supabase.from("klant_contracten").select("*").eq("onderneming_id", o.id).order("bron_rij"),
          supabase.from("persoon_onderneming").select("persoon_id, personen(id,voornaam,achternaam,email_weergave)").eq("onderneming_id", o.id),
          o.exact_relatie_code ? supabase.from("klant_mandaat_v").select("*").eq("relatiecode", o.exact_relatie_code).maybeSingle() : Promise.resolve({ data: null }),
          o.exact_relatie_code ? supabase.from("leads").select("id,voornaam,achternaam,status").eq("exact_relatie_code", o.exact_relatie_code) : Promise.resolve({ data: [] }),
        ]);
        setContracten(k.data ?? []);
        setPersonen(((po.data ?? []) as any[]).map((x) => x.personen).filter(Boolean));
        setMandaat(m.data); setLeadMatch((l.data as any[]) ?? []);
      }
      setLaden(false);
    })();
  }, [id]);

  return (
    <AdminLayout>
      <Helmet><title>{ond?.naam ?? "Klant"} | ZP Zaken beheer</title></Helmet>
      <div className="space-y-6 min-w-0">
        <Link to="/admin/klanten" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" /> Klanten & contracten</Link>
        <FacturatieUitBanner />
        {laden ? <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin" /></div> : !ond ? <p>Klant niet gevonden.</p> : (
          <>
            <div>
              <h1 className="text-2xl font-bold break-words">{ond.naam}</h1>
              <p className="text-sm text-muted-foreground">Relatiecode {ond.exact_relatie_code} · bron {ond.bron}</p>
              {ond.afwijkingen?.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{ond.afwijkingen.map((a: string) => <Badge key={a} variant="outline" className="border-amber-500 text-amber-700">{a}</Badge>)}</div>}
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              <Card><CardHeader><CardTitle className="text-base">Contactpersonen</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">
                {personen.length === 0 && <p className="text-muted-foreground">Geen e-mailadres bekend.</p>}
                {personen.map((p) => <div key={p.id} className="min-w-0"><div className="truncate">{[p.voornaam, p.achternaam].filter(Boolean).join(" ") || "—"}</div><div className="truncate text-muted-foreground" title={p.email_weergave}>{p.email_weergave}</div></div>)}
              </CardContent></Card>
              <Card><CardHeader><CardTitle className="text-base">Mandaat (alleen lezen)</CardTitle></CardHeader><CardContent className="text-sm">
                {mandaat ? <div className="space-y-1"><div>IBAN {maskeerIban(mandaat.iban)}</div><div className="text-muted-foreground">Kenmerk {mandaat.kenmerk} · ondertekend {formatDateNL(mandaat.ondertekend_op)}</div></div> : <p className="text-muted-foreground">Geen mandaat gevonden.</p>}
              </CardContent></Card>
              <Card><CardHeader><CardTitle className="text-base">Mogelijke match</CardTitle></CardHeader><CardContent className="text-sm">
                {leadMatch.length === 0 ? <p className="text-muted-foreground">Geen lead met deze relatiecode.</p> :
                  leadMatch.map((l) => <Link key={l.id} to={`/admin/leads/${l.id}`} className="block hover:text-primary">{l.voornaam} {l.achternaam}</Link>)}
                <p className="mt-2 text-xs text-muted-foreground">Alleen ter informatie; er wordt niets automatisch gekoppeld.</p>
              </CardContent></Card>
            </div>
            <Card><CardHeader><CardTitle className="text-base">Contractregels en planning</CardTitle></CardHeader><CardContent className="overflow-x-auto">
              <table className="w-full text-sm min-w-[900px]">
                <thead><tr className="text-left text-muted-foreground"><th className="p-2 font-normal">Rij</th><th className="p-2 font-normal">Product</th><th className="p-2 font-normal">Cyclus</th><th className="p-2 text-right font-normal">Bedrag per periode</th><th className="p-2 font-normal">Gefactureerd t/m</th><th className="p-2 font-normal">Volgende periode vanaf</th><th className="p-2 font-normal">Status</th><th className="p-2 font-normal">Afwijkingen</th></tr></thead>
                <tbody>{contracten.map((c) => (
                  <tr key={c.id} className="border-t border-border align-top">
                    <td className="p-2 tabular-nums">{c.bron_rij}</td>
                    <td className="p-2">{PRODUCT_LABEL[c.product as Product]}<div className="text-xs text-muted-foreground">{c.itemcode} · abonnement {c.abonnement_nr ?? "—"}</div></td>
                    <td className="p-2">{c.cyclus === "jaar" ? "Jaar" : "Maand"}{Number(c.aantal) !== 1 && ` × ${c.aantal}`}</td>
                    <td className="p-2 text-right tabular-nums">{formatEuro(periodeBedrag(c))}</td>
                    <td className="p-2 tabular-nums">{formatDateNL(c.gefactureerd_tm)}</td>
                    <td className="p-2 tabular-nums">{c.status === "vervangen" ? "—" : formatDateNL(c.volgende_factuurdatum)}</td>
                    <td className="p-2"><Badge variant="secondary">{CONTRACT_STATUS_LABEL[c.status] ?? c.status}</Badge></td>
                    <td className="p-2 text-xs">{(c.afwijkingen ?? []).join(" · ")}</td>
                  </tr>))}</tbody>
              </table>
              <p className="mt-2 text-xs text-muted-foreground">Facturatiestatus van alle regels: wacht op akkoord.</p>
            </CardContent></Card>
          </>
        )}
      </div>
    </AdminLayout>
  );
}

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
import { OpzeggingenKlant } from "@/components/admin/OpzeggingenKlant";
import { CertificatenKlant } from "@/components/admin/CertificatenKlant";
import { KlantCertificaat } from "@/components/admin/KlantCertificaat";
import { CrmTijdlijn } from "@/components/admin/crm/CrmTijdlijn";
import { KlantKaart } from "@/components/admin/crm/KlantKaart";
import { LopendeProducten } from "@/components/admin/crm/LopendeProducten";
import { ExactRelatieLabel, OndernemingswijzigingKnop, OpvolgerBanner, VoorgangerHistorie, useOpvolging } from "@/components/admin/crm/Opvolging";

export default function KlantDetail() {
  const { id } = useParams();
  const [laden, setLaden] = useState(true);
  const [ond, setOnd] = useState<any>(null);
  const [contracten, setContracten] = useState<any[]>([]);
  const [personen, setPersonen] = useState<any[]>([]);
  const [mandaat, setMandaat] = useState<any>(null);
  const [leadMatch, setLeadMatch] = useState<any[]>([]);
  const [herlaad, setHerlaad] = useState(0);
  const { opvolger, voorgangers } = useOpvolging(id!, herlaad);
  const persoonNaam = (p: any) => [p.voornaam, p.achternaam].filter(Boolean).join(" ") || p.email_weergave || "contactpersoon";

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
        const ps = ((po.data ?? []) as any[]).map((x) => x.personen).filter(Boolean);
        setPersonen(ps);
        setMandaat(m.data);
        // Leads via de persoonslaag (bronkoppeling) plus leads met dezelfde relatiecode
        let viaPersoon: any[] = [];
        if (ps.length) {
          const { data: kop } = await supabase.from("persoon_bron_koppeling").select("bron_id").eq("bron_tabel", "leads").in("persoon_id", ps.map((p: any) => p.id));
          const ids = (kop ?? []).map((x) => x.bron_id);
          if (ids.length) viaPersoon = (await supabase.from("leads").select("id,voornaam,achternaam,status").in("id", ids)).data ?? [];
        }
        const alle = new Map<string, any>();
        for (const x of [...viaPersoon, ...((l.data as any[]) ?? [])]) alle.set(x.id, x);
        setLeadMatch(Array.from(alle.values()));
      }
      setLaden(false);
    })();
  }, [id, herlaad]);

  return (
    <AdminLayout>
      <Helmet><title>{ond?.naam ?? "Klant"} | ZP Zaken beheer</title></Helmet>
      <div className="space-y-6 min-w-0">
        <Link to="/admin/klanten" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" /> Klanten & contracten</Link>
        {laden ? <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin" /></div> : !ond ? <p>Klant niet gevonden.</p> : (
          <>
            <OpvolgerBanner opvolger={opvolger} />
            <div className="flex flex-wrap items-start justify-between gap-2"><div>
              <h1 className="text-2xl font-bold break-words">{ond.naam}</h1>
              <p className="break-words text-sm text-muted-foreground">Exact-relatiecode {ond.exact_relatie_code ?? "onbekend"} · {ond.bron === "afas_20261001" ? "startstand 01-10-2026" : ond.bron ? `bron ${ond.bron}` : ""}</p>
              {ond.afwijkingen?.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{ond.afwijkingen.map((a: string) => <Badge key={a} variant="outline" className="border-amber-500 text-amber-700">{a}</Badge>)}</div>}
              <div className="mt-2"><ExactRelatieLabel ond={ond} heeftVoorganger={voorgangers.length > 0} /></div>
            </div><OndernemingswijzigingKnop ond={ond} onKlaar={() => setHerlaad((x) => x + 1)} /></div>
            <KlantKaart ondernemingen={[ond]} personen={personen} leadIds={leadMatch.map((l) => l.id)} herlaadSleutel={herlaad} onGewijzigd={() => setHerlaad((h) => h + 1)} />
            <div className="grid gap-6 md:grid-cols-3">
              <Card><CardHeader><CardTitle className="text-base">Contactpersonen</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">
                {personen.length === 0 && <p className="text-muted-foreground">Geen e-mailadres bekend.</p>}
                {personen.map((p) => <div key={p.id} className="min-w-0"><Link to={`/admin/personen/${p.id}`} className="block truncate font-medium hover:text-primary">{[p.voornaam, p.achternaam].filter(Boolean).join(" ") || p.email_weergave || "—"}</Link><div className="truncate text-muted-foreground" title={p.email_weergave}>{p.email_weergave}</div></div>)}
              </CardContent></Card>
              <Card><CardHeader><CardTitle className="text-base">Mandaat (alleen lezen)</CardTitle></CardHeader><CardContent className="text-sm">
                {mandaat ? <div className="space-y-1"><div>IBAN {maskeerIban(mandaat.iban)}</div><div className="text-muted-foreground">Kenmerk {mandaat.kenmerk} · ondertekend {formatDateNL(mandaat.ondertekend_op)}</div></div> : <p className="text-muted-foreground">Geen mandaat gevonden.</p>}
              </CardContent></Card>
              <Card><CardHeader><CardTitle className="text-base">Leads</CardTitle></CardHeader><CardContent className="text-sm">
                {leadMatch.length === 0 ? <p className="text-muted-foreground">Geen leads gekoppeld.</p> :
                  leadMatch.map((l) => <Link key={l.id} to={`/admin/leads/${l.id}`} className="block truncate font-medium hover:text-primary">{l.voornaam} {l.achternaam}</Link>)}
                <p className="mt-2 text-xs text-muted-foreground">Via contactpersonen of relatiecode; alleen ter informatie.</p>
              </CardContent></Card>
            </div>
            <LopendeProducten ondernemingId={ond.id} ondernemingNaam={ond.naam} leadIds={leadMatch.map((l) => l.id)} onGewijzigd={() => setHerlaad((x) => x + 1)} />
            <CrmTijdlijn ondernemingen={[{ id: ond.id, naam: ond.naam }]} personen={personen.map((p) => ({ id: p.id, naam: persoonNaam(p) }))}
              invoerDoel={{ onderneming_id: ond.id }} herlaadSleutel={herlaad} />
            <KlantCertificaat ond={ond} contracten={contracten} personen={personen} leadIds={leadMatch.map((l) => l.id)} />
            <CertificatenKlant ondernemingId={ond.id} />
            <OpzeggingenKlant ondernemingId={ond.id} contracten={contracten} onGewijzigd={() => setHerlaad((x) => x + 1)} />
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
            </CardContent></Card>
            <VoorgangerHistorie voorgangers={voorgangers} />
          </>
        )}
      </div>
    </AdminLayout>
  );
}

import { CERT_VELDEN, actueelCertificaat, groepeerPerOnderneming, type KlantCertificaat } from "@/lib/klantCertificaten";
import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { ToonTestrecordsSchakelaar } from "@/components/admin/ToonTestrecordsSchakelaar";
import { useToonTestrecords } from "@/hooks/useToonTestrecords";
import { supabase } from "@/integrations/supabase/client";
import { fetchAlle } from "@/lib/fetchAlle";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Building2, Loader2 } from "lucide-react";
import { OpzeggingenTeKoppelen } from "@/components/admin/OpzeggingenKlant";
import { formatDateNL } from "@/lib/dateFormat";
import {
  PRODUCT_LABEL, facturatieAgenda, formatEuro, maandwaarde, periodeBedrag,
  type ContractRegel, type Product,
} from "@/lib/klantContracten";

type Ond = { id: string; naam: string | null; exact_relatie_code: string | null; afas_contactpersoon: string | null; afwijkingen: string[]; is_test: boolean };
type Rec = { regels: number; relaties: number; mrr: number; arr: number };
type Reconciliatie = { bron: Rec; crm: Rec; actief: Rec; per_product: { product: Product; regels: number; mrr: number; arr: number }[] };
type Contract = ContractRegel & { itemcode: string; afwijkingen: string[]; is_test: boolean };

const MAAND_KORT = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
const maandLabel = (k: string) => { const [y, m] = k.split("-"); return `${MAAND_KORT[Number(m) - 1]} ${y}`; };

export default function KlantenContracten() {
  const { toonTest } = useToonTestrecords();
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState<string | null>(null);
  const [onds, setOnds] = useState<Ond[]>([]);
  const [contracten, setContracten] = useState<Contract[]>([]);
  const [emails, setEmails] = useState<Map<string, string[]>>(new Map());
  const [mandaten, setMandaten] = useState<Set<string>>(new Set());
  const [rec, setRec] = useState<Reconciliatie | null>(null);

  const [zoek, setZoek] = useState("");
  const [product, setProduct] = useState("alle");
  const [cyclus, setCyclus] = useState("alle");
  const [binnen30, setBinnen30] = useState(false);
  const [looptAf, setLooptAf] = useState(false);
  const [metAfw, setMetAfw] = useState(false);
  const [geenCert, setGeenCert] = useState(false);
  const [certs, setCerts] = useState<Map<string, KlantCertificaat[]>>(new Map());

  useEffect(() => {
    (async () => {
      setLaden(true); setFout(null);
      const [o, k, po, p, m, r, kc] = await Promise.all([
        fetchAlle<Ond>((a, b) => supabase.from("ondernemingen").select("id,naam,exact_relatie_code,afas_contactpersoon,afwijkingen,is_test").not("exact_relatie_code", "is", null).order("naam").range(a, b)),
        fetchAlle<Contract>((a, b) => supabase.from("klant_contracten").select("id,onderneming_id,cyclus,aantal,bedrag_per_periode,volgende_factuurdatum,eind_datum,status,product,itemcode,afwijkingen,is_test").order("bron_rij").range(a, b)),
        fetchAlle<any>((a, b) => supabase.from("persoon_onderneming").select("persoon_id,onderneming_id").range(a, b)),
        fetchAlle<any>((a, b) => supabase.from("personen").select("id,email_weergave").range(a, b)),
        fetchAlle<any>((a, b) => supabase.from("klant_mandaat_v").select("relatiecode").range(a, b)),
        supabase.rpc("get_klant_contracten_reconciliatie"),
        fetchAlle<KlantCertificaat>((a, b) => supabase.from("klant_certificaten" as any).select(CERT_VELDEN).range(a, b)),
      ]);
      const err = o.error || k.error || po.error || p.error || m.error || r.error || kc.error;
      setCerts(groepeerPerOnderneming(kc.data));
      if (err) setFout("Gegevens konden niet worden geladen.");
      const mailVan = new Map(p.data.map((x) => [x.id, x.email_weergave as string]));
      const em = new Map<string, string[]>();
      for (const x of po.data) { const e = mailVan.get(x.persoon_id); if (e) em.set(x.onderneming_id, [...(em.get(x.onderneming_id) ?? []), e]); }
      setOnds(o.data); setContracten(k.data); setEmails(em);
      setMandaten(new Set(m.data.map((x) => x.relatiecode)));
      setRec((r.data as unknown as Reconciliatie) ?? null);
      setLaden(false);
    })();
  }, []);

  const zichtbareContracten = useMemo(() => contracten.filter((c) => toonTest || !c.is_test), [contracten, toonTest]);

  const rijen = useMemo(() => {
    const vandaag = new Date(); const grens = new Date(); grens.setDate(grens.getDate() + 30);
    const perOnd = new Map<string, Contract[]>();
    for (const c of zichtbareContracten) perOnd.set(c.onderneming_id, [...(perOnd.get(c.onderneming_id) ?? []), c]);
    return onds.filter((o) => toonTest || !o.is_test).map((o) => {
      const cs = perOnd.get(o.id) ?? [];
      const actief = cs.filter((c) => c.status !== "vervangen");
      const volgende = actief.map((c) => c.volgende_factuurdatum).filter(Boolean).sort()[0] ?? null;
      return {
        o, cs,
        producten: Array.from(new Set(actief.map((c) => c.product))) as Product[],
        maand: actief.filter((c) => c.cyclus === "maand").reduce((s, c) => s + periodeBedrag(c), 0),
        jaar: actief.filter((c) => c.cyclus === "jaar").reduce((s, c) => s + periodeBedrag(c), 0),
        volgende,
        binnen30: actief.some((c) => c.volgende_factuurdatum && new Date(c.volgende_factuurdatum) <= grens && new Date(c.volgende_factuurdatum) >= new Date(vandaag.toDateString())) ,
        looptAf: cs.some((c) => c.status === "loopt_af"),
        afw: [...o.afwijkingen, ...cs.flatMap((c) => c.afwijkingen)],
        mandaat: !!o.exact_relatie_code && mandaten.has(o.exact_relatie_code),
        mails: emails.get(o.id) ?? [],
        certNummers: (certs.get(o.id) ?? []).filter((c) => c.koppeling_status !== "afgewezen").map((c) => c.certificaatnummer),
        cert: actueelCertificaat(certs.get(o.id) ?? []),
      };
    });
  }, [onds, zichtbareContracten, emails, mandaten, toonTest, certs]);

  const gefilterd = rijen.filter((r) => {
    const q = zoek.trim().toLowerCase();
    if (q && !`${r.o.naam ?? ""} ${r.o.exact_relatie_code ?? ""} ${r.certNummers.join(" ")}`.toLowerCase().includes(q)) return false;
    if (product !== "alle" && !r.producten.includes(product as Product)) return false;
    if (cyclus !== "alle" && !r.cs.some((c) => c.status !== "vervangen" && c.cyclus === cyclus)) return false;
    if (binnen30 && !r.binnen30) return false;
    if (looptAf && !r.looptAf) return false;
    if (metAfw && r.afw.length === 0) return false;
    if (geenCert && r.cert) return false;
    return true;
  });

  const agenda = useMemo(() => facturatieAgenda(zichtbareContracten, new Date()), [zichtbareContracten]);
  const mrrNu = zichtbareContracten.filter((c) => c.status !== "vervangen").reduce((s, c) => s + maandwaarde(c), 0);

  const RecRij = ({ label, r }: { label: string; r?: Rec }) => (
    <tr className="border-t border-border">
      <td className="p-2 font-medium">{label}</td>
      <td className="p-2 text-right tabular-nums">{r?.regels ?? "—"}</td>
      <td className="p-2 text-right tabular-nums">{r?.relaties ?? "—"}</td>
      <td className="p-2 text-right tabular-nums">{r ? formatEuro(r.mrr) : "—"}</td>
      <td className="p-2 text-right tabular-nums">{r ? formatEuro(r.arr) : "—"}</td>
    </tr>
  );
  const klopt = rec && rec.bron.regels === rec.crm.regels && rec.bron.relaties === rec.crm.relaties && Number(rec.bron.mrr) === Number(rec.crm.mrr) && Number(rec.bron.arr) === Number(rec.crm.arr);

  return (
    <AdminLayout>
      <Helmet><title>Klanten & contracten | ZP Zaken beheer</title></Helmet>
      <div className="space-y-6 min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="flex items-center gap-2 text-2xl font-bold"><Building2 className="h-6 w-6" /> Klanten & contracten</h1>
          <ToonTestrecordsSchakelaar />
        </div>
        {fout && <p className="text-sm text-destructive">{fout}</p>}
        {laden ? <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin" /></div> : (
          <>
            <OpzeggingenTeKoppelen />
            <div className="grid gap-6 xl:grid-cols-2">
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2 text-base">Reconciliatie startstand
                  <Badge variant={klopt ? "secondary" : "destructive"}>{klopt ? "Klopt met bron" : "Wijkt af"}</Badge></CardTitle></CardHeader>
                <CardContent className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="text-muted-foreground"><th className="p-2 text-left font-normal"></th><th className="p-2 text-right font-normal">Regels</th><th className="p-2 text-right font-normal">Relaties</th><th className="p-2 text-right font-normal">MRR</th><th className="p-2 text-right font-normal">ARR</th></tr></thead>
                    <tbody>
                      <RecRij label="Startstand" r={rec?.bron} />
                      <RecRij label="In CRM" r={rec?.crm} />
                      <RecRij label="Actief (zonder vervangen)" r={rec?.actief} />
                      {rec?.per_product.map((p) => (
                        <tr key={p.product} className="border-t border-border text-muted-foreground">
                          <td className="p-2 pl-6">{PRODUCT_LABEL[p.product] ?? p.product}</td>
                          <td className="p-2 text-right tabular-nums">{p.regels}</td><td></td>
                          <td className="p-2 text-right tabular-nums">{formatEuro(p.mrr)}</td>
                          <td className="p-2 text-right tabular-nums">{formatEuro(p.arr)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">Facturatie-agenda (periodes die starten per maand)</CardTitle></CardHeader>
                <CardContent className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="text-muted-foreground"><th className="p-2 text-left font-normal">Maand</th><th className="p-2 text-right font-normal">Maand: aantal</th><th className="p-2 text-right font-normal">Maand: bedrag</th><th className="p-2 text-right font-normal">Jaar: aantal</th><th className="p-2 text-right font-normal">Jaar: bedrag</th></tr></thead>
                    <tbody>{agenda.map((m) => (
                      <tr key={m.maand} className="border-t border-border">
                        <td className="p-2 whitespace-nowrap">{maandLabel(m.maand)}</td>
                        <td className="p-2 text-right tabular-nums">{m.maandAantal}</td>
                        <td className="p-2 text-right tabular-nums">{formatEuro(m.maandBedrag)}</td>
                        <td className="p-2 text-right tabular-nums">{m.jaarAantal}</td>
                        <td className="p-2 text-right tabular-nums">{formatEuro(m.jaarBedrag)}</td>
                      </tr>))}</tbody>
                  </table>
                  <p className="mt-2 text-xs text-muted-foreground">Achterlopende periodes van vóór deze maand staan niet in de agenda. Huidige MRR (actief): {formatEuro(mrrNu)}.</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardContent className="space-y-4 pt-6">
                <div className="flex flex-wrap items-center gap-3">
                  <Input placeholder="Zoek op naam, relatiecode of certificaat" value={zoek} onChange={(e) => setZoek(e.target.value)} className="w-64" aria-label="Zoeken" />
                  <Select value={product} onValueChange={setProduct}>
                    <SelectTrigger className="w-52" aria-label="Product"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="alle">Alle producten</SelectItem>
                      {Object.entries(PRODUCT_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={cyclus} onValueChange={setCyclus}>
                    <SelectTrigger className="w-40" aria-label="Cyclus"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="alle">Maand en jaar</SelectItem><SelectItem value="maand">Maand</SelectItem><SelectItem value="jaar">Jaar</SelectItem></SelectContent>
                  </Select>
                  {[["Volgende periode binnen 30 dagen", binnen30, setBinnen30], ["Loopt af", looptAf, setLooptAf], ["Met afwijkingen", metAfw, setMetAfw], ["Geen certificaat bekend", geenCert, setGeenCert]].map(([l, v, s]: any) => (
                    <label key={l} className="flex items-center gap-2 text-sm whitespace-nowrap"><Checkbox checked={v} onCheckedChange={(x) => s(!!x)} />{l}</label>
                  ))}
                  <span className="ml-auto text-sm text-muted-foreground">{gefilterd.length} klanten</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full table-fixed text-sm min-w-[1200px]">
                    <colgroup><col className="w-[18%]" /><col className="w-[8%]" /><col className="w-[9%]" /><col className="w-[15%]" /><col className="w-[14%]" /><col className="w-[8%]" /><col className="w-[8%]" /><col className="w-[9%]" /><col className="w-[6%]" /><col className="w-[7%]" /></colgroup>
                    <thead><tr className="text-left text-muted-foreground">
                      <th className="p-2 font-normal">Klant</th><th className="p-2 font-normal">Relatiecode</th><th className="p-2 font-normal">Certificaat</th><th className="p-2 font-normal">Contact</th><th className="p-2 font-normal">Contracten</th>
                      <th className="p-2 text-right font-normal">Per maand</th><th className="p-2 text-right font-normal">Per jaar</th><th className="p-2 font-normal">Volgende periode vanaf</th><th className="p-2 font-normal">Mandaat</th><th className="p-2 font-normal">Afwijking</th>
                    </tr></thead>
                    <tbody>{gefilterd.map((r) => (
                      <tr key={r.o.id} className="border-t border-border hover:bg-muted/30">
                        <td className="p-2 min-w-0"><Link to={`/admin/klanten/${r.o.id}`} className="block truncate font-medium hover:text-primary" title={r.o.naam ?? ""}>{r.o.naam || "—"}</Link></td>
                        <td className="p-2 tabular-nums truncate">{r.o.exact_relatie_code}</td>
                        <td className="p-2 tabular-nums truncate" title={r.cert ? `${r.cert.certificaatnummer} · ${r.cert.koppeling_status}` : "Geen certificaat bekend"}>{r.cert ? <>{r.cert.certificaatnummer}{r.cert.koppeling_status === "voorstel" && <span className="text-xs text-amber-700"> (voorstel)</span>}</> : "—"}</td>
                        <td className="p-2 min-w-0"><div className="truncate" title={r.o.afas_contactpersoon ?? ""}>{r.o.afas_contactpersoon || "—"}</div><div className="truncate text-xs text-muted-foreground" title={r.mails.join(", ")}>{r.mails[0] ?? "Geen e-mail"}</div></td>
                        <td className="p-2 min-w-0"><div className="truncate" title={r.producten.map((p) => PRODUCT_LABEL[p]).join(", ")}>{r.cs.length} · {r.producten.map((p) => PRODUCT_LABEL[p]).join(", ")}</div></td>
                        <td className="p-2 text-right tabular-nums">{r.maand ? formatEuro(r.maand) : "—"}</td>
                        <td className="p-2 text-right tabular-nums">{r.jaar ? formatEuro(r.jaar) : "—"}</td>
                        <td className="p-2 tabular-nums whitespace-nowrap">{r.volgende ? formatDateNL(r.volgende) : "—"}</td>
                        <td className="p-2">{r.mandaat ? "Ja" : "Nee"}</td>
                        <td className="p-2">{r.afw.length > 0 && <Badge variant="outline" className="max-w-full border-amber-500 text-amber-700" title={r.afw.join("\n")}><span className="truncate">{r.afw.length}</span></Badge>}</td>
                      </tr>))}</tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AdminLayout>
  );
}

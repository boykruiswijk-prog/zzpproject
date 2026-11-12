import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatDateTimeNL } from "@/lib/dateFormat";
import { uploadBijlagen } from "@/lib/crmBijlagen";
import { BijlageKiezer, plakBestanden } from "./BijlageKiezer";
import { bouwDraden, filterDraden, heeftNieuweReactie, isSysteemNaam, type NotitieFilter } from "@/lib/notitieDraad";
import { ReactieInvoer, ReactieLijst, FilterKeuze } from "@/components/admin/NotitieReacties";

export const NOTITIE_SOORT_LABEL: Record<string, string> = {
  notitie: "Notitie", telefoon: "Telefoongesprek", opzegging: "Opzegging", stop: "Beeindiging",
  ondernemingswijziging: "Ondernemingswijziging", overig: "Overig",
};

export const TYPE_LABEL: Record<string, string> = {
  aanvraag: "Aanvraag", certificaat: "Certificaat/polis", factuur: "Factuur", creditnota: "Creditnota",
  opzegverzoek: "Opzegverzoek klant", beeindigd: "Beeindigd door medewerker", pauze: "Pauze/hervat",
  notitie: "Notitie/telefoon", mail: "Mail", ondernemingswijziging: "Ondernemingswijziging", activiteit: "Activiteit", service: "Serviceaanvraag",
};
const NOTITIE_TYPE: Record<string, string> = { stop: "beeindigd", ondernemingswijziging: "ondernemingswijziging", opzegging: "opzegverzoek" };

type Ref = { id: string; naam: string };
type Bijlage = { id: string; storage_pad: string; bestandsnaam: string; mime: string; url?: string };
type Item = {
  key: string; datum: string; bron: "notitie" | "leadnotitie" | "activiteit" | "aanvraag" | "dossier"; type: string; status?: string;
  soort: string; tekst: string; wie?: string | null; hoortBij: string; href?: string;
  notitie?: any; bijlagen?: Bijlage[];
  id: string; parent_id?: string | null; auteur_id?: string | null; systeem: boolean; leadNote?: any;
};

export function CrmTijdlijn({ ondernemingen, personen, invoerDoel, readOnly = false, titel = "Tijdlijn", herlaadSleutel = 0 }: {
  ondernemingen: Ref[]; personen: Ref[];
  invoerDoel?: { onderneming_id?: string | null; persoon_id?: string | null };
  readOnly?: boolean; titel?: string; herlaadSleutel?: number;
}) {
  const { user, isSupervisorOrAdmin } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [laden, setLaden] = useState(true);
  const [tekst, setTekst] = useState("");
  const [soort, setSoort] = useState("notitie");
  const [bestanden, setBestanden] = useState<File[]>([]);
  const [bezig, setBezig] = useState(false);
  const [groot, setGroot] = useState<Bijlage | null>(null);
  const [filter, setFilter] = useState("alle");
  const [soortFilter, setSoortFilter] = useState<NotitieFilter>("alles");
  const ondIds = ondernemingen.map((o) => o.id);
  const persIds = personen.map((p) => p.id);
  const sleutel = ondIds.join(",") + "|" + persIds.join(",");

  const laad = useCallback(async () => {
    setLaden(true);
    const ondNaam = new Map(ondernemingen.map((o) => [o.id, o.naam]));
    const persNaam = new Map(personen.map((p) => [p.id, p.naam]));
    const filters: string[] = [];
    if (ondIds.length) filters.push(`onderneming_id.in.(${ondIds.join(",")})`);
    if (persIds.length) filters.push(`persoon_id.in.(${persIds.join(",")})`);
    const uit: Item[] = [];

    const [notRes, aanvrRes, kopRes, dosRes] = await Promise.all([
      filters.length ? supabase.from("crm_notities").select("*").or(filters.join(",")).order("aangemaakt_op", { ascending: false }) : Promise.resolve({ data: [] as any[] }),
      ondIds.length ? supabase.from("klant_service_aanvragen").select("id,type,status,created_at,details,onderneming_id,voornaam,achternaam").in("onderneming_id", ondIds).is("gekoppeld_aan", null) : Promise.resolve({ data: [] as any[] }),
      persIds.length ? supabase.from("persoon_bron_koppeling").select("persoon_id,bron_id").eq("bron_tabel", "leads").in("persoon_id", persIds) : Promise.resolve({ data: [] as any[] }),
      supabase.rpc("crm_dossier" as any, { _ond: ondIds, _pers: persIds } as any),
    ]);
    for (const e of ((dosRes as any).data ?? []) as any[]) {
      uit.push({ id: "d" + e.key, systeem: true, key: "d" + e.key, datum: e.datum, bron: "dossier", type: e.type, status: e.status, soort: TYPE_LABEL[e.type] ?? e.type, tekst: e.onderwerp, wie: e.door, hoortBij: "", href: e.href });
    }
    const notities = (notRes.data ?? []) as any[];
    let bijlagen: any[] = [];
    if (notities.length) {
      bijlagen = (await supabase.from("crm_notitie_bijlagen").select("*").in("notitie_id", notities.map((n) => n.id)).order("geupload_op")).data ?? [];
      if (bijlagen.length) {
        const { data: urls } = await supabase.storage.from("klant-documenten").createSignedUrls(bijlagen.map((b) => b.storage_pad), 3600);
        const m = new Map((urls ?? []).map((u: any) => [u.path, u.signedUrl]));
        bijlagen = bijlagen.map((b) => ({ ...b, url: m.get(b.storage_pad) }));
      }
    }
    for (const n of notities) {
      const delen = [n.onderneming_id && ondNaam.get(n.onderneming_id), n.persoon_id && persNaam.get(n.persoon_id)].filter(Boolean);
      uit.push({ id: "n" + n.id, parent_id: n.parent_id ? "n" + n.parent_id : null, auteur_id: n.aangemaakt_door, systeem: !n.parent_id && isSysteemNaam(n.aangemaakt_door_naam), key: "n" + n.id, datum: n.aangemaakt_op, bron: "notitie", type: NOTITIE_TYPE[n.soort] ?? "notitie", soort: NOTITIE_SOORT_LABEL[n.soort] ?? n.soort, tekst: n.tekst,
        wie: n.aangemaakt_door_naam, hoortBij: delen.join(" / ") || "-", notitie: n, bijlagen: bijlagen.filter((b) => b.notitie_id === n.id) });
    }
    for (const a of (aanvrRes.data ?? []) as any[]) {
      const d = a.details ?? {};
      const extra = a.type === "opzeggen" ? ` per ${d.opzegdatum ?? "?"}${d.bron === "beheer_handmatig" ? " (handmatig in beheer)" : ""}` : "";
      const handmatig = d.bron === "beheer_handmatig";
      if (handmatig) continue; // staat al als beeindiging (notitie) in de tijdlijn
      const nl = (x: string) => String(x).slice(0, 10).split("-").reverse().join("-");
      if (a.type === "opzeggen" && d.verwerkt_einddatum) {
        uit.push({ id: "a" + a.id, systeem: true, key: "a" + a.id, datum: a.created_at, bron: "aanvraag", type: "opzegverzoek", wie: "klant", soort: "Opzegging",
          tekst: `Opzegging klant ${nl(a.created_at)}, verwerkt door ${String(d.verwerkt_door_naam ?? "team").split(" ")[0]} op ${nl(d.verwerkt_op_datum ?? a.created_at)} per ${nl(d.verwerkt_einddatum)}.`,
          hoortBij: ondNaam.get(a.onderneming_id) ?? "-", href: `/admin/service-aanvragen/${a.id}` });
        continue;
      }
      uit.push({ id: "a" + a.id, systeem: true, key: "a" + a.id, datum: a.created_at, bron: "aanvraag", type: a.type === "opzeggen" ? "opzegverzoek" : a.type === "pauzeren" ? "pauze" : "service", wie: "klant", soort: `Serviceaanvraag: ${a.type}`,
        tekst: `${a.type === "opzeggen" ? "Opzegging" : a.type}${extra}. Status: ${a.status}.${d.toelichting ? " " + d.toelichting : ""}`,
        hoortBij: ondNaam.get(a.onderneming_id) ?? "-", href: `/admin/service-aanvragen/${a.id}` });
    }
    const kop = (kopRes.data ?? []) as any[];
    const leadIds = Array.from(new Set(kop.map((k) => k.bron_id)));
    if (leadIds.length) {
      const leadPersoon = new Map(kop.map((k) => [k.bron_id, persNaam.get(k.persoon_id) ?? ""]));
      const [ln, al] = await Promise.all([
        supabase.from("lead_notes").select("id,lead_id,content,type,created_at,user_id,parent_id,ingetrokken_op,intrek_reden").in("lead_id", leadIds),
        supabase.from("activiteiten_log").select("id,lead_id,actie_type,omschrijving,uitgevoerd_door_naam,aangemaakt_op").in("lead_id", leadIds).order("aangemaakt_op", { ascending: false }).limit(200),
      ]);
      const lnRijen = (ln.data ?? []) as any[];
      const uids = Array.from(new Set(lnRijen.map((x) => x.user_id)));
      const namen = new Map<string, string>();
      if (uids.length) for (const pr of ((await supabase.from("profiles").select("id,full_name").in("id", uids)).data ?? []) as any[]) namen.set(pr.id, pr.full_name);
      for (const x of lnRijen) uit.push({ id: "l" + x.id, parent_id: x.parent_id ? "l" + x.parent_id : null, auteur_id: x.user_id, systeem: false, leadNote: x, wie: namen.get(x.user_id) ?? "teamlid", key: "l" + x.id, datum: x.created_at, bron: "leadnotitie", type: "notitie", soort: `Leadnotitie (${x.type})`, tekst: x.content,
        hoortBij: `lead ${leadPersoon.get(x.lead_id) ?? ""}`.trim(), href: `/admin/leads/${x.lead_id}` });
      for (const x of (al.data ?? []) as any[]) uit.push({ id: "g" + x.id, systeem: true, key: "g" + x.id, datum: x.aangemaakt_op, bron: "activiteit", type: /pauze|hervat/i.test(x.actie_type) ? "pauze" : "activiteit", soort: `Activiteit: ${x.actie_type}`, tekst: x.omschrijving,
        wie: x.uitgevoerd_door_naam, hoortBij: `lead ${leadPersoon.get(x.lead_id) ?? ""}`.trim(), href: `/admin/leads/${x.lead_id}` });
    }
    uit.sort((a, b) => (a.datum < b.datum ? 1 : -1));
    setItems(uit);
    setLaden(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sleutel]);

  useEffect(() => { laad(); }, [laad, herlaadSleutel]);

  async function opslaan() {
    if (!user || !invoerDoel) return;
    if (!tekst.trim()) { toast.error("Vul een tekst in"); return; }
    setBezig(true);
    const { data: id, error } = await supabase.rpc("crm_notitie_toevoegen", {
      _onderneming_id: invoerDoel.onderneming_id ?? null, _persoon_id: invoerDoel.persoon_id ?? null, _soort: soort, _tekst: tekst,
    } as any);
    if (error || !id) { setBezig(false); toast.error(error?.message ?? "Opslaan mislukt"); return; }
    const fouten = bestanden.length ? await uploadBijlagen(id as string, bestanden, user.id) : [];
    fouten.forEach((f) => toast.error(f));
    setTekst(""); setBestanden([]); setSoort("notitie"); setBezig(false);
    toast.success("Notitie opgeslagen");
    laad();
  }

  async function intrekken(n: any) {
    const reden = window.prompt("Reden van intrekken (de notitie blijft bewaard):");
    if (!reden) return;
    const { error } = await supabase.rpc("crm_notitie_intrekken", { _id: n.id, _reden: reden });
    if (error) toast.error(error.message); else { toast.success("Notitie ingetrokken"); laad(); }
  }

  async function reageren(it: Item, tekst: string): Promise<boolean> {
    if (!user) return false;
    const { error } = it.leadNote
      ? await supabase.from("lead_notes").insert({ lead_id: it.leadNote.lead_id, user_id: user.id, content: tekst, parent_id: it.leadNote.id } as any)
      : await supabase.rpc("crm_reactie_toevoegen" as any, { _parent_id: it.notitie.id, _tekst: tekst } as any);
    if (error) { toast.error(error.message); return false; }
    toast.success("Reactie geplaatst"); laad(); return true;
  }

  async function intrekkenLead(x: any) {
    const reden = window.prompt("Reden van intrekken (de reactie blijft bewaard):");
    if (!reden) return;
    const { error } = await supabase.rpc("lead_notitie_intrekken" as any, { _id: x.id, _reden: reden } as any);
    if (error) toast.error(error.message); else { toast.success("Reactie ingetrokken"); laad(); }
  }

  function renderItem(it: Item, isReactie: boolean, nieuw: boolean) {
            const ingetrokken = it.notitie?.ingetrokken_op ?? it.leadNote?.ingetrokken_op;
            const kanReageren = !!(it.notitie || it.leadNote);
            const magIntrekken = !readOnly && it.notitie && !ingetrokken && (it.notitie.aangemaakt_door === user?.id || isSupervisorOrAdmin);
            return (
              <div className={`min-w-0 rounded-md border p-3 ${it.systeem ? "border-dashed border-border bg-muted/30 text-xs text-muted-foreground" : "border-border text-sm"} ${isReactie ? "p-2" : ""} ${ingetrokken ? "opacity-60" : ""}`}>
                <div className="grid min-w-0 gap-1 md:grid-cols-[9rem_9rem_11rem_1fr] md:gap-2">
                  <span className="text-xs tabular-nums text-muted-foreground">{formatDateTimeNL(it.datum)}</span>
                  <span className="truncate text-xs text-muted-foreground">{it.wie || "systeem"}</span>
                  <span><Badge variant={it.bron === "notitie" ? "default" : "secondary"} className="max-w-full truncate">{TYPE_LABEL[it.type] ?? it.soort}</Badge></span>
                  <p className={`min-w-0 whitespace-pre-wrap break-words ${ingetrokken ? "line-through" : ""}`}>{it.tekst}</p>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {it.bron === "notitie" && it.soort && <span>{it.soort}</span>}
                  {it.hoortBij && <span className="truncate">bij {it.hoortBij}</span>}
                  {it.notitie?.is_test && <Badge variant="outline">test</Badge>}
                  {ingetrokken && <Badge variant="outline">ingetrokken: {(it.notitie ?? it.leadNote).intrek_reden}</Badge>}
                  {nieuw && <Badge variant="outline" className="border-primary text-primary">nieuwe reactie</Badge>}
                  {it.href && <Link to={it.href} className="ml-auto hover:text-primary">openen</Link>}
                  {magIntrekken && <button className="ml-auto hover:text-primary" onClick={() => intrekken(it.notitie)}>intrekken</button>}
                  {isReactie && it.leadNote && !ingetrokken && (it.leadNote.user_id === user?.id || isSupervisorOrAdmin) && <button className="ml-auto hover:text-primary" onClick={() => intrekkenLead(it.leadNote)}>intrekken</button>}
                </div>
                {it.bijlagen && it.bijlagen.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">{it.bijlagen.map((b) => (
                    <button key={b.id} type="button" onClick={() => b.mime === "application/pdf" || /heic|heif/.test(b.mime) ? window.open(b.url, "_blank", "noopener") : setGroot(b)}
                      className="flex items-center gap-2 rounded border border-border bg-muted/40 p-1 text-xs hover:border-primary" title={b.bestandsnaam}>
                      {b.mime.startsWith("image/") && !/heic|heif/.test(b.mime) && b.url
                        ? <img src={b.url} alt={b.bestandsnaam} className="h-16 w-16 rounded object-cover" />
                        : <FileText className="h-6 w-6" />}
                      <span className="max-w-[8rem] truncate">{b.bestandsnaam}</span>
                    </button>))}</div>
                )}
                {!isReactie && kanReageren && <div className="mt-2"><ReactieInvoer onPlaatsen={(t) => reageren(it, t)} /></div>}
              </div>);
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{titel}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {!readOnly && invoerDoel && (
          <div className="space-y-2 rounded-md border border-border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Select value={soort} onValueChange={setSoort}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>{["notitie", "telefoon", "opzegging", "overig"].map((s) => <SelectItem key={s} value={s}>{NOTITIE_SOORT_LABEL[s]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Textarea value={tekst} onChange={(e) => setTekst(e.target.value)} rows={3} placeholder="Notitie, bijvoorbeeld een telefoongesprek. Opslaan met Ctrl/Cmd+Enter."
              onPaste={(e) => plakBestanden(e, bestanden, setBestanden)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); opslaan(); } }} />
            <BijlageKiezer bestanden={bestanden} onChange={setBestanden} />
            <div className="flex justify-end"><Button onClick={opslaan} disabled={bezig}>{bezig && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Notitie opslaan</Button></div>
          </div>
        )}
        {laden ? <div className="flex justify-center p-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
          : items.length === 0 ? <p className="text-sm text-muted-foreground">Nog niets vastgelegd.</p>
          : <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Filter op type</span>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="h-8 w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="alle">Alle typen ({items.length})</SelectItem>
                {Array.from(new Set(items.map((i) => i.type))).map((t) => <SelectItem key={t} value={t}>{TYPE_LABEL[t] ?? t} ({items.filter((i) => i.type === t).length})</SelectItem>)}
              </SelectContent>
            </Select>
            <span className="ml-auto"><FilterKeuze waarde={soortFilter} onChange={setSoortFilter} /></span>
          </div>
          <div className="hidden grid-cols-[9rem_9rem_11rem_1fr] gap-2 border-b border-border px-3 pb-1 text-xs font-medium text-muted-foreground md:grid">
            <span>Datum</span><span>Door</span><span>Type</span><span>Onderwerp</span>
          </div>
          <ol className="space-y-2">{filterDraden(bouwDraden(items.filter((i) => filter === "alle" || i.type === filter || i.parent_id)), soortFilter)
            .filter((d) => filter === "alle" || d.hoofd.type === filter).map((d) => (
            <li key={d.hoofd.key} className="min-w-0">
              {renderItem(d.hoofd, false, heeftNieuweReactie(d, user?.id))}
              <ReactieLijst reacties={d.reacties} render={(r) => <div key={r.key}>{renderItem(r, true, false)}</div>} />
            </li>))}</ol></>}
      </CardContent>
      <Dialog open={!!groot} onOpenChange={(o) => !o && setGroot(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle className="truncate">{groot?.bestandsnaam}</DialogTitle></DialogHeader>
          {groot?.url && <img src={groot.url} alt={groot.bestandsnaam} className="max-h-[75vh] w-full object-contain" />}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

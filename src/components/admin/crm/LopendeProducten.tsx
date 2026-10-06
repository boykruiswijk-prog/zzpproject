import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatDateNL } from "@/lib/dateFormat";
import { PRODUCT_LABEL, type Product } from "@/lib/klantContracten";
import { uploadBijlagen } from "@/lib/crmBijlagen";
import { BijlageKiezer } from "./BijlageKiezer";
import { BavNummer } from "./BavNummer";
import { contractEindStatus, kiesBavNummer, useBavRijen } from "@/lib/bavNummer";

export const STOP_REDENEN: Record<string, string> = {
  opzegging_klant: "Opzegging klant",
  eerdere_opzegging: "Eerdere opzegging niet verwerkt",
  ondernemingswijziging: "Ondernemingswijziging",
  wanbetaling: "Wanbetaling",
  stoppen_onderneming: "Overlijden of stoppen onderneming",
  overig: "Overig",
};

const vandaag = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Amsterdam" });

export function useMagBeeindigen() {
  const { isAdmin, isSupervisor, isVerzekering } = useAuth();
  return isAdmin || isSupervisor || isVerzekering;
}

/** Lopende contractregels en geldige polissen van een onderneming, met knop Beeindigen. */
export function LopendeProducten({ ondernemingId, ondernemingNaam, leadIds = [], persoonId, readOnly = false, titel, onGewijzigd }: {
  ondernemingId: string; ondernemingNaam: string; leadIds?: string[]; persoonId?: string | null;
  readOnly?: boolean; titel?: string; onGewijzigd?: () => void;
}) {
  const mag = useMagBeeindigen() && !readOnly;
  const { isSupervisorOrAdmin } = useAuth();
  const [wijzig, setWijzig] = useState<any | null>(null);
  const [contracten, setContracten] = useState<any[]>([]);
  const [polissen, setPolissen] = useState<any[]>([]);
  const [laden, setLaden] = useState(true);
  const [dialoog, setDialoog] = useState<{ c: string[]; p: string[] } | null>(null);
  const [herlaad, setHerlaad] = useState(0);

  useEffect(() => {
    (async () => {
      setLaden(true);
      const filt = leadIds.length ? `onderneming_id.eq.${ondernemingId},lead_id.in.(${leadIds.join(",")})` : `onderneming_id.eq.${ondernemingId}`;
      const [k, p] = await Promise.all([
        supabase.from("klant_contracten").select("id,bron_rij,product,itemcode,cyclus,status,eind_datum,gefactureerd_tm").eq("onderneming_id", ondernemingId).order("bron_rij"),
        supabase.from("policies").select("id,certificate_number,package_type,insured_name,start_date,status,intrek_reden,ingetrokken_op,onderneming_id,lead_id").or(filt).order("created_at"),
      ]);
      setContracten(k.data ?? []); setPolissen(p.data ?? []); setLaden(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ondernemingId, leadIds.join(","), herlaad]);

  const bav = useBavRijen([ondernemingId], leadIds);
  const bavRijen = (bav.data ?? []).filter((r) => r.onderneming_id === ondernemingId || (r.lead_id && leadIds.includes(r.lead_id)));
  // Regel: alleen contracten zonder einddatum en geldige polissen krijgen een knop Beeindigen.
  const lopendC = contracten.filter((c) => c.status === "actief" && contractEindStatus(c).soort === "lopend");
  const lopendP = polissen.filter((p) => p.status === "geldig");

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-base">{titel ?? `Contracten en polissen: ${ondernemingNaam}`}</CardTitle>
        {mag && (lopendC.length + lopendP.length > 1) && <Button size="sm" variant="outline" onClick={() => setDialoog({ c: lopendC.map((c) => c.id), p: lopendP.map((p) => p.id) })}>Alles beeindigen</Button>}
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {laden ? <Loader2 className="h-4 w-4 animate-spin" /> : contracten.length + polissen.length === 0 ? <p className="text-muted-foreground">Geen contracten of polissen.</p> : (
          <>
            {contracten.map((c) => {
              const es = contractEindStatus(c);
              return (
              <div key={c.id} className="flex flex-wrap items-center gap-2 rounded border border-border p-2">
                <span className="font-medium">{PRODUCT_LABEL[c.product as Product] ?? c.product}</span>
                <BavNummer keuze={kiesBavNummer(bavRijen, { contractId: c.id })} />
                <span className="text-xs text-muted-foreground">regel {c.bron_rij} · {c.cyclus} · gefactureerd t/m {formatDateNL(c.gefactureerd_tm)}</span>
                {es.soort === "beeindigd" ? <Badge variant="outline">Beeindigd{es.datum ? ` per ${formatDateNL(es.datum)}` : ""}</Badge>
                  : es.soort === "loopt_af" ? <Badge variant="secondary">Loopt af per {formatDateNL(es.datum)}</Badge>
                  : <Badge variant="secondary">actief</Badge>}
                {mag && es.soort === "lopend" && c.status === "actief" && <Button size="sm" variant="destructive" className="ml-auto" onClick={() => setDialoog({ c: [c.id], p: [] })}>Beeindigen</Button>}
                {!readOnly && isSupervisorOrAdmin && es.soort !== "lopend" && c.eind_datum && <Button size="sm" variant="outline" className="ml-auto" onClick={() => setWijzig(c)}>Einddatum wijzigen</Button>}
              </div>); })}
            {polissen.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center gap-2 rounded border border-border p-2">
                <span className="font-medium">Polis</span>
                <BavNummer keuze={kiesBavNummer(bavRijen, { policyId: p.id })} />
                <span className="text-xs text-muted-foreground">{p.package_type} · {p.insured_name} · start {formatDateNL(p.start_date)}</span>
                {p.status === "geldig" ? <Badge variant="secondary">actief</Badge>
                  : <Badge variant="outline" title={p.intrek_reden ?? ""}>Beeindigd{p.ingetrokken_op ? ` per ${formatDateNL(p.ingetrokken_op)}` : ""}</Badge>}
                {mag && p.status === "geldig" && <Button size="sm" variant="destructive" className="ml-auto" onClick={() => setDialoog({ c: [], p: [p.id] })}>Beeindigen</Button>}
              </div>))}
          </>
        )}
      </CardContent>
      {dialoog && <BeeindigDialoog ondernemingId={ondernemingId} ondernemingNaam={ondernemingNaam} persoonId={persoonId}
        contracten={lopendC} polissen={lopendP} start={dialoog} onSluit={() => setDialoog(null)}
        onKlaar={() => { setDialoog(null); setHerlaad((x) => x + 1); onGewijzigd?.(); }} />}
      {wijzig && <EinddatumDialoog contract={wijzig} onSluit={() => setWijzig(null)}
        onKlaar={() => { setWijzig(null); setHerlaad((x) => x + 1); onGewijzigd?.(); }} />}
    </Card>
  );
}

function BeeindigDialoog({ ondernemingId, ondernemingNaam, persoonId, contracten, polissen, start, onSluit, onKlaar }: {
  ondernemingId: string; ondernemingNaam: string; persoonId?: string | null; contracten: any[]; polissen: any[];
  start: { c: string[]; p: string[] }; onSluit: () => void; onKlaar: () => void;
}) {
  const { user } = useAuth();
  const [c, setC] = useState<Set<string>>(new Set(start.c));
  const [p, setP] = useState<Set<string>>(new Set(start.p));
  const [datum, setDatum] = useState(vandaag());
  const [reden, setReden] = useState("opzegging_klant");
  const [toelichting, setToelichting] = useState("");
  const [bestanden, setBestanden] = useState<File[]>([]);
  const [mail, setMail] = useState(false);
  const [stap, setStap] = useState<"invoer" | "bevestig">("invoer");
  const [bezig, setBezig] = useState(false);
  const wissel = (s: Set<string>, set: (x: Set<string>) => void, id: string) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); set(n); };
  const geldig = c.size + p.size > 0 && datum && toelichting.trim().length >= 3;

  async function uitvoeren() {
    setBezig(true);
    const { data, error } = await supabase.rpc("crm_beeindig", {
      _onderneming_id: ondernemingId, _contract_ids: Array.from(c), _policy_ids: Array.from(p),
      _einddatum: datum, _reden: reden, _toelichting: toelichting, _persoon_id: persoonId ?? null,
    } as any);
    if (error) { setBezig(false); toast.error(error.message); return; }
    const res = data as any;
    if (bestanden.length && user && res?.notitie_id) (await uploadBijlagen(res.notitie_id, bestanden, user.id)).forEach((f) => toast.error(f));
    const credits = (res?.credits ?? []) as any[];
    const tekst = credits.map((x) => `regel ${x.bron_rij}: ${x.status === "niet_nodig" ? "geen creditnota nodig" : x.status === "te_maken" ? "concept-creditnota klaargezet" : x.status}${x.melding ? ` (${x.melding})` : ""}`).join("; ");
    toast.success(`Beeindigd.${tekst ? " " + tekst : ""}`, { duration: 8000 });
    if (mail && res?.notitie_id) {
      const { error: mErr } = await supabase.functions.invoke("crm-beeindiging-bevestiging", { body: { notitie_id: res.notitie_id } });
      if (mErr) toast.error("Bevestiging aan klant niet verstuurd: " + mErr.message); else toast.success("Bevestiging aan klant verstuurd");
    }
    setBezig(false);
    onKlaar();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onSluit()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Beeindigen bij {ondernemingNaam}</DialogTitle>
          <DialogDescription>Er wordt niets verwijderd. Contract krijgt een einddatum, polis wordt ingetrokken met reden, te veel gefactureerd wordt alleen als concept-creditnota klaargezet.</DialogDescription>
        </DialogHeader>
        {stap === "invoer" ? (
          <div className="space-y-3 text-sm">
            <div className="space-y-1">
              {contracten.map((x) => <label key={x.id} className="flex items-center gap-2"><Checkbox checked={c.has(x.id)} onCheckedChange={() => wissel(c, setC, x.id)} />Contract regel {x.bron_rij}: {PRODUCT_LABEL[x.product as Product] ?? x.product}</label>)}
              {polissen.map((x) => <label key={x.id} className="flex items-center gap-2"><Checkbox checked={p.has(x.id)} onCheckedChange={() => wissel(p, setP, x.id)} />Polis {x.certificate_number ?? "zonder nummer"}</label>)}
            </div>
            <div><Label>Einddatum</Label><Input type="date" value={datum} onChange={(e) => setDatum(e.target.value)} /><p className="text-xs text-muted-foreground">Mag in het verleden liggen, bijvoorbeeld bij een eerdere telefonische opzegging.</p></div>
            <div><Label>Reden</Label>
              <Select value={reden} onValueChange={setReden}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(STOP_REDENEN).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Toelichting (verplicht)</Label><Textarea value={toelichting} onChange={(e) => setToelichting(e.target.value)} rows={3} /></div>
            <BijlageKiezer bestanden={bestanden} onChange={setBestanden} />
            <label className="flex items-center gap-2"><Checkbox checked={mail} onCheckedChange={(v) => setMail(v === true)} />Stuur bevestiging van beeindiging naar de klant</label>
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            <p className="font-medium">Controleer en bevestig</p>
            <ul className="list-disc pl-5">
              {contracten.filter((x) => c.has(x.id)).map((x) => <li key={x.id}>Contract regel {x.bron_rij} ({PRODUCT_LABEL[x.product as Product] ?? x.product}) eindigt per {formatDateNL(datum)}</li>)}
              {polissen.filter((x) => p.has(x.id)).map((x) => <li key={x.id}>Polis {x.certificate_number ?? "zonder nummer"} wordt ingetrokken</li>)}
            </ul>
            <p>Reden: {STOP_REDENEN[reden]}</p>
            <p className="whitespace-pre-wrap">Toelichting: {toelichting}</p>
            {bestanden.length > 0 && <p>Bijlagen: {bestanden.length}</p>}
            <p>Facturatie stopt na de einddatum. Is er al verder gefactureerd, dan komt er een concept-creditnota klaar ter goedkeuring.</p>
            <p>Mail aan klant: {mail ? "ja, bevestiging wordt verstuurd" : "nee"}</p>
          </div>
        )}
        <DialogFooter className="gap-2">
          {stap === "invoer"
            ? <><Button variant="outline" onClick={onSluit}>Annuleren</Button><Button disabled={!geldig} onClick={() => setStap("bevestig")}>Verder</Button></>
            : <><Button variant="outline" onClick={() => setStap("invoer")} disabled={bezig}>Terug</Button><Button variant="destructive" onClick={uitvoeren} disabled={bezig}>{bezig && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Definitief beeindigen</Button></>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EinddatumDialoog({ contract, onSluit, onKlaar }: { contract: any; onSluit: () => void; onKlaar: () => void }) {
  const [datum, setDatum] = useState<string>(contract.eind_datum ?? vandaag());
  const [reden, setReden] = useState("");
  const [bezig, setBezig] = useState(false);
  async function opslaan() {
    setBezig(true);
    const { data, error } = await supabase.rpc("crm_einddatum_wijzigen" as any, { _contract_id: contract.id, _einddatum: datum, _reden: reden } as any);
    setBezig(false);
    if (error) { toast.error(error.message); return; }
    const n = (data as any)?.creditregels_bijgewerkt ?? 0;
    toast.success(`Einddatum gewijzigd.${n ? " Het creditnotavoorstel wordt opnieuw berekend." : ""}`);
    onKlaar();
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onSluit()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Einddatum wijzigen</DialogTitle>
          <DialogDescription>Huidige einddatum {formatDateNL(contract.eind_datum)}. De wijziging wordt vastgelegd in de tijdlijn en het auditlog.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div><Label>Nieuwe einddatum</Label><Input type="date" value={datum} onChange={(e) => setDatum(e.target.value)} /></div>
          <div><Label>Reden (verplicht)</Label><Textarea value={reden} onChange={(e) => setReden(e.target.value)} rows={3} /></div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onSluit}>Annuleren</Button>
          <Button onClick={opslaan} disabled={bezig || reden.trim().length < 3 || !datum || datum === contract.eind_datum}>{bezig && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Opslaan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

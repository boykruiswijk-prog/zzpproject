import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatDateNL } from "@/lib/dateFormat";

type BavOptie = { nummer: string; bron: string; datum: string | null; bevestigd?: boolean };
type Kandidaat = {
  onderneming_id: string; naam: string; kvk: string | null; exact_relatie_code: string | null; klant_sinds: string | null;
  signalen: string[]; entiteit_opzegging: boolean; partner: string | null; actieve_contracten: number;
  bav_nummers: BavOptie[]; beslissing: { keuze: string; bav_nummer: string | null; beslist_op: string } | null;
};

const HERKOMST: Record<string, string> = { zp: "ZP-certificaat", bevestigd: "bevestigd door team", klant: "opgegeven door klant (opzegging/serviceaanvraag)", overgenomen: "eerder overgenomen" };

export function useOmzettingKandidaten(leadId: string) {
  return useQuery({
    queryKey: ["omzetting-kandidaten", leadId],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("omzetting_kandidaten", { _lead_id: leadId });
      if (error) throw error;
      return data as { eigen_onderneming_id: string | null; kandidaten: Kandidaat[] };
    },
  });
}

/** Label "mogelijke omzetting" naast de leadtitel. */
export function OmzettingLabel({ leadId }: { leadId: string }) {
  const { data } = useOmzettingKandidaten(leadId);
  const open = (data?.kandidaten ?? []).filter((k) => !k.beslissing);
  if (!open.length) return null;
  return <Badge variant="outline" className="mt-1 border-primary text-primary">Mogelijke omzetting</Badge>;
}

/** Voorstel op de lead: lijkt op een bestaande klant met ander KvK-nummer. Niets gebeurt automatisch. */
export function OmzettingKaart({ leadId, magBeslissen }: { leadId: string; magBeslissen: boolean }) {
  const { data } = useOmzettingKandidaten(leadId);
  const kandidaten = data?.kandidaten ?? [];
  if (!kandidaten.length) return null;
  return <>{kandidaten.map((k) => <KandidaatKaart key={k.onderneming_id} leadId={leadId} k={k} eigenOnd={data?.eigen_onderneming_id ?? null} magBeslissen={magBeslissen} />)}</>;
}

function KandidaatKaart({ leadId, k, eigenOnd, magBeslissen }: { leadId: string; k: Kandidaat; eigenOnd: string | null; magBeslissen: boolean }) {
  const qc = useQueryClient();
  const { data: leidend } = useQuery({
    queryKey: ["omzetting-leidend-bav", k.onderneming_id],
    queryFn: async () => ((await (supabase.rpc as any)("omzetting_leidend_bav", { _van: k.onderneming_id })).data ?? null) as BavOptie | null,
  });
  const nummer = leidend?.nummer ?? "";
  const { data: afas = [] } = useQuery({
    queryKey: ["afas-voorganger", k.onderneming_id],
    queryFn: async () => Array.from(new Set((((await (supabase.from as any)("crm_bav_nummers").select("nummer").eq("onderneming_id", k.onderneming_id).eq("bron", "afas_abonnement")).data ?? []) as any[]).map((r) => r.nummer as string))),
  });
  const overige = k.bav_nummers.filter((b) => b.nummer !== nummer && b.bron !== "overgenomen");
  const [toelichting, setToelichting] = useState("");
  const [bezig, setBezig] = useState(false);
  const voorstelNummer = nummer || "onbekend";

  const { data: afwijkend = [], refetch: herlaadPolissen } = useQuery({
    queryKey: ["omzetting-polissen", leadId, k.beslissing?.bav_nummer],
    enabled: k.beslissing?.keuze === "omzetting",
    queryFn: async () => ((await supabase.from("policies").select("id,certificate_number").eq("lead_id", leadId).eq("status", "geldig")).data ?? [])
      .filter((p) => p.certificate_number !== k.beslissing?.bav_nummer),
  });

  // Al geactiveerd met een eigen nummer? Dan nummer vervangen door het overgenomen BAV-nummer en PDF opnieuw maken (geen mail).
  async function certificaatBijwerken() {
    setBezig(true);
    const { data: pol } = await supabase.from("policies").select("id,certificate_number").eq("lead_id", leadId).eq("status", "geldig");
    for (const p of pol ?? []) {
      const { data: r, error: e } = await supabase.functions.invoke("generate-certificate", { body: { actie: "nummer_overnemen", policy_id: p.id } });
      if (e || (r as any)?.error) {
        let reden = (r as any)?.error ?? null;
        try { reden = reden ?? (await (e as any)?.context?.json?.())?.error; } catch { /* geen body */ }
        toast.error(`Certificaat ${p.certificate_number} niet bijgewerkt: ${reden ?? e?.message}`);
      } else if ((r as any)?.gewijzigd !== false) toast.success(`Certificaat ${p.certificate_number} vervangen door ${(r as any)?.policy?.certificate_number}`);
    }
    setBezig(false);
    qc.invalidateQueries({ queryKey: ["lead", leadId] });
    herlaadPolissen();
  }

  async function kies(keuze: "omzetting" | "nieuwe_klant") {
    setBezig(true);
    const { error } = await (supabase.rpc as any)("omzetting_vastleggen", { _lead_id: leadId, _van: k.onderneming_id, _keuze: keuze, _bav_nummer: keuze === "omzetting" ? nummer : null, _toelichting: toelichting });
    setBezig(false);
    if (error) { toast.error(error.message); return; }
    toast.success(keuze === "omzetting" ? `Omzetting vastgelegd, leidend BAV-nummer ${nummer}` : "Vastgelegd als nieuwe klant");
    if (keuze === "omzetting") await certificaatBijwerken();
    qc.invalidateQueries({ queryKey: ["omzetting-kandidaten", leadId] });
    qc.invalidateQueries({ queryKey: ["bav-nummers"] });
  }

  return (
    <Card className="border-primary/40">
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <Badge variant="outline" className="border-primary text-primary">Mogelijke omzetting</Badge>
          <span className="break-words">Lijkt op <Link to={`/admin/klanten/${k.onderneming_id}`} className="text-primary hover:underline">{k.naam}</Link>, BAV-nummer {voorstelNummer}, klant sinds {formatDateNL(k.klant_sinds)}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div>
          <p className="text-muted-foreground">Matcht op:</p>
          <ul className="list-disc pl-5">{k.signalen.map((s) => <li key={s} className="break-words">{s}</li>)}</ul>
          <p className="mt-1 text-xs text-muted-foreground">Exact-relatiecode {k.exact_relatie_code ?? "onbekend"} · KvK voorganger {k.kvk ?? "onbekend"}</p>
        </div>
        {k.actieve_contracten > 0 && (
          <p role="note" className="rounded-md border border-amber-500/50 bg-amber-500/10 p-2 text-xs">
            Ter info: {k.naam} heeft nog {k.actieve_contracten} lopend contract. Er wordt niets automatisch beëindigd of gecrediteerd; een opzegging verwerk je via de bestaande opzegflow. Sommige klanten betalen bewust een periode dubbel.
          </p>
        )}
        {k.beslissing ? (
          <p className="rounded-md bg-muted p-2">
            {k.beslissing.keuze === "omzetting" ? `Omzetting vastgelegd: BAV-nummer ${k.beslissing.bav_nummer} overgenomen` : "Vastgelegd als nieuwe klant"} op {formatDateNL(k.beslissing.beslist_op)}.
          </p>
        ) : null}
        {k.beslissing?.keuze === "omzetting" && afwijkend.length > 0 && magBeslissen && (
          <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-2 text-xs space-y-2">
            <p>Het certificaat staat nog op {afwijkend.map((p) => p.certificate_number).join(", ")}. Dit moet {k.beslissing.bav_nummer} zijn. Het oude nummer blijft zichtbaar als vervangen; er gaat geen mail uit.</p>
            <Button size="sm" disabled={bezig} onClick={certificaatBijwerken}>Certificaat bijwerken naar {k.beslissing.bav_nummer}</Button>
          </div>
        )}
        {k.beslissing ? null
        ) : k.partner ? (
          <p className="rounded-md bg-muted p-2">Via partner {k.partner}, nieuw nummer. Het BAV-nummer van de voorganger wordt niet overgenomen.</p>
        ) : !magBeslissen ? (
          <p className="text-muted-foreground">Een collega met de rol verzekering, supervisor of admin beslist hierover.</p>
        ) : (
          <div className="space-y-2">
            {!eigenOnd && <p className="text-xs text-amber-700">De nieuwe onderneming staat nog niet in het CRM; omzetting kan pas daarna.</p>}
            <div className="rounded border border-primary p-2">
              <p>Leidend BAV-nummer van de voorganger: <span className="font-medium tabular-nums">{nummer || "onbekend"}</span>{leidend && <span className="text-xs text-muted-foreground"> {HERKOMST[leidend.bron] ?? leidend.bron}{leidend.datum ? `, sinds ${formatDateNL(leidend.datum)}` : ""}</span>}</p>
              {overige.length > 0 && <p className="mt-1 text-xs text-muted-foreground">Gaat ook mee en blijft zichtbaar: {overige.map((b) => `${b.nummer} (${HERKOMST[b.bron] ?? b.bron}${b.datum ? `, ${formatDateNL(b.datum)}` : ""})`).join(", ")}</p>}
              {leidend && leidend.bevestigd === false && <p className="mt-1 text-xs text-amber-700">Dit nummer is opgegeven door de klant en nog niet bevestigd. Met de knop hieronder bevestig je het en leg je de omzetting vast.</p>}
              {afas.length > 0 && <p className="mt-1 text-xs text-muted-foreground">AFAS-abonnementsnummer (oud systeem), geen BAV-nummer, gaat als historie mee: {afas.join(", ")}</p>}
              <p className="mt-1 text-xs text-muted-foreground">De BV houdt hetzelfde BAV-nummer; er komt geen nieuw nummer.</p>
            </div>
            <div><Label>Toelichting (optioneel)</Label><Textarea rows={2} value={toelichting} onChange={(e) => setToelichting(e.target.value)} /></div>
            <p className="text-xs text-muted-foreground">Startertarief blijft bij omzetting standaard aan; afwijzen kan in de startertarief-beoordeling. Exact: de BV is een eigen debiteur met een eigen Exact-relatiecode uit de Exact-koppeling (via de gewone activatie); de Exact-relatiecode van de voorganger ({k.exact_relatie_code ?? "onbekend"}) wordt niet overgenomen.</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={bezig || !nummer || !eigenOnd} onClick={() => kies("omzetting")}>{bezig && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{leidend?.bevestigd === false ? `BAV-nummer ${nummer} bevestigen en omzetting vastleggen` : "Omzetting: BAV-nummer en historie overnemen"}</Button>
              <Button size="sm" variant="outline" disabled={bezig} onClick={() => kies("nieuwe_klant")}>Nieuwe klant</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Op de klantkaart van de opvolger: rechtsvoorganger met overgenomen BAV-nummer. */
export function RechtsvoorgangerBanner({ ondernemingId, herlaad = 0 }: { ondernemingId: string; herlaad?: number }) {
  const { data } = useQuery({
    queryKey: ["rechtsvoorganger", ondernemingId, herlaad],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("onderneming_opvolging").select("van_onderneming_id,ingangsdatum,bav_nummer,bav_nummer_herkomst").eq("naar_onderneming_id", ondernemingId);
      const rijen = (data ?? []) as any[];
      if (!rijen.length) return [];
      const { data: onds } = await supabase.from("ondernemingen").select("id,naam,created_at,exact_relatie_code").in("id", rijen.map((r) => r.van_onderneming_id));
      const { data: kc } = await supabase.from("klant_contracten").select("onderneming_id,begin_datum,abonnement_nr").in("onderneming_id", rijen.map((r) => r.van_onderneming_id));
      return rijen.map((r) => {
        const o = (onds ?? []).find((x) => x.id === r.van_onderneming_id);
        const data = [o?.created_at?.slice(0, 10), ...(kc ?? []).filter((c) => c.onderneming_id === r.van_onderneming_id).map((c) => c.begin_datum)].filter(Boolean).sort();
        return { ...r, naam: o?.naam ?? "onbekend", relatiecode: (o as any)?.exact_relatie_code ?? null, afas: Array.from(new Set((kc ?? []).filter((c: any) => c.onderneming_id === r.van_onderneming_id && c.abonnement_nr).map((c: any) => c.abonnement_nr))), sinds: data[0] ?? null };
      });
    },
  });
  if (!data?.length) return null;
  return (
    <div className="space-y-1">{data.map((r) => (
      <div key={r.van_onderneming_id} className="rounded-md border border-primary/40 bg-primary/5 p-3 text-sm">
        Rechtsvoorganger <Link to={`/admin/klanten/${r.van_onderneming_id}`} className="font-medium text-primary hover:underline">{r.naam}</Link> (per {formatDateNL(r.ingangsdatum)}), klant sinds {formatDateNL(r.sinds)}.
        {r.bav_nummer && <> Leidend BAV-nummer {r.bav_nummer} overgenomen ({HERKOMST[r.bav_nummer_herkomst] ?? r.bav_nummer_herkomst}); overige BAV-nummers van de voorganger staan erbij.</>} Exact-relatiecode voorganger (historie): {r.relatiecode ?? "onbekend"}.{r.afas.length > 0 && <> AFAS-abonnementsnummer (oud systeem) voorganger: {r.afas.join(", ")}.</>} Historie staat onderaan deze kaart.
      </div>
    ))}</div>
  );
}

/** Beheer van partners/collectieven (supervisor/admin). Niets wordt verwijderd; uitzetten kan. */
export function PartnerBronnenBeheer() {
  const qc = useQueryClient();
  const [naam, setNaam] = useState(""); const [term, setTerm] = useState("");
  const { data } = useQuery({ queryKey: ["partner-bronnen"], queryFn: async () => ((await (supabase.from as any)("partner_bronnen").select("*").order("naam")).data ?? []) as any[] });
  async function toevoegen() {
    const { error } = await (supabase.from as any)("partner_bronnen").insert({ naam: naam.trim(), zoekterm: term.trim().toLowerCase() });
    if (error) toast.error(error.message); else { setNaam(""); setTerm(""); qc.invalidateQueries({ queryKey: ["partner-bronnen"] }); }
  }
  async function wissel(r: any) {
    const { error } = await (supabase.from as any)("partner_bronnen").update({ actief: !r.actief }).eq("id", r.id);
    if (error) toast.error(error.message); else qc.invalidateQueries({ queryKey: ["partner-bronnen"] });
  }
  return (
    <Card><CardHeader><CardTitle className="text-base">Partners en collectieven (geen BAV-nummer overnemen bij omzetting)</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">Een klant herkend aan deze zoekterm (naam, bron, product of leadherkomst) krijgt bij omzetting altijd een nieuw nummer.</p>
        {(data ?? []).map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-2 border-t border-border pt-2">
            <span>{r.naam} <span className="text-xs text-muted-foreground">zoekterm "{r.zoekterm}"</span></span>
            <Button size="sm" variant="outline" onClick={() => wissel(r)}>{r.actief ? "Uitzetten" : "Aanzetten"}</Button>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <Input placeholder="Naam partner" value={naam} onChange={(e) => setNaam(e.target.value)} className="max-w-48" />
          <Input placeholder="Zoekterm" value={term} onChange={(e) => setTerm(e.target.value)} className="max-w-48" />
          <Button size="sm" disabled={naam.trim().length < 2 || term.trim().length < 3} onClick={toevoegen}>Toevoegen</Button>
        </div>
      </CardContent>
    </Card>
  );
}

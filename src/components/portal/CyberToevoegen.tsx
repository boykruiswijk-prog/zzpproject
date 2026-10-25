import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cyberToevoegenPreview } from "@/config/cyberToevoegen";
import { cyberVerzoekFout, CYBER_VERZOEK_STATUS } from "@/lib/cyberToevoegen";
import { CYBER, CYBER_AKKOORD, CYBER_OPZEGTEKST, CYBER_VRAGEN, formatPremieBedrag, type CyberAntwoorden } from "../../../supabase/functions/_shared/cyber";
import { CyberVragen } from "@/components/verzekeringen/CyberVragen";
import { CyberAfwijzing } from "@/components/verzekeringen/CyberAfwijzing";
import { vroegsteIngangsdatum } from "@/lib/ingangsdatum";
import { formatDateNL } from "@/lib/dateFormat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { ShieldPlus, Loader2 } from "lucide-react";
import { controleerAdminMfa, verwerkMfaFout } from "@/lib/adminMfaStap";
import { useToonTestrecords } from "@/hooks/useToonTestrecords";

type Optie = { policy_id: string; label: string; cyclus: string };
type Verzoek = { id: string; policy_id: string; status: string; is_test?: boolean; geactiveerd_op?: string | null; mail_status?: string; gewenste_ingangsdatum: string; beoordeling_notitie: string | null; notitie: string; antwoorden: unknown; bron: string };

export function CyberToevoegen({ ondernemingId, team = false }: { ondernemingId?: string; team?: boolean }) {
  const zichtbaar = cyberToevoegenPreview();
  const { toonTest } = useToonTestrecords();
  const [opties, setOpties] = useState<Optie[]>([]);
  const [verzoeken, setVerzoeken] = useState<Verzoek[]>([]);
  const [open, setOpen] = useState(false);
  const [policyId, setPolicyId] = useState("");
  const [antwoorden, setAntwoorden] = useState<CyberAntwoorden>({});
  const [datum, setDatum] = useState(vroegsteIngangsdatum);
  const [akkoord, setAkkoord] = useState(false);
  const [notitie, setNotitie] = useState("");
  const [beoordelingen, setBeoordelingen] = useState<Record<string, string>>({});
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState("");
  const [geladen, setGeladen] = useState(false);
  const [resultaat, setResultaat] = useState("");
  const [redenen, setRedenen] = useState<{ nummer: string; reden: string }[]>([]);

  async function laad() {
    const optiesResultaat = await supabase.rpc("cyber_toevoegen_opties", { _onderneming_id: ondernemingId ?? undefined });
    let query = supabase.from("cyber_toevoeg_verzoeken").select("*").order("created_at", { ascending: false });
    if (team && ondernemingId) {
      query = query.eq("onderneming_id", ondernemingId);
      if (!toonTest) query = query.eq("is_test", false);
    }
    const verzoekResultaat = await query;
    if (optiesResultaat.error || verzoekResultaat.error) { setFout("Cyberverzoeken konden niet worden geladen. Probeer opnieuw."); return; }
    const rijen = verzoekResultaat.data ?? [];
    setVerzoeken(rijen);
    const o = (optiesResultaat.data as unknown as Optie[]) ?? [];
    setOpties(o.filter((p) => !rijen.some((r) => r.policy_id === p.policy_id && r.status !== "afgewezen")));
    if (team && ondernemingId) {
      const r = await supabase.rpc("cyber_toevoegen_redenen" as never, { _onderneming_id: ondernemingId } as never);
      setRedenen(((r.data as unknown) as { nummer: string; reden: string }[]) ?? []);
    }
    setGeladen(true);
  }
  useEffect(() => { if (zichtbaar && (!team || ondernemingId)) void laad(); }, [zichtbaar, ondernemingId, team, toonTest]);

  async function indienen(e: React.FormEvent) {
    e.preventDefault();
    const validatie = cyberVerzoekFout(antwoorden, datum, akkoord, team, notitie);
    if (validatie) { setFout(validatie); return; }
    setBezig(true); setFout("");
    try {
      if (team && !await controleerAdminMfa()) return;
      const { data, error } = await supabase.rpc("cyber_toevoegen_aanvragen", { _policy_id: policyId, _antwoorden: antwoorden, _ingang: datum, _akkoord: akkoord, _notitie: notitie, _namens_klant: team });
      if (error) throw error;
      setResultaat(`Verzoek ontvangen. Referentie ${data}. Cyber is nog niet actief; je verzoek wordt handmatig beoordeeld.`);
      setOpen(false); await laad();
    } catch (e) { if (team) await verwerkMfaFout(e); setFout((e as { message?: string })?.message ?? "Je verzoek kon niet worden opgeslagen. Probeer opnieuw."); }
    finally { setBezig(false); }
  }
  async function beoordeel(id: string, keuze: boolean) {
    setBezig(true); setFout("");
    try {
      if (!await controleerAdminMfa()) return;
      const { data, error } = await supabase.functions.invoke("cyber-toevoegen-activeren", { body: { id, akkoord: keuze, notitie: beoordelingen[id] ?? "" } });
      if (error || data?.error) throw error ?? new Error(data.error);
      await laad();
    } catch (e) { await verwerkMfaFout(e); setFout((e as { message?: string })?.message ?? "Beoordeling kon niet worden opgeslagen."); }
    finally { setBezig(false); }
  }
  async function mailOpnieuw(id: string) {
    setBezig(true); setFout("");
    try {
      if (!await controleerAdminMfa()) return;
      const { data, error } = await supabase.functions.invoke("cyber-toevoegen-activeren", { body: { id, akkoord: true, notitie: "Cyberbevestiging handmatig opnieuw versturen", retryMail: true } });
      if (error || data?.error) throw error ?? new Error(data.error);
      await laad();
    } catch (e) { await verwerkMfaFout(e); setFout((e as { message?: string })?.message ?? "Mail kon niet worden verstuurd."); }
    finally { setBezig(false); }
  }
  if (!zichtbaar || (!team && geladen && !opties.length && !verzoeken.length && !fout)) return null;
  const gekozen = opties.find((o) => o.policy_id === policyId);
  return <section className="space-y-4 border-t border-border py-6">
    <h2 className="flex items-center gap-2 text-xl font-semibold"><ShieldPlus className="h-5 w-5 text-accent" />Cyber toevoegen</h2>
    {team && geladen && !opties.length && !verzoeken.some((r) => r.status !== "afgewezen") && !fout && <div role="status" className="text-sm text-muted-foreground">
      <p>Bij deze klant kan nu geen cyber worden toegevoegd.</p>
      {redenen.length ? <ul className="list-disc pl-5">{redenen.map((r) => <li key={r.nummer}>{r.nummer}: {r.reden}</li>)}</ul> : <p>Er staat geen geldig BAV + AVB-certificaat bij deze klantkaart.</p>}
    </div>}
    {opties.length > 0 && <>
      <p className="text-sm">€{formatPremieBedrag(CYBER.jaarprijs)} per jaar of €{formatPremieBedrag(CYBER.maandprijs)} per maand, inclusief kosten en assurantiebelasting.</p>
      <p className="text-sm">{CYBER_OPZEGTEKST.split(" Bij maandbetaling:")[0]}</p>
      <p className="text-sm">Looptijd 12 maanden vanaf de cyberingangsdatum, daarna stilzwijgend verlengd met 12 maanden.</p>
      {!open && <Button onClick={() => { setPolicyId(opties[0].policy_id); setOpen(true); setFout(""); }}>Cyber toevoegen</Button>}
    </>}
    {resultaat && <p role="status" className="text-sm">{resultaat}</p>}
    {fout && <div role="alert" className="text-sm text-destructive">{fout}{!geladen && <Button variant="outline" onClick={() => { setFout(""); void laad(); }}>Opnieuw proberen</Button>}</div>}
    {open && <form onSubmit={indienen} className="space-y-5">
      {opties.length > 1 && <div><Label htmlFor="cyber-polis">Polis</Label><select id="cyber-polis" className="w-full rounded-md border border-input bg-background p-2" value={policyId} onChange={(e) => setPolicyId(e.target.value)}>{opties.map((o) => <option key={o.policy_id} value={o.policy_id}>{o.label}</option>)}</select></div>}
      <p className="text-sm text-muted-foreground">Polis {gekozen?.label}. Cyber: {gekozen?.cyclus === "jaar" ? `€${formatPremieBedrag(CYBER.jaarprijs)} per jaar` : `€${formatPremieBedrag(CYBER.maandprijs)} per maand`}, inclusief kosten en assurantiebelasting.</p>
      <CyberVragen antwoorden={antwoorden} onChange={(a) => { setAntwoorden(a); setFout(""); }} />
      <CyberAfwijzing antwoorden={antwoorden} />
      <div className="space-y-2"><Label htmlFor="cyber-ingang">Gewenste ingangsdatum</Label><Input id="cyber-ingang" type="date" min={vroegsteIngangsdatum()} required value={datum} onChange={(e) => setDatum(e.target.value)} /></div>
      {team && <div className="space-y-2"><Label htmlFor="cyber-teamnotitie">Notitie namens de klant</Label><Textarea id="cyber-teamnotitie" required minLength={10} maxLength={1000} value={notitie} onChange={(e) => setNotitie(e.target.value)} /></div>}
      <div className="flex items-start gap-3"><Checkbox id="cyber-later-akkoord" checked={akkoord} onCheckedChange={(v) => setAkkoord(v === true)} /><Label htmlFor="cyber-later-akkoord" className="text-sm leading-relaxed">{CYBER_AKKOORD}</Label></div>
      <p className="text-sm text-muted-foreground">Je verzoek wordt handmatig beoordeeld. Na akkoord gaat de dekking in op de gekozen ingangsdatum.</p>
      <div className="flex flex-wrap gap-2"><Button type="submit" disabled={bezig}>{bezig && <Loader2 className="h-4 w-4 animate-spin" />}Verzoek indienen</Button><Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuleren</Button></div>
    </form>}
    {verzoeken.map((r) => <div key={r.id} className="space-y-3 border-b border-border py-4 text-sm">
      {team && r.is_test && <p className="font-semibold text-destructive">{r.notitie === "TEST E4 jaar" || r.notitie === "TEST E4 maand" ? r.notitie : "TEST"}</p>}
      <p className="font-medium">{r.geactiveerd_op ? "Cyber toegevoegd" : CYBER_VERZOEK_STATUS[r.status]}</p><p>Gewenste ingang {formatDateNL(r.gewenste_ingangsdatum)}</p><p className="break-all text-muted-foreground">Referentie {r.id}</p>
      {r.beoordeling_notitie && <p>{r.beoordeling_notitie}</p>}
      {team && r.geactiveerd_op && (r.mail_status === "mail_mislukt" || r.mail_status === "mislukt") && <div role="alert"><p>Bevestigingsmail niet verstuurd.</p><Button variant="outline" disabled={bezig} onClick={() => mailOpnieuw(r.id)}>Opnieuw versturen</Button></div>}
      {team && r.geactiveerd_op && (r.mail_status === "mail_onzeker" || r.mail_status === "geclaimd") && <p role="status">Verzending nog niet bevestigd. Controleer eerst de verzendhistorie; niet opnieuw versturen.</p>}
      {team && <><dl className="space-y-3">{CYBER_VRAGEN.map((q) => <div key={q.id}><dt>{q.tekst}</dt><dd className="font-medium">{(r.antwoorden as CyberAntwoorden)[q.id] ? "Ja" : "Nee"}</dd></div>)}</dl><p>Ingediend door: {r.bron === "team" ? "Team namens klant" : "Klant"}</p>{r.notitie && <p>{r.notitie}</p>}</>}
      {team && r.status === "wacht_op_beoordeling" && <><Label htmlFor={`beoordeling-${r.id}`}>Toelichting bij de beoordeling</Label><Textarea id={`beoordeling-${r.id}`} minLength={10} maxLength={1000} value={beoordelingen[r.id] ?? ""} onChange={(e) => setBeoordelingen((b) => ({ ...b, [r.id]: e.target.value }))} /><p className="text-muted-foreground">Akkoord voegt cyber toe en start de aparte cyberfacturatie vanaf de gekozen ingangsdatum. BAV + AVB blijft ongewijzigd.</p><div className="flex gap-2"><Button disabled={bezig} onClick={() => beoordeel(r.id, true)}>Akkoord</Button><Button disabled={bezig} variant="outline" onClick={() => beoordeel(r.id, false)}>Afwijzen</Button></div></>}
    </div>)}
  </section>;
}
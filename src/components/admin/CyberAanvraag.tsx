import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Eye, Loader2, ShieldPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { controleerAdminMfa } from "@/lib/adminMfaStap";
import { cyberBeoordelingFout, cyberFunctieFout } from "@/lib/cyberBeoordeling";
import { formatDateNL } from "@/lib/dateFormat";
import { CYBER_VRAGEN, type CyberAntwoorden } from "../../../supabase/functions/_shared/cyber";

export interface CyberWerk {
  id: string; klant: string; bav_nummer: string; policy_id: string; onderneming_id: string;
  gewenste_ingangsdatum: string; betaalwijze: string; notitie: string; beoordeling_notitie: string | null;
  status: string; geactiveerd_op: string | null; certificaat_pad: string | null;
  antwoorden: CyberAntwoorden;
  certificaat_gecontroleerd_pad: string | null; certificaat_gecontroleerd_op: string | null;
  certificaat_mail_status: string; mail_status: string; created_at: string; is_test: boolean; open: boolean;
}
export function useCyberAanvragen(toonTest: boolean, enabled = true) {
  return useQuery({ queryKey: ["cyber-aanvragen", toonTest], enabled, refetchInterval: 60000,
    queryFn: async () => { const r = await supabase.rpc("cyber_aanvragen_werkvoorraad", { _toon_test: toonTest }); if (r.error) throw r.error; return r.data as unknown as CyberWerk[]; } });
}
export function cyberWerkStap(r: CyberWerk) {
  if (!r.open) return r.status === "afgewezen" ? "Afgewezen" : "Verstuurd";
  if (!r.geactiveerd_op) return r.status === "akkoord_wacht_op_activatie" ? "Polis activeren" : "Beoordelen";
  if (!r.certificaat_pad) return "Certificaat aanmaken";
  if (!r.certificaat_gecontroleerd_op || r.certificaat_gecontroleerd_pad !== r.certificaat_pad) return "Certificaat controleren";
  return "Certificaat versturen";
}
export function CyberAanvraag({ verzoek, autoOpen = true }: { verzoek: CyberWerk; autoOpen?: boolean }) {
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState(autoOpen && params.get("cyber") === verzoek.id);
  const [notitie, setNotitie] = useState(verzoek.beoordeling_notitie ?? "");
  const [pdf, setPdf] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState("");
  const qc = useQueryClient();
  async function actie(stap: "beoordelen" | "activeren" | "certificaat" | "versturen", akkoord = true) {
    if (stap === "beoordelen") { const e = cyberBeoordelingFout(notitie); if (e) { setFout(e); return; } }
    if (stap === "versturen" && !window.confirm("Eerst het gecontroleerde cybercertificaat versturen, daarna de bevestiging?")) return;
    setBezig(true); setFout("");
    try {
      if (!await controleerAdminMfa()) return;
      const r = await supabase.functions.invoke("cyber-toevoegen-activeren", { body: { id: verzoek.id, actie: stap, akkoord, notitie: stap === "beoordelen" ? notitie : verzoek.beoordeling_notitie ?? "Handmatige cyberaanvraagstap", retryMail: stap === "versturen" && ["mislukt", "mail_mislukt"].includes(verzoek.mail_status) } });
      if (r.error || r.data?.error) throw await cyberFunctieFout(r.error, r.data);
      if (r.data?.details) setFout(r.data.details);
      await qc.invalidateQueries();
    } catch (e) { setFout(e instanceof Error ? e.message : "Cyberstap mislukt"); } finally { setBezig(false); }
  }
  async function bekijken() {
    if (!verzoek.certificaat_pad) return;
    setBezig(true); setFout("");
    const r = await supabase.storage.from("certificates").createSignedUrl(verzoek.certificaat_pad, 3600);
    setBezig(false);
    if (r.error) setFout("Cybercertificaat kon niet worden geopend"); else setPdf(r.data.signedUrl);
  }
  async function controleren() {
    if (!pdf || !verzoek.certificaat_pad || !await controleerAdminMfa()) return;
    setBezig(true);
    const r = await supabase.rpc("cyber_certificaat_controleren", { _id: verzoek.id, _pad: verzoek.certificaat_pad });
    setBezig(false); if (r.error) setFout(r.error.message); else await qc.invalidateQueries();
  }
  const stap = cyberWerkStap(verzoek);
  const onzeker = ["geclaimd", "mail_onzeker"].includes(verzoek.mail_status) || ["geclaimd", "mail_onzeker"].includes(verzoek.certificaat_mail_status);
  return <>
    <Button variant="ghost" size="sm" onClick={() => setOpen(true)}><Eye className="h-4 w-4" />Bekijken</Button>
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o && params.get("cyber") === verzoek.id) { const p = new URLSearchParams(params); p.delete("cyber"); setParams(p, { replace: true }); } }}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><ShieldPlus className="h-5 w-5" />Cyber toevoegen: {verzoek.klant}</DialogTitle></DialogHeader>
        <Badge variant="outline">{stap}{verzoek.is_test ? " · TEST" : ""}</Badge>
        <dl className="grid grid-cols-2 gap-3 text-sm"><div><dt>BAV + AVB</dt><dd>{verzoek.bav_nummer}</dd></div><div><dt>Gewenste ingang</dt><dd>{formatDateNL(verzoek.gewenste_ingangsdatum)}</dd></div><div><dt>Betaalwijze</dt><dd>{verzoek.betaalwijze === "jaar" ? "Jaarlijks" : "Maandelijks"}</dd></div><div><dt>Notitie</dt><dd className="break-words">{verzoek.notitie || "Geen notitie"}</dd></div></dl>
        {fout && <p role="alert" className="text-sm text-destructive">{fout}</p>}
        {stap === "Beoordelen" && <dl className="space-y-2 text-sm">{CYBER_VRAGEN.map(v => <div key={v.id}><dt>{v.tekst}</dt><dd className="font-medium">{verzoek.antwoorden?.[v.id] === true ? "Ja" : "Nee"}</dd></div>)}</dl>}
        {stap === "Beoordelen" && <><Label htmlFor={`cyber-beoordeling-${verzoek.id}`}>Toelichting bij beoordeling</Label><Textarea id={`cyber-beoordeling-${verzoek.id}`} minLength={10} maxLength={1000} value={notitie} onChange={e => setNotitie(e.target.value)} /><div className="flex gap-2"><Button disabled={bezig} onClick={() => actie("beoordelen")}>Akkoord</Button><Button variant="outline" disabled={bezig} onClick={() => actie("beoordelen", false)}>Afwijzen</Button></div></>}
        {stap === "Polis activeren" && <Button disabled={bezig} onClick={() => actie("activeren")}>Polis activeren</Button>}
        {stap === "Certificaat aanmaken" && <Button disabled={bezig} onClick={() => actie("certificaat")}>Cybercertificaat aanmaken</Button>}
        {verzoek.certificaat_pad && <Button variant="outline" disabled={bezig} onClick={bekijken}><Eye className="h-4 w-4" />Cybercertificaat bekijken</Button>}
        {pdf && <><iframe title="Cybercertificaat ter controle" src={pdf} className="h-[55vh] w-full border border-border" />{stap === "Certificaat controleren" && <Button disabled={bezig} onClick={controleren}>Certificaat gecontroleerd</Button>}</>}
        {stap === "Certificaat versturen" && <Button disabled={bezig || onzeker} onClick={() => actie("versturen")}>Certificaat en bevestiging versturen</Button>}
        {onzeker && <p role="status" className="text-sm">Verzending nog niet bevestigd. Controleer de verzendhistorie; niet opnieuw versturen.</p>}
        {bezig && <Loader2 aria-label="Bezig" className="h-4 w-4 animate-spin" />}
      </DialogContent>
    </Dialog>
  </>;
}
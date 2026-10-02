import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { formatDateNL, formatDateTimeLongNL } from "@/lib/dateFormat";
import { Download, FileText, Loader2, Mail, Pencil, Ban, AlertTriangle } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Policy = Database["public"]["Tables"]["policies"]["Row"];

interface Props {
  leadId?: string;
  /** Eigen genereer-actie (bijv. bestaande klant met voorinvuldialoog). */
  onNieuw?: (bevestigNieuwNummer: boolean) => void;
  leadActief: boolean;
  policies: Policy[];
  isSupervisorOrAdmin: boolean;
  onChanged: () => void;
  onDownload: (pad: string) => void;
}

async function roep(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("generate-certificate", { body });
  if (error) {
    let msg = error.message;
    try { const j = await (error as any).context?.json?.(); if (j?.error) msg = j.error; } catch { /* */ }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export function CertificaatBeheer({ leadId, onNieuw, leadActief, policies, isSupervisorOrAdmin, onChanged, onDownload }: Props) {
  const { toast } = useToast();
  const [bezig, setBezig] = useState<string | null>(null);
  const [aanpassen, setAanpassen] = useState<Policy | null>(null);
  const [intrekken, setIntrekken] = useState<Policy | null>(null);
  const [extraNummer, setExtraNummer] = useState(false);
  const [form, setForm] = useState({ profession: "", certificate_holder: "", insured_name: "", start_date: "" });
  const [reden, setReden] = useState("");

  const geldig = policies.filter((p) => p.status === "geldig");
  const ids = policies.map((p) => p.id);
  const { data: versies, refetch: refetchVersies } = useQuery({
    queryKey: ["policy-versies", ...ids],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("policy_versies").select("*").in("policy_id", ids).order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const klaar = () => { onChanged(); refetchVersies(); };

  const nieuw = async (bevestig: boolean) => {
    if (onNieuw) { setExtraNummer(false); onNieuw(bevestig); return; }
    setBezig("nieuw");
    try {
      const r = await roep({ lead_id: leadId, bevestig_nieuw_nummer: bevestig });
      toast({ title: "Certificaat aangemaakt", description: `Nummer: ${r.policy.certificate_number}` });
      setExtraNummer(false);
      klaar();
    } catch (e: any) {
      toast({ title: "Fout", description: e.message, variant: "destructive" });
    } finally { setBezig(null); }
  };

  const openAanpassen = (p: Policy) => {
    setForm({ profession: p.profession ?? "", certificate_holder: p.certificate_holder ?? "", insured_name: p.insured_name ?? "", start_date: p.start_date ?? "" });
    setAanpassen(p);
  };

  const opslaan = async () => {
    if (!aanpassen) return;
    setBezig("aanpassen");
    try {
      await roep({ actie: "aanpassen", policy_id: aanpassen.id, wijzigingen: form });
      toast({ title: "Certificaat aangepast", description: `${aanpassen.certificate_number} opnieuw gemaakt. Er is niets gemaild.` });
      setAanpassen(null);
      klaar();
    } catch (e: any) {
      toast({ title: "Fout", description: e.message, variant: "destructive" });
    } finally { setBezig(null); }
  };

  const trekIn = async () => {
    if (!intrekken) return;
    setBezig("intrekken");
    try {
      await roep({ actie: "intrekken", policy_id: intrekken.id, reden });
      toast({ title: "Certificaat ingetrokken", description: `${intrekken.certificate_number} telt niet meer mee. Er is niets gemaild.` });
      setIntrekken(null); setReden("");
      klaar();
    } catch (e: any) {
      toast({ title: "Fout", description: e.message, variant: "destructive" });
    } finally { setBezig(null); }
  };

  const mail = async (p: Policy) => {
    if (!confirm(`Certificaat ${p.certificate_number} nu mailen naar de klant?`)) return;
    setBezig(`mail-${p.id}`);
    try {
      const r = await roep({ actie: "mailen", policy_id: p.id });
      toast({ title: "Certificaat gemaild", description: r.opmerking || `Verzonden naar ${r.verzonden_naar}` });
      refetchVersies();
    } catch (e: any) {
      toast({ title: "Mailen mislukt", description: e.message, variant: "destructive" });
    } finally { setBezig(null); }
  };

  return (
    <div className="space-y-3">
      {policies.map((p) => {
        const ingetrokken = p.status === "ingetrokken";
        return (
          <div key={p.id} className="p-2 bg-secondary rounded-lg space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-sm flex items-center gap-2 flex-wrap">
                  <span className={ingetrokken ? "line-through text-muted-foreground" : ""}>{p.certificate_number}</span>
                  <Badge variant={ingetrokken ? "destructive" : "secondary"}>{ingetrokken ? "Ingetrokken" : "Geldig"}</Badge>
                  {p.versie > 1 && <span className="text-xs text-muted-foreground">versie {p.versie}</span>}
                </p>
                <p className="text-xs text-muted-foreground truncate">Hoedanigheid: {p.profession}</p>
                <p className="text-xs text-muted-foreground">Afgifte {formatDateNL(p.issued_date)}</p>
                {ingetrokken && p.intrek_reden && <p className="text-xs text-muted-foreground">Reden: {p.intrek_reden}</p>}
              </div>
              {p.pdf_url && (
                <Button size="sm" variant="outline" onClick={() => onDownload(p.pdf_url!)}>
                  <Download className="h-3 w-3 mr-1" />PDF
                </Button>
              )}
            </div>
            {!ingetrokken && isSupervisorOrAdmin && (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => openAanpassen(p)}><Pencil className="h-3 w-3 mr-1" />Aanpassen</Button>
                <Button size="sm" variant="outline" onClick={() => mail(p)} disabled={bezig === `mail-${p.id}`}>
                  {bezig === `mail-${p.id}` ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Mail className="h-3 w-3 mr-1" />}Certificaat mailen naar klant
                </Button>
                <Button size="sm" variant="outline" onClick={() => setIntrekken(p)}><Ban className="h-3 w-3 mr-1" />Intrekken</Button>
              </div>
            )}
          </div>
        );
      })}

      {geldig.length === 0 ? (
        <Button variant="accent" className="w-full" onClick={() => nieuw(false)} disabled={!!bezig || !leadActief}>
          {bezig === "nieuw" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
          Certificaat genereren
        </Button>
      ) : isSupervisorOrAdmin && (
        <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={() => setExtraNummer(true)} disabled={!!bezig || !leadActief}>
          Extra certificaat met nieuw nummer (bijv. tweede polis)
        </Button>
      )}

      {versies && versies.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground">Versiegeschiedenis ({versies.length})</summary>
          <ul className="mt-2 space-y-1">
            {versies.map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-2">
                <span className="min-w-0">
                  {formatDateTimeLongNL(v.created_at)} · {v.certificate_number} v{v.versie} · {v.actie} · {v.uitgevoerd_door_email ?? "onbekend"}
                  {v.reden ? ` · ${v.reden}` : ""}
                </span>
                {v.oude_pdf_pad && v.actie === "aangepast" && (
                  <Button size="sm" variant="link" className="h-auto p-0" onClick={() => onDownload(v.oude_pdf_pad!)}>oude PDF</Button>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}

      <Dialog open={!!aanpassen} onOpenChange={(o) => !o && setAanpassen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Certificaat {aanpassen?.certificate_number} aanpassen</DialogTitle>
            <DialogDescription>Het nummer blijft gelijk; de afgiftedatum wordt vandaag. De oude versie blijft bewaard. Er wordt niets gemaild.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label htmlFor="c-h">Hoedanigheid</Label><Input id="c-h" value={form.profession} onChange={(e) => setForm({ ...form, profession: e.target.value })} /></div>
            <div><Label htmlFor="c-ch">Certificaathouder</Label><Input id="c-ch" value={form.certificate_holder} onChange={(e) => setForm({ ...form, certificate_holder: e.target.value })} /></div>
            <div><Label htmlFor="c-vn">Verzekeringsnemer</Label><Input id="c-vn" value={form.insured_name} onChange={(e) => setForm({ ...form, insured_name: e.target.value })} /></div>
            <div><Label htmlFor="c-id">Ingangsdatum</Label><Input id="c-id" type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAanpassen(null)}>Annuleren</Button>
            <Button onClick={opslaan} disabled={bezig === "aanpassen"}>{bezig === "aanpassen" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Opslaan en opnieuw maken</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!intrekken} onOpenChange={(o) => { if (!o) { setIntrekken(null); setReden(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Certificaat {intrekken?.certificate_number} intrekken</DialogTitle>
            <DialogDescription>Het certificaat blijft bewaard, maar telt niet meer mee en is niet meer zichtbaar voor de klant. Het nummer wordt nooit opnieuw uitgegeven.</DialogDescription>
          </DialogHeader>
          <Label htmlFor="c-r">Reden (verplicht)</Label>
          <Textarea id="c-r" value={reden} onChange={(e) => setReden(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIntrekken(null)}>Annuleren</Button>
            <Button variant="destructive" onClick={trekIn} disabled={reden.trim().length < 3 || bezig === "intrekken"}>Intrekken</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={extraNummer} onOpenChange={setExtraNummer}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" />Nieuw certificaatnummer uitgeven?</DialogTitle>
            <DialogDescription>
              Er is al een geldig certificaat ({geldig.map((g) => g.certificate_number).join(", ")}). Wil je alleen iets corrigeren, gebruik dan "Aanpassen". Geef alleen een nieuw nummer uit bij bijvoorbeeld een tweede polis.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExtraNummer(false)}>Annuleren</Button>
            <Button variant="destructive" onClick={() => nieuw(true)} disabled={bezig === "nieuw"}>Ja, nieuw nummer uitgeven</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { BavBezetMelding } from "@/components/admin/crm/BavBezetMelding";
import { controleerAdminMfa, verwerkMfaFout } from "@/lib/adminMfaStap";
import { haalBavRijen } from "@/lib/bavNummer";
import {
  afwijkingNieuwNummer, bepaalKeuze, BRON_TEKST, magBevestigen, magNummerOpslaan, normaliseerNummer, startVoorstel, type Voorstel,
} from "@/lib/certificaatNummerKeuze";

async function roep(body: Record<string, unknown>) {
  if (!(await controleerAdminMfa())) throw new Error("Bevestig eerst je tweestapsverificatie.");
  const { data, error } = await supabase.functions.invoke("generate-certificate", { body });
  if (error) {
    await verwerkMfaFout(error);
    let msg = error.message;
    try { const j = await (error as any).context?.json?.(); if (j?.error) msg = j.error; } catch { /* */ }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}
const rpc = (n: string, a: Record<string, unknown>) => (supabase.rpc as any)(n, a);

type Klaar = { nummer: string; pdf: string | null; melding?: string | null; handmatig?: boolean };

function KlaarBlok({ k }: { k: Klaar }) {
  return (
    <div className="space-y-2 text-sm" role="status">
      <p>{k.handmatig ? `Certificaat klaar (${k.nummer}).` : `Nieuw certificaat klaar (${k.nummer}); stuur het de klant zelf als dat nodig is.`}</p>
      {k.melding && <p className="text-destructive">{k.melding}</p>}
      {k.pdf && <a href={k.pdf} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">Certificaat downloaden (PDF)</a>}
    </div>
  );
}

/** Lead-route: eerst voorstel tonen (bewerkbaar), pas na bevestigen het certificaat maken. */
export function NieuwCertificaatDialoog({ leadId, open, onOpenChange, onKlaar, handmatigeAcceptatie = false }: { leadId: string; open: boolean; onOpenChange: (o: boolean) => void; onKlaar: () => void; handmatigeAcceptatie?: boolean }) {
  const [geenSepa, setGeenSepa] = useState(false);
  const [ctx, setCtx] = useState<{ voorstel: Voorstel | null; klantopgave: string | null; voorbeeld: string | null } | null>(null);
  const [nummer, setNummer] = useState("");
  const [toelichting, setToelichting] = useState("");
  const [bezet, setBezet] = useState<{ ond: string; nummer: string } | null>(null);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [klaar, setKlaar] = useState<Klaar | null>(null);

  useEffect(() => {
    if (!open) return;
    setCtx(null); setKlaar(null); setFout(null); setBezet(null); setToelichting(""); setGeenSepa(false);
    (async () => {
      const { data: v } = await rpc("certificaatnummer_voorstel", { _onderneming_id: null, _lead_id: leadId });
      const voorstel = (v ?? null) as Voorstel | null;
      let klantopgave: string | null = null;
      let voorbeeld: string | null = null;
      if (!voorstel?.nummer) {
        const rijen = await haalBavRijen(voorstel?.onderneming_id ? [voorstel.onderneming_id] : [], [leadId]).catch(() => []);
        klantopgave = rijen.find((r) => r.bron === "klant")?.nummer ?? null;
        const { data: vb } = await rpc("volgend_vrij_certificaatnummer_voorbeeld", {});
        voorbeeld = (vb as string) ?? null;
      }
      const c = { voorstel, klantopgave, voorbeeld };
      setCtx(c);
      setNummer(startVoorstel(c).nummer);
    })().catch((e) => setFout(e.message));
  }, [open, leadId]);

  const keuze = ctx ? bepaalKeuze(nummer, ctx) : null;
  const ond = ctx?.voorstel?.onderneming_id ?? null;
  const bron = ctx ? (keuze?.soort === "bekend" ? ctx.voorstel?.bron : keuze?.soort === "klantopgave" ? "klantopgave" : keuze?.soort === "nieuw" ? "nieuw" : null) : null;

  const maak = async (naOverride = false) => {
    if (!ctx || !keuze) return;
    setBezig(true); setFout(null);
    try {
      let body: Record<string, unknown> = { lead_id: leadId, certificaatnummer: keuze.nummer };
      if (keuze.soort === "nieuw") body = { lead_id: leadId, bevestig_nieuw_nummer: true };
      if (keuze.soort === "eigen" || keuze.soort === "klantopgave") {
        if (!ond) throw new Error("Koppel de lead eerst aan een klant om een eigen nummer te gebruiken.");
        if (!naOverride) {
          const { data: b } = await rpc("bav_nummer_bezet_check", { _nummer: keuze.nummer, _onderneming_id: ond });
          if (b) { setBezet({ ond, nummer: keuze.nummer }); return; }
          const fn = keuze.soort === "klantopgave" ? "bav_nummer_bevestigen" : "bav_nummer_handmatig_bevestigen";
          const { error } = await rpc(fn, { _onderneming_id: ond, _nummer: keuze.nummer, _toelichting: toelichting.trim() || "Bevestigd bij certificaat maken" });
          if (error) throw new Error(error.message);
        }
      }
      const r = await roep({ ...body, ...(handmatigeAcceptatie ? { handmatige_goedgekeurd: true, geen_sepa_nodig: geenSepa } : {}) });
      setBezet(null);
      setKlaar({ nummer: r.policy.certificate_number, pdf: r.policy.pdf_url, handmatig: handmatigeAcceptatie, melding: r.handmatige_documenten?.error ?? (handmatigeAcceptatie ? (r.handmatige_documenten?.test ? "Testaanvraag: niets verstuurd." : "Aanvraag geaccepteerd; klantdocumenten verstuurd.") : keuze.soort === "nieuw" ? afwijkingNieuwNummer(ctx.voorbeeld, r.policy.certificate_number) : null) });
      onKlaar();
    } catch (e: any) { setFout(e.message); } finally { setBezig(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{handmatigeAcceptatie ? "Aanvraag accepteren" : "Certificaat genereren"}</DialogTitle>
          <DialogDescription>{handmatigeAcceptatie ? "Controleer het BAV-nummer. Na akkoord worden het certificaat, de SEPA-machtiging en de uitnodiging voor Mijn ZP verstuurd." : "Controleer het BAV-nummer. Je kunt het voorstel aanpassen. Er wordt niets gemaild."}</DialogDescription>
        </DialogHeader>
        {klaar ? <KlaarBlok k={klaar} /> : !ctx ? <Loader2 className="h-5 w-5 animate-spin" /> : (
          <div className="space-y-3">
            {handmatigeAcceptatie && <div className="flex items-start gap-2"><Checkbox id="geen-sepa" checked={geenSepa} onCheckedChange={v => setGeenSepa(v === true)} /><Label htmlFor="geen-sepa">Geen SEPA-machtiging nodig (bijvoorbeeld incasso via NN)</Label></div>}
            <div>
              <Label htmlFor="cn-nr">BAV-nummer</Label>
              <Input id="cn-nr" value={nummer} onChange={(e) => { setNummer(e.target.value); setBezet(null); }} />
              <p className="mt-1 text-xs text-muted-foreground">
                {keuze?.soort === "ongeldig" ? "Ongeldig nummer (alleen letters, cijfers, punt, streepje of schuine streep)."
                  : bron ? `Bron: ${BRON_TEKST[bron] ?? bron}` : "Zelf getypt nummer: wordt eerst vastgelegd met jouw toelichting."}
              </p>
              {ctx.voorstel?.staat_al_op_policy && keuze?.soort === "bekend" && <p className="text-xs text-destructive">Dit nummer staat al op een certificaat van deze klant. Gebruik "Aanpassen".</p>}
            </div>
            {keuze?.soort === "eigen" && (
              <div><Label htmlFor="cn-t">Toelichting (verplicht: waar komt het nummer vandaan?)</Label>
                <Textarea id="cn-t" value={toelichting} onChange={(e) => setToelichting(e.target.value)} /></div>
            )}
            {bezet && <BavBezetMelding ondernemingId={bezet.ond} nummer={bezet.nummer} onKlaar={() => maak(true)} />}
            {fout && <p className="text-sm text-destructive" role="alert">{fout}</p>}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{klaar ? "Sluiten" : "Annuleren"}</Button>
          {!klaar && <Button disabled={!keuze || !magBevestigen(keuze, toelichting) || bezig || !!bezet} onClick={() => maak()}>
            {bezig && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Nummer bevestigen en certificaat maken</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** BAV-nummer op een bestaand certificaat aanpassen (supervisor, admin, verzekering). */
export function NummerWijzigenDialoog({ policy, onOpenChange, onKlaar }: { policy: { id: string; certificate_number: string; onderneming_id: string | null } | null; onOpenChange: (o: boolean) => void; onKlaar: () => void }) {
  const [nummer, setNummer] = useState("");
  const [reden, setReden] = useState("");
  const [bezet, setBezet] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [klaar, setKlaar] = useState<Klaar | null>(null);
  useEffect(() => { if (policy) { setNummer(policy.certificate_number); setReden(""); setBezet(null); setFout(null); setKlaar(null); } }, [policy?.id]);

  const opslaan = async (naOverride = false) => {
    if (!policy) return;
    const n = normaliseerNummer(nummer);
    setBezig(true); setFout(null);
    try {
      if (!naOverride && policy.onderneming_id) {
        const { data: b } = await rpc("bav_nummer_bezet_check", { _nummer: n, _onderneming_id: policy.onderneming_id });
        if (b) { setBezet(policy.onderneming_id); return; }
      }
      const r = await roep({ actie: "nummer_wijzigen", policy_id: policy.id, nieuw_nummer: n, reden: reden.trim() });
      setBezet(null);
      setKlaar({ nummer: r.policy.certificate_number, pdf: r.policy.pdf_url });
      onKlaar();
    } catch (e: any) { setFout(e.message); } finally { setBezig(false); }
  };

  return (
    <Dialog open={!!policy} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>BAV-nummer aanpassen ({policy?.certificate_number})</DialogTitle>
          <DialogDescription>Er komt een nieuwe versie en een nieuwe PDF. Het oude nummer blijft in de historie. Er wordt niets gemaild.</DialogDescription>
        </DialogHeader>
        {klaar ? <KlaarBlok k={klaar} /> : (
          <div className="space-y-3">
            <div><Label htmlFor="nw-nr">Nieuw BAV-nummer</Label><Input id="nw-nr" value={nummer} onChange={(e) => { setNummer(e.target.value); setBezet(null); }} /></div>
            <div><Label htmlFor="nw-r">Reden (verplicht, minimaal 10 tekens)</Label><Textarea id="nw-r" value={reden} onChange={(e) => setReden(e.target.value)} /></div>
            {bezet && <BavBezetMelding ondernemingId={bezet} nummer={normaliseerNummer(nummer)} onKlaar={() => opslaan(true)} />}
            {fout && <p className="text-sm text-destructive" role="alert">{fout}</p>}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{klaar ? "Sluiten" : "Annuleren"}</Button>
          {!klaar && <Button disabled={!policy || !magNummerOpslaan(nummer, policy.certificate_number, reden) || bezig || !!bezet} onClick={() => opslaan()}>
            {bezig && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Nummer opslaan en nieuw certificaat maken</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

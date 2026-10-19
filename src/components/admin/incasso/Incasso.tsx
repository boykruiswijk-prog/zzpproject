// D9 mislukte incasso (besluit Boy 15-10-2026): melden, beltaak, betaald, royement bevestigen en opschortingsbadge.
// Alles via RPC's; niets naar Exact, geen klantmail vanuit deze knoppen.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { formatDateNL } from "@/lib/dateFormat";
import { STAP_DAG, STAP_LABEL, volgendeStap, type IncassoStap } from "@/lib/incassoCyclus";
import { plusDagenISO } from "@/lib/prolongatie";
import { controleerAdminMfa, verwerkMfaFout } from "@/lib/adminMfaStap";

const vandaag = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Amsterdam" }).format(new Date());
export const euroNL = (n: number | null | undefined) => (n == null ? "-" : `€ ${Number(n).toFixed(2).replace(".", ",")}`);
const dagenTussen = (van: string, tot: string) => Math.round((new Date(`${tot}T00:00:00Z`).getTime() - new Date(`${van}T00:00:00Z`).getTime()) / 86400000);

export interface IncassoRij {
  id: string; onderneming_id: string; factuurnummer: string; bedrag: number | null; mislukt_op: string; status: string;
  dekking_opgeschort_sinds: string | null; betaald_op: string | null; reden: string | null; bron: string; is_test: boolean;
}

export function cyclusInfo(r: Pick<IncassoRij, "mislukt_op" | "status">) {
  const dag = dagenTussen(r.mislukt_op, vandaag());
  const v = r.status === "open" ? volgendeStap(dag) : null;
  return { dag, volgende: v ? { label: STAP_LABEL[v.stap], datum: plusDagenISO(r.mislukt_op, v.dag) } : null };
}

/** Rode badge voor schadebehandeling; alleen in de admin, nooit publiek of in Mijn ZP. */
export function DekkingOpgeschortBadge({ ondernemingId }: { ondernemingId?: string | null }) {
  const { data } = useQuery({
    queryKey: ["dekking-opgeschort", ondernemingId],
    enabled: !!ondernemingId,
    queryFn: async () => { const { data } = await supabase.rpc("dekking_opgeschort" as any, { _onderneming_id: ondernemingId }); return (data as string | null) ?? null; },
  });
  if (!data) return null;
  return <Badge variant="destructive">Dekking opgeschort sinds {formatDateNL(data)} (incasso)</Badge>;
}

export function IncassoMisluktKnop({ ondernemingId, factuurnummer, bedrag, klantContractId, factuurPlanningId, leadId, bron = "handmatig", label = "Incasso mislukt", onGemeld }: {
  ondernemingId: string; factuurnummer?: string | null; bedrag?: number | null; klantContractId?: string | null; factuurPlanningId?: string | null;
  leadId?: string | null; bron?: "handmatig" | "exact_detectie"; label?: string; onGemeld?: () => void;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ nr: factuurnummer ?? "", bedrag: bedrag != null ? String(bedrag) : "", datum: vandaag(), reden: "" });
  const [bezig, setBezig] = useState(false);
  async function opslaan() {
    setBezig(true);
    const { error } = await supabase.rpc("meld_incasso_mislukt" as any, {
      _onderneming_id: ondernemingId, _factuurnummer: f.nr.trim(), _bedrag: f.bedrag ? Number(f.bedrag.replace(",", ".")) : null,
      _mislukt_op: f.datum, _reden: f.reden || null, _bron: bron, _klant_contract_id: klantContractId ?? null,
      _factuur_planning_id: factuurPlanningId ?? null, _lead_id: leadId ?? null,
    });
    setBezig(false);
    if (error) return toast({ title: "Melden mislukt", description: error.message, variant: "destructive" });
    toast({ title: "Incasso mislukt vastgelegd", description: "Er staat een beltaak klaar in Vandaag te doen. Er is niets gemaild." });
    setOpen(false); onGemeld?.();
  }
  return (<>
    <Button size="sm" variant="outline" onClick={() => setOpen(true)}>{label}</Button>
    {open && <Dialog open onOpenChange={(o) => !o && setOpen(false)}>
      <DialogContent>
        <DialogHeader><DialogTitle>Incasso mislukt</DialogTitle>
          <DialogDescription>Maakt een beltaak "Klant bellen: incasso mislukt". Er gaat niets naar Exact en er wordt niets gemaild.</DialogDescription></DialogHeader>
        <div className="space-y-3 text-sm">
          <div><Label htmlFor="im-nr">Factuurnummer</Label><Input id="im-nr" value={f.nr} onChange={(e) => setF({ ...f, nr: e.target.value })} /></div>
          <div><Label htmlFor="im-b">Bedrag</Label><Input id="im-b" inputMode="decimal" value={f.bedrag} onChange={(e) => setF({ ...f, bedrag: e.target.value })} /></div>
          <div><Label htmlFor="im-d">Datum mislukt</Label><Input id="im-d" type="date" value={f.datum} onChange={(e) => setF({ ...f, datum: e.target.value })} /></div>
          <div><Label htmlFor="im-r">Reden</Label><Textarea id="im-r" rows={2} value={f.reden} onChange={(e) => setF({ ...f, reden: e.target.value })} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Annuleren</Button>
          <Button onClick={opslaan} disabled={bezig || !f.nr.trim() || !f.datum}>Vastleggen</Button></DialogFooter>
      </DialogContent>
    </Dialog>}
  </>);
}

export function BetaaldKnop({ id, onKlaar }: { id: string; onKlaar?: () => void }) {
  const { toast } = useToast();
  const [bezig, setBezig] = useState(false);
  async function klik() {
    const datum = window.prompt("Datum van betaling (jjjj-mm-dd)", vandaag());
    if (!datum) return;
    setBezig(true);
    const { error } = await supabase.rpc("incasso_betaald" as any, { _id: id, _datum: datum });
    setBezig(false);
    if (error) return toast({ title: "Niet gelukt", description: error.message, variant: "destructive" });
    toast({ title: "Betaald vastgelegd", description: "De herinneringen stoppen en een opschorting vervalt." });
    onKlaar?.();
  }
  return <Button size="sm" variant="outline" onClick={klik} disabled={bezig}>Betaald</Button>;
}

/** Royement bevestigen: eerst alleen status en logregel (RPC), daarna de royementsmail via de schakelaar (een per incasso). */
export async function royementBevestigenEnMailen(id: string): Promise<{ error: string | null; mail: string | null }> {
  if (!(await controleerAdminMfa())) return { error: "Bevestig eerst je tweestapsverificatie. Er is nog niets gewijzigd.", mail: null };
  const { error } = await supabase.rpc("bevestig_royement" as any, { _id: id });
  if (error) return { error: error.message, mail: null };
  const { data, error: fout } = await supabase.functions.invoke("royement-bevestiging-mail", { body: { incasso_id: id } });
  if (await verwerkMfaFout(fout, data)) return { error: "Royement is bevestigd. Bevestig je tweestapsverificatie; de mail is nog niet verstuurd.", mail: null };
  return { error: null, mail: fout ? "mail_mislukt" : (data as any)?.mail ?? null };
}

export function RoyementKnop({ id, onKlaar }: { id: string; onKlaar?: () => void }) {
  const { toast } = useToast();
  async function klik() {
    if (!window.confirm("Royement bevestigen? Dit zet de status, maakt een logregel en stuurt de klant de royementsbevestiging. Contract en Exact blijven ongewijzigd.")) return;
    const { error, mail } = await royementBevestigenEnMailen(id);
    if (error) return toast({ title: "Niet gelukt", description: error, variant: "destructive" });
    toast({ title: "Royement bevestigd", description: mail === "verzonden" ? "Royementsbevestiging is naar de klant gemaild." : `Royementsmail: ${mail ?? "onbekend"}` }); onKlaar?.();
  }
  return <Button size="sm" variant="destructive" onClick={klik}>Royement bevestigen</Button>;
}

/** Blok op de klantpagina: open incasso's met knoppen en melden. */
export function IncassoKlantBlok({ ondernemingId }: { ondernemingId: string }) {
  const { data, refetch } = useQuery({
    queryKey: ["incasso-klant", ondernemingId],
    queryFn: async () => {
      const { data } = await supabase.from("incasso_mislukt" as any).select("*").eq("onderneming_id", ondernemingId).order("mislukt_op", { ascending: false });
      return (data ?? []) as unknown as IncassoRij[];
    },
  });
  const open = (data ?? []).filter((r) => ["open", "royement_voorgesteld"].includes(r.status));
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <DekkingOpgeschortBadge ondernemingId={ondernemingId} />
        <IncassoMisluktKnop ondernemingId={ondernemingId} onGemeld={() => refetch()} />
      </div>
      {open.map((r) => { const c = cyclusInfo(r); return (
        <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-sm">
          <span className="font-medium">Incasso mislukt: factuur {r.factuurnummer}</span>
          <span>{euroNL(r.bedrag)} · {formatDateNL(r.mislukt_op)} · dag {c.dag}</span>
          {c.volgende && <span className="text-muted-foreground">volgende: {c.volgende.label} op {formatDateNL(c.volgende.datum)}</span>}
          <span className="ml-auto flex gap-2"><BetaaldKnop id={r.id} onKlaar={() => refetch()} />{r.status === "royement_voorgesteld" && <RoyementKnop id={r.id} onKlaar={() => refetch()} />}</span>
        </div>); })}
    </div>
  );
}

export { STAP_DAG, STAP_LABEL };
export type { IncassoStap };

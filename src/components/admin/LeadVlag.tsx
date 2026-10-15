import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Flag, BellRing } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { VLAG_LABEL, datumNL, isOpvolgen, vandaagNL, verwijderVlagVoor, vlagFout, zetVlagVoor, type VlagDoel, type VlagSoort } from "@/lib/leadVlag";

export type VlagLead = { id: string; naam?: string | null; vlag?: string | null; vlag_notitie?: string | null; vlag_datum?: string | null; vlag_door?: string | null; vlag_op?: string | null; voornaam?: string | null; achternaam?: string | null };

function useNaam(id?: string | null) {
  return useQuery({
    queryKey: ["profiel-naam", id], enabled: !!id, staleTime: 600_000,
    queryFn: async () => (await supabase.from("profiles").select("full_name").eq("id", id!).maybeSingle()).data?.full_name ?? null,
  }).data;
}

export function vlagTekst(l: VlagLead, door?: string | null) {
  const delen = [VLAG_LABEL[l.vlag as VlagSoort] ?? "", l.vlag_notitie ?? ""];
  if (l.vlag_datum) delen.push(`Opvolgen op ${datumNL(l.vlag_datum)}`);
  if (l.vlag_op) delen.push(`Door ${door ?? "teamlid"} op ${new Date(l.vlag_op).toLocaleString("nl-NL", { timeZone: "Europe/Amsterdam" })}`);
  return delen.filter(Boolean).join(" · ");
}

/** Icoon van de vlag; bij bereikte datum opvallend met "Vandaag opvolgen". */
export function VlagIcoon({ lead, metTekst = false }: { lead: VlagLead; metTekst?: boolean }) {
  const door = useNaam(lead.vlag_door);
  if (!lead.vlag) return null;
  const opvolgen = isOpvolgen(lead, vandaagNL());
  const Icoon = opvolgen ? BellRing : lead.vlag === "later" ? Clock : Flag;
  const kleur = lead.vlag === "later" ? "text-warning" : "text-destructive";
  const tekst = vlagTekst(lead, door);
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} aria-label={tekst} className={cn("inline-flex items-center gap-1 text-xs font-semibold", kleur, opvolgen && "animate-pulse")}>
            <Icoon className="h-4 w-4" aria-hidden="true" />
            {(opvolgen || metTekst) && <span>{opvolgen ? "Vandaag opvolgen" : VLAG_LABEL[lead.vlag as VlagSoort]}</span>}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs whitespace-normal">{tekst}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/** Dialoog: vlag zetten, aanpassen of verwijderen (met toelichting). */
export function VlagDialoog({ lead, open, onOpenChange, startVerwijderen = false, doel = "lead", onGewijzigd }: { lead: VlagLead; open: boolean; onOpenChange: (o: boolean) => void; startVerwijderen?: boolean; doel?: VlagDoel; onGewijzigd?: () => void }) {
  const qc = useQueryClient();
  const [soort, setSoort] = useState<VlagSoort | null>((lead.vlag as VlagSoort) ?? null);
  const [notitie, setNotitie] = useState(lead.vlag_notitie ?? "");
  const [datum, setDatum] = useState(lead.vlag_datum ?? "");
  const [verwijderen, setVerwijderen] = useState(startVerwijderen);
  const [toelichting, setToelichting] = useState("");
  const [bezig, setBezig] = useState(false);
  const fout = verwijderen ? (toelichting.trim().length < 3 || toelichting.trim().length > 500 ? "Toelichting is verplicht (3 tot 500 tekens)." : null) : vlagFout(soort, notitie, datum);

  const klaar = () => {
    if (doel === "klant") { qc.invalidateQueries({ queryKey: ["klanten"] }); qc.invalidateQueries({ queryKey: ["klant", lead.id] }); qc.invalidateQueries({ queryKey: ["mijn-acties-vandaag"] }); }
    else { qc.invalidateQueries({ queryKey: ["leads"] }); qc.invalidateQueries({ queryKey: ["lead", lead.id] });
    qc.invalidateQueries({ queryKey: ["menu-tellers"] }); qc.invalidateQueries({ queryKey: ["mijn-acties-vandaag"] }); }
    onGewijzigd?.();
    onOpenChange(false);
  };
  const opslaan = async () => {
    if (fout) return;
    setBezig(true);
    try {
      if (verwijderen) { await verwijderVlagVoor(doel, lead.id, toelichting); toast.success("Vlag verwijderd"); }
      else { await zetVlagVoor(doel, lead.id, soort!, notitie, datum || null); toast.success("Vlag opgeslagen"); }
      klaar();
    } catch (e) { toast.error((e as Error).message); } finally { setBezig(false); }
  };

  const keuze = (s: VlagSoort, Icoon: typeof Clock, kleur: string, uitleg: string) => (
    <button type="button" onClick={() => setSoort(s)} aria-pressed={soort === s}
      className={cn("flex flex-1 items-start gap-2 rounded-md border p-3 text-left text-sm", soort === s ? "border-primary bg-secondary" : "border-border hover:bg-muted/50")}>
      <Icoon className={cn("mt-0.5 h-5 w-5 shrink-0", kleur)} aria-hidden="true" />
      <span><span className="block font-medium">{VLAG_LABEL[s]}</span><span className="text-xs text-muted-foreground">{uitleg}</span></span>
    </button>
  );

  const naam = doel === "klant" ? ((lead as VlagLead & { naam?: string | null }).naam ?? "").trim() : `${lead.voornaam ?? ""} ${lead.achternaam ?? ""}`.trim();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{verwijderen ? "Vlag verwijderen" : lead.vlag ? "Vlag aanpassen" : "Markeren"}{naam ? `: ${naam}` : ""}</DialogTitle>
          <DialogDescription>{doel === "klant" ? "Er verandert niets aan contract, facturatie of polis. Gemarkeerde klanten staan onder Gemarkeerd en komen op de opvolgdatum vanzelf terug in Te doen." : <>De status van de aanvraag verandert niet. Gemarkeerde personen staan onder "Gemarkeerd" en komen op de opvolgdatum vanzelf terug in "Te doen".</>}</DialogDescription>
        </DialogHeader>
        {verwijderen ? (
          <div className="space-y-2">
            <Label htmlFor="vlag-toelichting">Waarom haal je de vlag weg?</Label>
            <Textarea id="vlag-toelichting" value={toelichting} onChange={(e) => setToelichting(e.target.value)} maxLength={500} />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row">
              {keuze("later", Clock, "text-warning", "Opvolgdatum verplicht")}
              {keuze("actie", Flag, "text-destructive", "Datum optioneel")}
            </div>
            <div className="space-y-2">
              <Label htmlFor="vlag-datum">Opvolgdatum{soort === "actie" ? " (optioneel)" : ""}</Label>
              <Input id="vlag-datum" type="date" value={datum} onChange={(e) => setDatum(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vlag-notitie">Notitie</Label>
              <Textarea id="vlag-notitie" value={notitie} onChange={(e) => setNotitie(e.target.value)} maxLength={500} placeholder="Wat moet er gebeuren?" />
            </div>
          </div>
        )}
        {fout && <p className="text-xs text-muted-foreground">{fout}</p>}
        <DialogFooter className="gap-2 sm:justify-between">
          {lead.vlag && !verwijderen ? <Button variant="outline" onClick={() => setVerwijderen(true)}>Vlag verwijderen</Button> : <span />}
          <Button onClick={opslaan} disabled={!!fout || bezig} variant={verwijderen ? "destructive" : "default"}>{verwijderen ? "Vlag verwijderen" : "Opslaan"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Vlagknop voor in de lijst. */
export function VlagKnop({ lead, doel = "lead", onGewijzigd }: { lead: VlagLead; doel?: VlagDoel; onGewijzigd?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label={lead.vlag ? "Vlag aanpassen of verwijderen" : "Markeren met een vlag"}
        className={cn(lead.vlag === "later" && "text-warning", lead.vlag === "actie" && "text-destructive")}>
        <Flag className="h-4 w-4" fill={lead.vlag ? "currentColor" : "none"} />
      </Button>
      {open && <VlagDialoog lead={lead} open onOpenChange={setOpen} doel={doel} onGewijzigd={onGewijzigd} />}
    </>
  );
}

/** Balk bovenaan LeadDetail. */
export function VlagBalk({ lead, magWijzigen, doel = "lead", onGewijzigd }: { lead: VlagLead; magWijzigen: boolean; doel?: VlagDoel; onGewijzigd?: () => void }) {
  const door = useNaam(lead.vlag_door);
  const [open, setOpen] = useState<null | "aanpassen" | "verwijderen">(null);
  return (
    <div className={cn("flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm",
      lead.vlag === "later" ? "border-warning bg-warning/10" : lead.vlag === "actie" ? "border-destructive bg-destructive/10" : "border-border")}>
      {lead.vlag ? (
        <>
          <VlagIcoon lead={lead} metTekst />
          <span className="min-w-0 flex-1 break-words">{vlagTekst(lead, door).split(" · ").slice(1).join(" · ")}</span>
        </>
      ) : <span className="min-w-0 flex-1 text-muted-foreground">Geen vlag. Markeer {doel === "klant" ? "deze klant" : "deze persoon"} als hij later aandacht nodig heeft of als er een actie nodig is.</span>}
      {magWijzigen && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setOpen("aanpassen")}><Flag className="h-4 w-4" />{lead.vlag ? "Vlag aanpassen" : "Markeren"}</Button>
          {lead.vlag && <Button size="sm" variant="outline" onClick={() => setOpen("verwijderen")}>Vlag verwijderen</Button>}
        </div>
      )}
      {open && <VlagDialoog key={open} lead={lead} open onOpenChange={(o) => !o && setOpen(null)} startVerwijderen={open === "verwijderen"} doel={doel} onGewijzigd={onGewijzigd} />}
    </div>
  );
}

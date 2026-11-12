import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { controleerAdminMfa, verwerkMfaFout } from "@/lib/adminMfaStap";
import { certificaatMailLabel, factuurLabel, ingangsdatumBlokkade, MIN_REDEN, samenvatting } from "@/lib/ingangsdatumWijzigen";

type Info = { blokkade: string | null; begin_datum: string; gefactureerd_tm: string | null; verstuurde_factuur: boolean;
  polissen: { id: string; certificate_number: string | null; start_date: string; gemaild_op: string | null }[] };

const vandaag = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Amsterdam" });

async function certificaatRoute(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("generate-certificate", { body });
  if (await verwerkMfaFout(error, data)) throw new Error("Bevestig eerst je tweestapsverificatie.");
  if (error) {
    let msg = error.message;
    try { const j = await (error as any).context?.json?.(); if (j?.error) msg = j.error; } catch { /* */ }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export function useIngangsdatumInfo(contractId: string, herlaad: number) {
  const [info, setInfo] = useState<Info | null>(null);
  useEffect(() => {
    supabase.rpc("contract_ingangsdatum_info" as any, { p_contract_id: contractId } as any).then(({ data }) => setInfo((data as Info) ?? null));
  }, [contractId, herlaad]);
  return info;
}

/** Labels bij een contractregel: factuurstand en certificaatmail. */
export function ContractStandLabels({ contract, info }: { contract: { begin_datum: string | null; gefactureerd_tm: string | null }; info: Info | null }) {
  const pol = info?.polissen ?? [];
  return (
    <>
      <span className="text-xs text-muted-foreground">{factuurLabel(contract, info?.verstuurde_factuur ?? false)}</span>
      {pol.map((p) => <span key={p.id} className="text-xs text-muted-foreground">{certificaatMailLabel(p.gemaild_op)}</span>)}
    </>
  );
}

export function IngangsdatumKnop({ contract, info, onKlaar }: { contract: any; info: Info | null; onKlaar: () => void }) {
  const [open, setOpen] = useState(false);
  const blokkade = info ? info.blokkade : "Gegevens laden...";
  const knop = <Button size="sm" variant="outline" disabled={!!blokkade} onClick={() => setOpen(true)}>Ingangsdatum wijzigen</Button>;
  return (
    <>
      {blokkade ? (
        <TooltipProvider><Tooltip><TooltipTrigger asChild><span tabIndex={0}>{knop}</span></TooltipTrigger><TooltipContent className="max-w-xs">{blokkade}</TooltipContent></Tooltip></TooltipProvider>
      ) : knop}
      {open && info && <IngangsdatumDialoog contract={contract} info={info} onSluit={() => setOpen(false)} onKlaar={onKlaar} />}
    </>
  );
}

function IngangsdatumDialoog({ contract, info, onSluit, onKlaar }: { contract: any; info: Info; onSluit: () => void; onKlaar: () => void }) {
  const oud = String(contract.begin_datum).slice(0, 10);
  const [datum, setDatum] = useState(oud);
  const [reden, setReden] = useState("");
  const [stap, setStap] = useState<"invoer" | "bevestig" | "klaar">("invoer");
  const [bezig, setBezig] = useState(false);
  const [polisIds, setPolisIds] = useState<string[]>([]);
  const [certFout, setCertFout] = useState<string | null>(null);
  const [gemaild, setGemaild] = useState<string[]>([]);
  const fout = ingangsdatumBlokkade({ begin_datum: oud, eind_datum: contract.eind_datum, gefactureerd_tm: contract.gefactureerd_tm }, vandaag(), datum, reden);

  async function uitvoeren() {
    if (!(await controleerAdminMfa())) { toast.info("Bevestig eerst je tweestapsverificatie. Er is nog niets gewijzigd."); return; }
    setBezig(true);
    const { data, error } = await supabase.rpc("contract_wijzig_ingangsdatum" as any, { p_contract_id: contract.id, p_nieuwe_datum: datum, p_reden: reden.trim() } as any);
    if (error) { setBezig(false); toast.error(error.message); return; }
    const ids = ((data as any)?.policy_ids ?? []) as string[];
    setPolisIds(ids);
    // Nieuwe certificaatversie: zelfde nummer, nieuwe ingangsdatum. Niet mailen.
    const fouten: string[] = [];
    for (const id of ids) {
      try { await certificaatRoute({ actie: "aanpassen", policy_id: id, wijzigingen: { start_date: datum }, reden: `Ingangsdatum gewijzigd: ${reden.trim()}` }); }
      catch (e) { fouten.push(e instanceof Error ? e.message : String(e)); }
    }
    setCertFout(fouten.length ? fouten.join("; ") : null);
    setBezig(false); setStap("klaar");
    toast.success(ids.length ? "Ingangsdatum gewijzigd en nieuw certificaat gemaakt. Er is niets gemaild." : "Ingangsdatum gewijzigd. Er hoort geen certificaat bij dit contract.");
    onKlaar();
  }

  async function mailen(id: string) {
    setBezig(true);
    try { await certificaatRoute({ actie: "mailen", policy_id: id }); setGemaild((g) => [...g, id]); toast.success("Nieuw certificaat naar klant gemaild"); }
    catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
    setBezig(false);
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onSluit()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Ingangsdatum wijzigen</DialogTitle>
          <DialogDescription>Alleen mogelijk zolang er voor dit contract nog niets is gefactureerd. Exact wordt niet aangepast.</DialogDescription>
        </DialogHeader>
        {stap === "invoer" && (
          <div className="space-y-3">
            <div><Label htmlFor="ingang-nieuw">Nieuwe ingangsdatum</Label><Input id="ingang-nieuw" type="date" value={datum} onChange={(e) => setDatum(e.target.value)} /></div>
            <div><Label htmlFor="ingang-reden">Reden (verplicht, minimaal {MIN_REDEN} tekens)</Label><Textarea id="ingang-reden" maxLength={500} value={reden} onChange={(e) => setReden(e.target.value)} /></div>
            {fout && reden.length > 0 && <p className="text-sm text-destructive">{fout}</p>}
          </div>
        )}
        {stap === "bevestig" && (
          <div className="space-y-2 text-sm">
            <p>{samenvatting(oud, datum)}</p>
            <p>{info.polissen.length ? `Daarna wordt een nieuwe versie van certificaat ${info.polissen.map((p) => p.certificate_number).join(", ")} gemaakt met hetzelfde nummer. Het certificaat wordt niet automatisch gemaild.` : "Bij dit contract hoort geen certificaat met deze ingangsdatum."}</p>
            <p className="text-muted-foreground">Reden: {reden.trim()}</p>
          </div>
        )}
        {stap === "klaar" && (
          <div className="space-y-2 text-sm">
            <p>De ingangsdatum is gewijzigd.</p>
            {certFout && <p className="text-destructive">Nieuw certificaat maken lukte niet: {certFout}. Maak het via Certificaat aanpassen.</p>}
            {polisIds.map((id) => (
              <Button key={id} size="sm" disabled={bezig || gemaild.includes(id) || !!certFout} onClick={() => mailen(id)}>
                {gemaild.includes(id) ? "Gemaild" : "Nieuw certificaat naar klant mailen"}
              </Button>))}
          </div>
        )}
        <DialogFooter>
          {stap === "invoer" && <Button disabled={!!fout} onClick={() => setStap("bevestig")}>Verder</Button>}
          {stap === "bevestig" && <><Button variant="outline" onClick={() => setStap("invoer")}>Terug</Button><Button disabled={bezig} onClick={uitvoeren}>{bezig && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Bevestigen</Button></>}
          {stap === "klaar" && <Button variant="outline" onClick={onSluit}>Sluiten</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

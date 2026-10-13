import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatDateNL } from "@/lib/dateFormat";
import { STARTER_VOORWAARDE_TEKST } from "@/lib/starterTarief";
import { kvkStarterOordeel } from "../../../supabase/functions/_shared/kvk";

type LeadStarter = {
  id: string; kvk_startdatum?: string | null; tarief_type?: string | null; starter_tot?: string | null;
  starter_controle_status?: string | null; starter_beoordeeld_op?: string | null; starter_toelichting?: string | null;
  geactiveerd_op?: string | null; kvk_nummer?: string | null; bedrijfsnaam?: string | null;
  extra_data?: Record<string, any> | null; kvk_gegevens?: Record<string, any> | null; ingangsdatum?: string | null;
};

const LABEL: Record<string, string> = { te_controleren: "Startertarief controleren", goedgekeurd: "Startertarief goedgekeurd", afgewezen: "Startertarief afgewezen" };

/** Startertarief op de leaddetailpagina. Beoordelen door verzekering/supervisor/admin, voor activatie. */
export function StartertariefControle({ lead, magBeoordelen }: { lead: LeadStarter; magBeoordelen: boolean }) {
  const qc = useQueryClient();
  const [toelichting, setToelichting] = useState("");
  const [bezig, setBezig] = useState(false);
  const [inschrijf, setInschrijf] = useState(lead.kvk_datum_bron === "uittreksel" ? lead.kvk_startdatum ?? "" : "");
  if (!lead.starter_controle_status) return null;
  const uittreksel = lead.extra_data?.kvk_uittreksel as { pad: string; geupload_op?: string } | undefined;
  const uittrekselOordeel = inschrijf ? kvkStarterOordeel({ datum_inschrijving: inschrijf, datum_aanvang: null }, lead.ingangsdatum) : null;

  async function bekijkUittreksel() {
    if (!uittreksel?.pad) return;
    const venster = window.open("", "_blank");
    const { data, error } = await supabase.storage.from("kvk-uittreksels").createSignedUrl(uittreksel.pad, 300);
    if (error || !data?.signedUrl) { venster?.close(); toast.error("Uittreksel openen lukte niet"); return; }
    if (venster) venster.location.href = data.signedUrl; else window.open(data.signedUrl, "_blank", "noopener");
  }

  async function slaInschrijfOp() {
    if (!inschrijf) return;
    setBezig(true);
    const { error } = await (supabase.rpc as any)("kvk_uittreksel_datum", { _lead_id: lead.id, _datum: inschrijf });
    setBezig(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Inschrijfdatum volgens uittreksel opgeslagen");
    qc.invalidateQueries();
  }
  const kg = (lead.kvk_gegevens ?? lead.extra_data?.kvk_gegevens ?? lead.extra_data?.kvk ?? {}) as Record<string, any>;
  const oordeel = kvkStarterOordeel(kg?.status === "ok" ? kg.profiel : null, lead.ingangsdatum);
  const rechtsvorm: string | null = kg?.rechtsvorm ?? kg?.profiel?.rechtsvorm ?? null;
  const open = lead.starter_controle_status === "te_controleren" && !lead.geactiveerd_op;

  async function beoordeel(goedkeuren: boolean) {
    setBezig(true);
    const { error } = await supabase.rpc("beoordeel_startertarief", { _lead_id: lead.id, _goedkeuren: goedkeuren, _toelichting: toelichting.trim() || null });
    setBezig(false);
    if (error) { toast.error(error.message); return; }
    toast.success(goedkeuren ? "Startertarief goedgekeurd" : "Startertarief afgewezen, gewone prijs");
    setToelichting("");
    qc.invalidateQueries();
  }

  return (
    <Card className="min-w-0">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex flex-wrap items-center gap-2">
          Startertarief <Badge variant={open ? "destructive" : "secondary"}>{LABEL[lead.starter_controle_status] ?? lead.starter_controle_status}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>KVK-nummer: <strong>{lead.kvk_nummer || "onbekend"}</strong>{lead.bedrijfsnaam ? <> ({lead.bedrijfsnaam})</> : null}</p>
        <p>Rechtsvorm: <strong>{rechtsvorm || "onbekend"}</strong>{!rechtsvorm && /\b(b\.?v\.?|bv)\b/i.test(lead.bedrijfsnaam ?? "") ? <span className="text-muted-foreground"> (BV: een omzetting van eenmanszaak naar een nieuwe BV telt als starter; leidend is de inschrijvingsdatum van de huidige KVK-inschrijving)</span> : null}</p>
        <p className="text-xs text-muted-foreground">Regel: KVK-inschrijvingsdatum van de huidige inschrijving jonger dan 12 maanden op de ingangsdatum = startertarief, ook na omzetting van eenmanszaak naar BV.</p>
        {oordeel ? (
          <div className="rounded-md border border-border p-2">
            <p className="font-medium">KVK-oordeel (voorstel): <span className={oordeel.voldoet ? "text-emerald-700" : "text-destructive"}>{oordeel.tekst}</span></p>
            {oordeel.aandacht && <p className="text-xs text-amber-700">Aandachtspunt: {oordeel.aandacht}.</p>}
            <p className="text-xs text-muted-foreground">Het tarief verandert niet vanzelf; jij beslist met de knoppen hieronder.</p>
          </div>
        ) : <p className="text-xs text-muted-foreground">Nog geen KVK-oordeel. Gebruik "KVK-gegevens ophalen" bij KVK-controle.</p>}
        {uittreksel ? (
          <div className="space-y-2 rounded-md border border-border p-2">
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={bekijkUittreksel}>KVK-uittreksel bekijken</Button>
              {uittreksel.geupload_op && <span className="text-xs text-muted-foreground">Ontvangen {formatDateNL(uittreksel.geupload_op)}</span>}
            </div>
            {open && magBeoordelen && (
              <div className="flex flex-wrap items-end gap-2">
                <div><Label htmlFor="inschrijf-uittreksel">Inschrijfdatum volgens uittreksel</Label>
                  <Input id="inschrijf-uittreksel" type="date" value={inschrijf} onChange={(e) => setInschrijf(e.target.value)} /></div>
                <Button size="sm" variant="secondary" disabled={bezig || !inschrijf || (lead.kvk_datum_bron === "uittreksel" && inschrijf === lead.kvk_startdatum)} onClick={slaInschrijfOp}>Datum opslaan</Button>
              </div>
            )}
            {uittrekselOordeel && <p className={uittrekselOordeel.voldoet ? "text-foreground" : "text-destructive"}>{uittrekselOordeel.voldoet ? `Binnen 12 maanden voor de ingangsdatum (ingeschreven ${formatDateNL(inschrijf)})` : uittrekselOordeel.tekst}</p>}
          </div>
        ) : !oordeel && <p className="font-medium text-destructive">Geen bewijs; vraag de klant om een uittreksel.</p>}
        <p>Opgegeven startdatum KVK-inschrijving: <strong>{lead.kvk_startdatum ? formatDateNL(lead.kvk_startdatum) : "onbekend"}</strong></p>
        {lead.tarief_type === "starter" && lead.starter_tot && <p>Startertarief t/m <strong>{formatDateNL(lead.starter_tot)}</strong>, daarna automatisch de gewone prijs.</p>}
        <p className="text-muted-foreground">{STARTER_VOORWAARDE_TEKST}</p>
        {lead.starter_toelichting && <p className="text-muted-foreground">Toelichting: {lead.starter_toelichting}</p>}
        {open && (magBeoordelen ? (
          <div className="space-y-2">
            <p>Controleer de startdatum op het KVK-uittreksel (vroegste van registratiedatum en datum aanvang). Activeren kan pas na deze controle.</p>
            <Label htmlFor="starter-toelichting">Toelichting (optioneel)</Label>
            <Textarea id="starter-toelichting" rows={2} maxLength={500} value={toelichting} onChange={(e) => setToelichting(e.target.value)} />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={bezig} onClick={() => beoordeel(true)}>{bezig && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Startertarief goedkeuren</Button>
              <Button size="sm" variant="outline" disabled={bezig} onClick={() => beoordeel(false)}>Afwijzen, normaal tarief (€ 55 per maand / € 600 per jaar)</Button>
            </div>
          </div>
        ) : <p className="text-muted-foreground">Een teamlid met rol verzekering, supervisor of admin controleert dit voor activatie.</p>)}
      </CardContent>
    </Card>
  );
}

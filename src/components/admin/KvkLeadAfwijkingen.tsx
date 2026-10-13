import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { formatDateTimeLongNL } from "@/lib/dateFormat";

const LABEL: Record<string, string> = { bedrijfsnaam: "Bedrijfsnaam", straat: "Straat", huisnummer: "Huisnummer", postcode: "Postcode", plaats: "Plaats", kvk_startdatum: "Startdatum KVK" };
const REDEN: Record<string, string> = {
  uitgeschakeld: "De KVK-koppeling staat uit.", geen_sleutel: "De KVK-koppeling is nog niet ingesteld.", limiet: "De dag- of maandlimiet voor KVK-bevragingen is bereikt.",
  niet_gevonden: "Dit KVK-nummer staat niet in het handelsregister.", ongeldig: "Deze aanvraag heeft geen geldig KVK-nummer.",
};

/** KVK-controle bij een aanvraag: KVK is leidend, afwijkende klantopgave zichtbaar. Ophalen alleen hier (A12). */
export function KvkLeadAfwijkingen({ lead, magOphalen = false }: { lead: { id?: string; kvk_nummer?: string | null; kvk_gegevens?: any; kvk_datum_bron?: string | null }; magOphalen?: boolean }) {
  const qc = useQueryClient();
  const [bezig, setBezig] = useState(false);
  const [bevestig, setBevestig] = useState(false);
  const g = lead.kvk_gegevens;
  if (!g && !(magOphalen && lead.id && lead.kvk_nummer)) return null;
  const afw: { veld: string; klant: string; kvk: string }[] = g?.afwijkingen ?? [];

  async function ophalen(opnieuw: boolean) {
    setBezig(true);
    const { data, error } = await supabase.functions.invoke("kvk-basisprofiel", { body: { modus: "lead", lead_id: lead.id, opnieuw } });
    setBezig(false); setBevestig(false);
    if (error || !data?.ok) { toast.error(REDEN[data?.reden] ?? data?.melding ?? "KVK-gegevens ophalen lukt nu niet."); return; }
    toast.success(data.uit_cache ? "KVK-gegevens uit de bewaarde kopie (geen kosten)" : "KVK-gegevens opgehaald");
    qc.invalidateQueries();
  }

  return (
    <Card>
      <CardHeader><CardTitle className="flex flex-wrap items-center gap-2 text-base">KVK-controle
        {g && <Badge variant={g.status === "ok" ? "secondary" : "destructive"}>{g.status === "ok" ? "KVK leidend" : "KVK-controle niet beschikbaar"}</Badge>}</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-sm">
        {g && g.status !== "ok" && <p>De gegevens van de klant zijn gebruikt. Startdatum handmatig controleren.</p>}
        {g?.adres_bron === "klant_kvk_afgeschermd" && <p>Adres is afgeschermd in het handelsregister; het opgegeven adres is gebruikt.</p>}
        {lead.kvk_datum_bron && <p className="text-muted-foreground">Bron startdatum: {lead.kvk_datum_bron === "kvk_api" ? "KVK API" : "opgegeven door klant"}</p>}
        {g?.status === "ok" && g.opgehaald_op && <p className="text-muted-foreground">Opgehaald op {formatDateTimeLongNL(g.opgehaald_op)}</p>}
        {g?.status === "ok" && (afw.length === 0 ? <p className="text-muted-foreground">Opgave van de klant komt overeen met de KVK.</p> : (
          <ul className="space-y-1">{afw.map((a) => <li key={a.veld}><span className="text-muted-foreground">{LABEL[a.veld] ?? a.veld}:</span> klant {a.klant || "-"} <Badge variant="outline">wijkt af</Badge> KVK <span className="font-medium">{a.kvk}</span></li>)}</ul>
        ))}
        {magOphalen && lead.id && lead.kvk_nummer && (
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" variant="outline" disabled={bezig} onClick={() => ophalen(false)}>KVK-gegevens ophalen</Button>
            {g?.status === "ok" && <Button size="sm" variant="ghost" disabled={bezig} onClick={() => setBevestig(true)}>Opnieuw ophalen</Button>}
          </div>
        )}
      </CardContent>
      <AlertDialog open={bevestig} onOpenChange={setBevestig}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Opnieuw ophalen bij de KVK</AlertDialogTitle>
            <AlertDialogDescription>Dit is een nieuwe bevraging en kost EUR 0,02. De bewaarde kopie wordt dan niet gebruikt. Doorgaan?</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel disabled={bezig}>Annuleren</AlertDialogCancel>
            <AlertDialogAction disabled={bezig} onClick={(e) => { e.preventDefault(); ophalen(true); }}>Ophalen (EUR 0,02)</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

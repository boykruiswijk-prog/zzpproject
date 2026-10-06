import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatDateNL } from "@/lib/dateFormat";
import { STARTER_VOORWAARDE_TEKST } from "@/lib/starterTarief";

type LeadStarter = {
  id: string; kvk_startdatum?: string | null; tarief_type?: string | null; starter_tot?: string | null;
  starter_controle_status?: string | null; starter_beoordeeld_op?: string | null; starter_toelichting?: string | null;
  geactiveerd_op?: string | null;
};

const LABEL: Record<string, string> = { te_controleren: "Startertarief controleren", goedgekeurd: "Startertarief goedgekeurd", afgewezen: "Startertarief afgewezen" };

/** Startertarief op de leaddetailpagina. Beoordelen alleen door supervisor/admin, voor activatie. */
export function StartertariefControle({ lead, magBeoordelen }: { lead: LeadStarter; magBeoordelen: boolean }) {
  const qc = useQueryClient();
  const [toelichting, setToelichting] = useState("");
  const [bezig, setBezig] = useState(false);
  if (!lead.starter_controle_status) return null;
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
              <Button size="sm" disabled={bezig} onClick={() => beoordeel(true)}>{bezig && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Goedkeuren</Button>
              <Button size="sm" variant="outline" disabled={bezig} onClick={() => beoordeel(false)}>Afwijzen (gewone prijs)</Button>
            </div>
          </div>
        ) : <p className="text-muted-foreground">Een supervisor of admin controleert dit voor activatie.</p>)}
      </CardContent>
    </Card>
  );
}

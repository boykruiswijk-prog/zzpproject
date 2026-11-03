import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatDateTimeNL } from "@/lib/dateFormat";
import { handmatigAfrondenFout, type AanvraagStap } from "@/lib/omzetting";

/** Stappen van een aanvraag (RPC aanvraag_stappen). Afgerond pas na certificaat verstuurd of handmatig met reden (RPC aanvraag_handmatig_afronden). */
export function AanvraagStappen({ leadId, magAfronden }: { leadId: string; magAfronden: boolean }) {
  const { data, refetch } = useQuery({
    queryKey: ["aanvraag-stappen", leadId],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("aanvraag_stappen", { _lead_id: leadId });
      if (error) throw error;
      return data as { stappen: AanvraagStap[]; afgerond_op: string | null; afgerond_reden: string | null };
    },
  });
  const [open, setOpen] = useState(false);
  const [reden, setReden] = useState("");
  const [bezig, setBezig] = useState(false);
  if (!data?.stappen) return null;
  const fout = handmatigAfrondenFout(reden);
  const rondAf = async () => {
    setBezig(true);
    const { error } = await (supabase.rpc as any)("aanvraag_handmatig_afronden", { _lead_id: leadId, _reden: reden.trim() });
    setBezig(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Aanvraag afgerond"); setOpen(false); refetch();
  };
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Stappen van deze aanvraag</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-sm">
        <ul className="space-y-1">
          {data.stappen.map((s) => (
            <li key={s.sleutel} className="flex items-start gap-2">
              {s.klaar ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
              <span>{s.label} <span className="text-xs text-muted-foreground">({s.automatisch})</span></span>
            </li>
          ))}
        </ul>
        {data.afgerond_op ? (
          <p className="rounded-md bg-muted p-2">Afgerond op {formatDateTimeNL(data.afgerond_op)}: {data.afgerond_reden}.</p>
        ) : (
          <>
            <p className="text-muted-foreground">Deze aanvraag blijft in Te doen tot het certificaat verstuurd is.</p>
            {magAfronden && (open ? (
              <div className="space-y-2">
                <Textarea rows={2} value={reden} onChange={(e) => setReden(e.target.value)} placeholder="Waarom rond je af zonder het certificaat te versturen?" aria-label="Reden handmatig afronden" />
                <div className="flex gap-2">
                  <Button size="sm" disabled={!!fout || bezig} onClick={rondAf}>{bezig && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Toch afronden</Button>
                  <Button size="sm" variant="outline" onClick={() => setOpen(false)}>Annuleren</Button>
                </div>
              </div>
            ) : <Button size="sm" variant="outline" onClick={() => setOpen(true)}>Handmatig afronden met reden</Button>)}
          </>
        )}
      </CardContent>
    </Card>
  );
}

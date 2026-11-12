import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type BestaandeKlant = {
  onderneming_id: string;
  naam: string;
  contract_id: string;
  policy_id: string;
  polisnummer: string;
};

type Lead = {
  id: string;
  type: string;
  status: string;
  geactiveerd_op?: string | null;
  exact_invoice_id?: string | null;
  aanvraag_afgerond_reden?: string | null;
};

export function BestaandeKlantAanvraag({ lead }: { lead: Lead }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [bezig, setBezig] = useState(false);
  const gesloten = lead.status === "samengevoegd";
  const { data: bestaande } = useQuery<BestaandeKlant | null>({
    queryKey: ["bestaande-klant-aanvraag", lead.id],
    enabled: lead.type === "verzekering_aanvraag" && !gesloten,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("bestaande_klant_bij_aanvraag", { _lead_id: lead.id });
      if (error) throw error;
      return (data ?? null) as BestaandeKlant | null;
    },
  });

  if (gesloten) {
    return (
      <Card className="border-muted bg-muted/30">
        <CardContent className="flex items-start gap-3 p-4 text-sm">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
          <div>
            <p className="font-medium">Afgesloten als bestaande klant</p>
            <p className="mt-1 text-muted-foreground">{lead.aanvraag_afgerond_reden ?? "De dubbele aanvraag is samengevoegd met de bestaande klantkaart."}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!bestaande) return null;
  const magAfsluiten = !lead.geactiveerd_op && !lead.exact_invoice_id && !["actief", "gepauzeerd", "opgezegd"].includes(lead.status);

  async function afsluiten() {
    setBezig(true);
    try {
      const { data, error } = await supabase.rpc("aanvraag_bestaande_klant_afsluiten", { _lead_id: lead.id });
      if (error) throw error;
      toast({ title: "Afgesloten als bestaande klant", description: `De aanvraag is gekoppeld aan ${bestaande?.naam ?? "de bestaande klantkaart"}. Er is geen nieuwe polis of factuur aangemaakt.` });
      setOpen(false);
      await qc.invalidateQueries();
      return data;
    } catch (e: any) {
      toast({ title: "Afsluiten mislukt", description: e?.message ?? "De aanvraag is niet gewijzigd.", variant: "destructive" });
    } finally {
      setBezig(false);
    }
  }

  return (
    <Card className="border-destructive/40 bg-destructive/5">
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3" role="alert">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div className="text-sm">
            <p className="font-semibold">Bestaande klant: contract en polis lopen al ({bestaande.polisnummer}).</p>
            <p className="mt-1 text-muted-foreground">Activeer deze aanvraag niet. Dat zou een dubbel contract en een dubbele polis geven.</p>
            {!magAfsluiten && <p className="mt-1 text-destructive">Deze aanvraag heeft zelf al een activatie of factuur en kan niet automatisch worden afgesloten.</p>}
          </div>
        </div>
        <Button variant="outline" className="shrink-0" disabled={!magAfsluiten || bezig} onClick={() => setOpen(true)}>
          {bezig && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Afsluiten als bestaande klant
        </Button>
      </CardContent>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aanvraag afsluiten als bestaande klant?</AlertDialogTitle>
            <AlertDialogDescription>
              De aanvraag wordt samengevoegd met {bestaande.naam}. Het lopende contract en certificaat {bestaande.polisnummer} blijven ongewijzigd.
              Er wordt geen nieuwe polis, geen nieuw contract, geen factuur en geen klantmail aangemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={afsluiten} disabled={bezig}>
              {bezig && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Bevestig afsluiten
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

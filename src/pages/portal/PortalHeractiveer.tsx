import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, AlertTriangle, Phone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePolicyLifecycle, usePortalLead } from "@/hooks/usePolicyLifecycle";

export default function PortalHeractiveer() {
  const { leadId } = useParams<{ leadId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: lead, isLoading } = usePortalLead();
  const lifecycle = usePolicyLifecycle();

  const [functie, setFunctie] = useState("");
  const [stage, setStage] = useState<"input" | "afgewezen" | "klaar">("input");
  const [afwijzingsreden, setAfwijzingsreden] = useState("");

  if (isLoading) return <PortalLayout><Loader2 className="h-6 w-6 animate-spin" /></PortalLayout>;
  if (!lead || lead.id !== leadId) {
    return <PortalLayout><p>Polis niet gevonden.</p></PortalLayout>;
  }

  const handleCheck = async () => {
    if (!functie.trim()) return;
    try {
      const res = await lifecycle.mutateAsync({
        action: "heractiveren_check", lead_id: lead.id, nieuwe_functie: functie,
      });
      if (!res.acceptabel) {
        setAfwijzingsreden(res.reden_afwijzing ?? "Functie vereist persoonlijke beoordeling.");
        setStage("afgewezen");
        return;
      }
      // Geaccepteerd → direct confirmen
      await lifecycle.mutateAsync({
        action: "heractiveren_confirm", lead_id: lead.id, nieuwe_functie: functie,
      });
      setStage("klaar");
      toast({ title: "Polis weer actief", description: "Je ontvangt een bevestigingsmail." });
    } catch (e: any) {
      toast({ title: "Fout", description: e.message, variant: "destructive" });
    }
  };

  return (
    <PortalLayout>
      <div className="max-w-xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Polis heractiveren</h1>
        <p className="text-muted-foreground mb-6">
          Welkom terug. Vertel even wat je nu doet, dan zetten we je polis direct weer aan.
        </p>

        {stage === "input" && (
          <Card>
            <CardHeader><CardTitle>Wat is je huidige functie?</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fn">Functie</Label>
                <Input
                  id="fn" value={functie} onChange={(e) => setFunctie(e.target.value)}
                  placeholder={lead.functie_bij_aanvraag ?? "Bv. Interim project manager"}
                />
                {lead.functie_bij_aanvraag && (
                  <p className="text-xs text-muted-foreground">
                    Bij je oorspronkelijke aanvraag: <strong>{lead.functie_bij_aanvraag}</strong>
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => navigate("/portal/polis")}>Annuleren</Button>
                <Button onClick={handleCheck} disabled={!functie.trim() || lifecycle.isPending}>
                  {lifecycle.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Heractiveer polis
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {stage === "afgewezen" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-700">
                <AlertTriangle className="h-5 w-5" /> Persoonlijke beoordeling nodig
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>{afwijzingsreden}</p>
              <p>Neem even contact op met Ellen. Zij regelt het direct met je.</p>
              <a href="tel:0204573077" className="inline-block">
                <Button>
                  <Phone className="h-4 w-4 mr-2" /> Bel 020 - 457 30 77
                </Button>
              </a>
            </CardContent>
          </Card>
        )}

        {stage === "klaar" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-700">
                <CheckCircle2 className="h-5 w-5" /> Polis weer actief
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>Je bent vanaf vandaag weer volledig gedekt. We hebben je een bevestigingsmail gestuurd.</p>
              <Button onClick={() => navigate("/portal/polis")}>Terug naar mijn polis</Button>
            </CardContent>
          </Card>
        )}
      </div>
    </PortalLayout>
  );
}

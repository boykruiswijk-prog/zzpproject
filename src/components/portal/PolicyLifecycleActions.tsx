import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Pause, Play, X, RefreshCcw, AlertTriangle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { usePolicyLifecycle, usePortalLead, usePauzePreview } from "@/hooks/usePolicyLifecycle";
import { formatDateLongNL } from "@/lib/dateFormat";

const PAUZE_REDENEN = [
  { value: "geen_opdrachten", label: "Even geen opdrachten" },
  { value: "tijdelijk_in_dienst", label: "Tijdelijk in loondienst" },
  { value: "vakantie_sabbatical", label: "Vakantie / sabbatical" },
  { value: "andere_reden", label: "Andere reden" },
];

const OPZEG_REDENEN = [
  { value: "stoppen_zzp", label: "Ik stop met ondernemen" },
  { value: "andere_verzekeraar", label: "Overstap naar andere verzekeraar" },
  { value: "te_duur", label: "Te duur" },
  { value: "andere_reden", label: "Andere reden" },
];

export function PolicyLifecycleActions() {
  const { data: lead, isLoading } = usePortalLead();
  const { toast } = useToast();
  const navigate = useNavigate();
  const lifecycle = usePolicyLifecycle();

  const [pauzeOpen, setPauzeOpen] = useState(false);
  const [opzegOpen, setOpzegOpen] = useState(false);
  const [hervatOpen, setHervatOpen] = useState(false);
  const [pauzeReden, setPauzeReden] = useState("");
  const [pauzeToelichting, setPauzeToelichting] = useState("");
  const [pauzeAkkoord, setPauzeAkkoord] = useState(false);
  const [opzegReden, setOpzegReden] = useState("");
  const [opzegToelichting, setOpzegToelichting] = useState("");

  const pauzePreview = usePauzePreview(lead?.id, "pauze", pauzeOpen);
  const hervatPreview = usePauzePreview(lead?.id, "hervat", hervatOpen);

  const pauzeToelichtingRequired = pauzeReden === "andere_reden";
  const opzegToelichtingRequired = opzegReden === "andere_reden";
  const pauzeBlocked =
    !pauzeReden || (pauzeToelichtingRequired && !pauzeToelichting.trim()) || !pauzeAkkoord;
  const opzegBlocked =
    !opzegReden || (opzegToelichtingRequired && !opzegToelichting.trim());
  const sepaBannerNeeded = lead?.exact_invoice_status === 50;
  const eur = (n: number | undefined) =>
    typeof n === "number" ? `€ ${n.toFixed(2).replace(".", ",")}` : "—";

  if (isLoading || !lead) return null;
  const status = lead.status;

  const handlePauze = async () => {
    if (pauzeBlocked) return;
    try {
      await lifecycle.mutateAsync({
        action: "pauzeren", lead_id: lead.id,
        reden: pauzeReden, pauze_toelichting: pauzeToelichting.trim() || undefined,
      });
      toast({ title: "Polis gepauzeerd", description: "Je ontvangt een bevestigingsmail." });
      setPauzeOpen(false); setPauzeReden(""); setPauzeToelichting("");
    } catch (e: any) {
      toast({ title: "Fout", description: e.message, variant: "destructive" });
    }
  };

  const handleHervatten = async () => {
    try {
      const res = await lifecycle.mutateAsync({ action: "hervatten", lead_id: lead.id });
      toast({
        title: "Polis weer actief",
        description: res?.pauze_dagen > 0
          ? `Creditnota voor ${res.pauze_dagen} dagen wordt verwerkt.`
          : "Je bent direct weer gedekt.",
      });
    } catch (e: any) {
      toast({ title: "Fout", description: e.message, variant: "destructive" });
    }
  };

  const handleOpzeg = async () => {
    if (opzegBlocked) return;
    try {
      await lifecycle.mutateAsync({
        action: "opzeggen", lead_id: lead.id,
        reden: opzegReden, toelichting: opzegToelichting.trim() || undefined,
      });
      toast({ title: "Polis opgezegd", description: "Je ontvangt een bevestigingsmail." });
      setOpzegOpen(false); setOpzegReden(""); setOpzegToelichting("");
    } catch (e: any) {
      toast({ title: "Fout", description: e.message, variant: "destructive" });
    }
  };

  const statusBadge = () => {
    if (status === "gepauzeerd")
      return <Badge className="bg-gray-100 text-gray-800">Gepauzeerd sinds {lead.pauze_start_datum ? formatDateLongNL(lead.pauze_start_datum) : "-"}</Badge>;
    if (status === "opgezegd")
      return <Badge className="bg-gray-200 text-gray-700">Opgezegd op {lead.opzeg_datum ? formatDateLongNL(lead.opzeg_datum) : "-"}</Badge>;
    if (status === "actief" || status === "klant")
      return <Badge className="bg-green-100 text-green-800">Actief</Badge>;
    return <Badge variant="outline">{status}</Badge>;
  };

  return (
    <Card>
      <CardContent className="py-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Status</p>
            <div className="mt-1">{statusBadge()}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {(status === "actief" || status === "klant") && (
              <>
                <Button variant="outline" onClick={() => setPauzeOpen(true)}>
                  <Pause className="h-4 w-4 mr-2" /> Pauzeren
                </Button>
                <Button variant="outline" onClick={() => setOpzegOpen(true)}>
                  <X className="h-4 w-4 mr-2" /> Opzeggen
                </Button>
              </>
            )}
            {status === "gepauzeerd" && (
              <>
                <Button onClick={handleHervatten} disabled={lifecycle.isPending}>
                  {lifecycle.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                  Hervatten
                </Button>
                <Button variant="outline" onClick={() => setOpzegOpen(true)}>
                  <X className="h-4 w-4 mr-2" /> Opzeggen
                </Button>
              </>
            )}
            {status === "opgezegd" && (
              <Button onClick={() => navigate(`/portal/heractiveer/${lead.id}`)}>
                <RefreshCcw className="h-4 w-4 mr-2" /> Heractiveren
              </Button>
            )}
          </div>
        </div>
        {status === "gepauzeerd" && lead.pauze_reden && (
          <p className="text-sm text-muted-foreground">Pauzereden: {lead.pauze_reden.replace(/_/g, " ")}</p>
        )}
      </CardContent>

      {/* Pauze modal */}
      <Dialog open={pauzeOpen} onOpenChange={setPauzeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Polis pauzeren</DialogTitle>
            <DialogDescription>
              Tijdens de pauze ben je niet gedekt voor nieuwe schade. Schade van vóór de pauze blijft gedekt.
              Bij hervatten ontvang je een creditnota voor de pauze-dagen.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Reden</Label>
              <RadioGroup value={pauzeReden} onValueChange={setPauzeReden}>
                {PAUZE_REDENEN.map((r) => (
                  <div key={r.value} className="flex items-center gap-2">
                    <RadioGroupItem value={r.value} id={`p-${r.value}`} />
                    <Label htmlFor={`p-${r.value}`} className="font-normal cursor-pointer">{r.label}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-toel">
                Toelichting {pauzeToelichtingRequired ? "(verplicht)" : "(optioneel)"}
              </Label>
              <Textarea
                id="p-toel" rows={3}
                placeholder="Vertel kort wat de reden is..."
                value={pauzeToelichting}
                onChange={(e) => setPauzeToelichting(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPauzeOpen(false)}>Annuleren</Button>
            <Button onClick={handlePauze} disabled={pauzeBlocked || lifecycle.isPending}>
              {lifecycle.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Bevestig pauze
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Opzeg modal */}
      <Dialog open={opzegOpen} onOpenChange={setOpzegOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Polis opzeggen</DialogTitle>
            <DialogDescription>
              Je polis kan dagelijks worden opgezegd. Schade die vóór de opzegdatum ontstond blijft gedekt.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Reden</Label>
              <RadioGroup value={opzegReden} onValueChange={setOpzegReden}>
                {OPZEG_REDENEN.map((r) => (
                  <div key={r.value} className="flex items-center gap-2">
                    <RadioGroupItem value={r.value} id={`o-${r.value}`} />
                    <Label htmlFor={`o-${r.value}`} className="font-normal cursor-pointer">{r.label}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
            <div className="space-y-2">
              <Label htmlFor="o-toel">
                Toelichting {opzegToelichtingRequired ? "(verplicht)" : "(optioneel)"}
              </Label>
              <Textarea
                id="o-toel" rows={3}
                placeholder="Vertel kort wat de reden is..."
                value={opzegToelichting}
                onChange={(e) => setOpzegToelichting(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpzegOpen(false)}>Annuleren</Button>
            <Button variant="destructive" onClick={handleOpzeg} disabled={opzegBlocked || lifecycle.isPending}>
              {lifecycle.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Bevestig opzegging
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Loader2, Pause, Play, X, RefreshCcw, ChevronRight, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePolicyLifecycle, usePolicyAuditLog } from "@/hooks/usePolicyLifecycle";
import { formatDateTimeLongNL, formatDateLongNL } from "@/lib/dateFormat";

const ACTIE_LABELS: Record<string, string> = {
  pauzeren: "Pauze gestart",
  hervatten: "Polis hervat",
  opzeggen: "Opgezegd",
  heractiveren: "Heractiveerd",
  reminder_verzonden: "Reminder verzonden",
  creditnota_aangemaakt: "Creditnota aangemaakt",
};

interface Props {
  lead: any;
}

export function LeadLifecyclePanel({ lead }: Props) {
  const { toast } = useToast();
  const lifecycle = usePolicyLifecycle();
  const { data: auditLog } = usePolicyAuditLog(lead.id);

  const [pauzeOpen, setPauzeOpen] = useState(false);
  const [opzegOpen, setOpzegOpen] = useState(false);
  const [heractOpen, setHeractOpen] = useState(false);
  const [reden, setReden] = useState("");
  const [toelichting, setToelichting] = useState("");
  const [nieuweFunctie, setNieuweFunctie] = useState("");

  const status = lead.status;
  const callAction = async (payload: any, successMsg: string) => {
    try {
      await lifecycle.mutateAsync(payload);
      toast({ title: successMsg });
      setPauzeOpen(false); setOpzegOpen(false); setHeractOpen(false);
      setReden(""); setToelichting(""); setNieuweFunctie("");
    } catch (e: any) {
      toast({ title: "Fout", description: e.message, variant: "destructive" });
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Polis-lifecycle</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {(status === "actief" || status === "klant") && (
              <>
                <Button size="sm" variant="outline" onClick={() => setPauzeOpen(true)}>
                  <Pause className="h-3 w-3 mr-1" /> Pauzeren
                </Button>
                <Button size="sm" variant="outline" onClick={() => setOpzegOpen(true)}>
                  <X className="h-3 w-3 mr-1" /> Opzeggen
                </Button>
              </>
            )}
            {status === "gepauzeerd" && (
              <>
                <Button size="sm" onClick={() => callAction({ action: "hervatten", lead_id: lead.id }, "Polis hervat")}
                        disabled={lifecycle.isPending}>
                  {lifecycle.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Play className="h-3 w-3 mr-1" />}
                  Hervatten
                </Button>
                <Button size="sm" variant="outline" onClick={() => setOpzegOpen(true)}>
                  <X className="h-3 w-3 mr-1" /> Opzeggen
                </Button>
              </>
            )}
            {status === "opgezegd" && (
              <Button size="sm" onClick={() => setHeractOpen(true)}>
                <RefreshCcw className="h-3 w-3 mr-1" /> Heractiveren
              </Button>
            )}
          </div>

          {status === "gepauzeerd" && (
            <div className="text-xs text-muted-foreground">
              Sinds {lead.pauze_start_datum ? formatDateLongNL(lead.pauze_start_datum) : "-"} · reden: {lead.pauze_reden ?? "-"}
            </div>
          )}
          {status === "opgezegd" && (
            <div className="text-xs text-muted-foreground">
              Op {lead.opzeg_datum ? formatDateLongNL(lead.opzeg_datum) : "-"} · reden: {lead.opzeg_reden ?? "-"}
            </div>
          )}

          {/* Audit-log */}
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-start">
                <ChevronRight className="h-3 w-3 mr-1 transition-transform [&[data-state=open]]:rotate-90" />
                Lifecycle-historie ({auditLog?.length ?? 0})
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 mt-2">
              {(auditLog ?? []).map((row: any) => (
                <div key={row.id} className="text-xs border-l-2 border-muted pl-3 py-1">
                  <div className="flex items-center gap-2">
                    {row.succes
                      ? <CheckCircle2 className="h-3 w-3 text-green-600" />
                      : <AlertTriangle className="h-3 w-3 text-red-600" />}
                    <span className="font-medium">{ACTIE_LABELS[row.actie] ?? row.actie}</span>
                    <Badge variant="outline" className="text-[10px]">{row.rol}</Badge>
                  </div>
                  <div className="text-muted-foreground mt-0.5">{formatDateTimeLongNL(row.created_at)}</div>
                  {row.fout_melding && <div className="text-red-600 mt-0.5">{row.fout_melding}</div>}
                  {row.details && Object.keys(row.details).length > 0 && (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-muted-foreground">Details</summary>
                      <pre className="mt-1 text-[10px] bg-muted p-2 rounded overflow-x-auto">{JSON.stringify(row.details, null, 2)}</pre>
                    </details>
                  )}
                </div>
              ))}
              {(!auditLog || auditLog.length === 0) && (
                <p className="text-xs text-muted-foreground">Nog geen lifecycle-acties.</p>
              )}
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>

      {/* Pauze */}
      <Dialog open={pauzeOpen} onOpenChange={setPauzeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Polis pauzeren namens klant</DialogTitle>
            <DialogDescription>Status wordt 'gepauzeerd'. Klant ontvangt bevestigingsmail.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reden">Reden</Label>
            <Input id="reden" value={reden} onChange={(e) => setReden(e.target.value)}
                   placeholder="bv. geen_opdrachten, vakantie_sabbatical" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPauzeOpen(false)}>Annuleren</Button>
            <Button onClick={() => callAction({ action: "pauzeren", lead_id: lead.id, reden }, "Polis gepauzeerd")}
                    disabled={!reden || lifecycle.isPending}>
              {lifecycle.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Bevestig
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Opzeg */}
      <Dialog open={opzegOpen} onOpenChange={setOpzegOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Polis opzeggen namens klant</DialogTitle>
            <DialogDescription>Status wordt 'opgezegd'. Bij eerdere pauze wordt creditnota aangemaakt.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="oreden">Reden</Label>
              <Input id="oreden" value={reden} onChange={(e) => setReden(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="otoel">Toelichting</Label>
              <Textarea id="otoel" value={toelichting} onChange={(e) => setToelichting(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpzegOpen(false)}>Annuleren</Button>
            <Button variant="destructive"
                    onClick={() => callAction({ action: "opzeggen", lead_id: lead.id, reden, toelichting }, "Polis opgezegd")}
                    disabled={!reden || lifecycle.isPending}>
              {lifecycle.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Bevestig
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Heractiveer */}
      <Dialog open={heractOpen} onOpenChange={setHeractOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Heractiveren namens klant</DialogTitle>
            <DialogDescription>
              Oorspronkelijke functie: <strong>{lead.functie_bij_aanvraag ?? "onbekend"}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="hfunctie">Huidige functie</Label>
            <Input id="hfunctie" value={nieuweFunctie} onChange={(e) => setNieuweFunctie(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHeractOpen(false)}>Annuleren</Button>
            <Button onClick={() => callAction({
              action: "heractiveren_confirm", lead_id: lead.id, nieuwe_functie: nieuweFunctie,
            }, "Polis geheractiveerd")} disabled={!nieuweFunctie.trim() || lifecycle.isPending}>
              {lifecycle.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Bevestig
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

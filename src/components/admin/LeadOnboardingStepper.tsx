import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Loader2, AlertTriangle } from "lucide-react";
import { useUpdateLead } from "@/hooks/useLeads";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Database } from "@/integrations/supabase/types";

type LeadStatus = Database["public"]["Enums"]["lead_status"];

export type OnboardingPhase =
  | "nieuw"
  | "beoordelen"
  | "goedkeuren"
  | "activeren"
  | "actief"
  | "afgewezen";

const PHASES: { key: Exclude<OnboardingPhase, "afgewezen">; label: string }[] = [
  { key: "nieuw", label: "Nieuwe aanvraag" },
  { key: "beoordelen", label: "Beoordelen" },
  { key: "goedkeuren", label: "Goedkeuren" },
  { key: "activeren", label: "Polis activeren" },
  { key: "actief", label: "Actief" },
];

export function derivePhase(lead: any): OnboardingPhase {
  if (lead.status === "afgewezen") return "afgewezen";
  if (lead.exact_account_id || lead.status === "actief" || lead.status === "gepauzeerd" || lead.status === "opgezegd") return "actief";
  if (lead.status === "offerte_verstuurd" || lead.status === "klant") return "activeren";
  if (lead.status === "in_behandeling" || lead.status === "afspraak_gepland") return "beoordelen";
  return "nieuw";
}

interface Props {
  lead: any;
}

export function LeadOnboardingStepper({ lead }: Props) {
  const phase = useMemo(() => derivePhase(lead), [lead]);
  const updateLead = useUpdateLead();
  const { toast } = useToast();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReden, setRejectReden] = useState("");

  const phaseIndex = PHASES.findIndex(p => p.key === phase);

  const setStatus = (status: LeadStatus, extra: Record<string, any> = {}, successMsg?: string) => {
    updateLead.mutate(
      { id: lead.id, updates: { status, ...extra } },
      {
        onSuccess: () => successMsg && toast({ title: successMsg }),
        onError: (e: any) => toast({ title: "Fout", description: e.message, variant: "destructive" }),
      },
    );
  };

  const isPending = updateLead.isPending;

  return (
    <Card>
      <CardContent className="p-5">
        {phase === "afgewezen" ? (
          <div className="flex items-center gap-3 text-sm">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <div>
              <p className="font-medium">Aanvraag afgewezen</p>
              {lead.afwijzing_reden && (
                <p className="text-muted-foreground text-xs">Reden: {lead.afwijzing_reden}</p>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Stepper */}
            <ol className="flex items-center w-full mb-5">
              {PHASES.map((p, i) => {
                const done = i < phaseIndex;
                const current = i === phaseIndex;
                return (
                  <li key={p.key} className={`flex items-center ${i < PHASES.length - 1 ? "flex-1" : ""}`}>
                    <div className="flex flex-col items-center">
                      <div
                        className={[
                          "h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold border",
                          done ? "bg-green-600 text-white border-green-600"
                            : current ? "bg-accent text-accent-foreground border-accent"
                            : "bg-background text-muted-foreground border-muted",
                        ].join(" ")}
                      >
                        {done ? <Check className="h-4 w-4" /> : i + 1}
                      </div>
                      <span
                        className={`mt-1.5 text-[11px] text-center leading-tight max-w-[88px] ${
                          current ? "font-medium text-foreground" : "text-muted-foreground"
                        }`}
                      >
                        {p.label}
                      </span>
                    </div>
                    {i < PHASES.length - 1 && (
                      <div className={`flex-1 h-px mx-2 mb-5 ${i < phaseIndex ? "bg-green-600" : "bg-muted"}`} />
                    )}
                  </li>
                );
              })}
            </ol>

            {/* Per-fase actie */}
            <div className="flex flex-wrap items-center gap-2 border-t pt-4">
              {phase === "nieuw" && (
                <>
                  <p className="text-sm text-muted-foreground flex-1 min-w-[200px]">
                    Begin met het beoordelen van deze aanvraag.
                  </p>
                  <Button
                    onClick={() => setStatus("in_behandeling", {}, "Beoordeling gestart")}
                    disabled={isPending}
                  >
                    {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Start beoordeling
                  </Button>
                </>
              )}

              {phase === "beoordelen" && (
                <>
                  <p className="text-sm text-muted-foreground flex-1 min-w-[200px]">
                    Controleer en vul de gegevens aan. Klik op Goedkeuren als alles klopt.
                  </p>
                  <Button variant="outline" onClick={() => setRejectOpen(true)} disabled={isPending}>
                    Afwijzen
                  </Button>
                  <Button
                    onClick={() => setStatus("offerte_verstuurd", {}, "Aanvraag goedgekeurd")}
                    disabled={isPending}
                  >
                    {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Goedkeuren
                  </Button>
                </>
              )}

              {phase === "activeren" && (
                <p className="text-sm text-muted-foreground">
                  Aanvraag is goedgekeurd. Activeer de polis in het blok{" "}
                  <strong>Polis-activatie</strong> hiernaast zodra de checklist volledig groen is.
                </p>
              )}

              {phase === "actief" && (
                <p className="text-sm text-muted-foreground">
                  Polis is actief. Beheeropties (pauzeren, opzeggen) staan in het blok{" "}
                  <strong>Polis-lifecycle</strong>.
                </p>
              )}
            </div>
          </>
        )}
      </CardContent>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aanvraag afwijzen</DialogTitle>
            <DialogDescription>
              Geef kort aan waarom deze aanvraag wordt afgewezen. Deze reden is intern zichtbaar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="afwreden">Reden</Label>
            <Textarea
              id="afwreden"
              value={rejectReden}
              onChange={(e) => setRejectReden(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Annuleren</Button>
            <Button
              variant="destructive"
              disabled={!rejectReden.trim() || isPending}
              onClick={() => {
                setStatus("afgewezen", { afwijzing_reden: rejectReden.trim() }, "Aanvraag afgewezen");
                setRejectOpen(false);
                setRejectReden("");
              }}
            >
              Bevestig afwijzing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

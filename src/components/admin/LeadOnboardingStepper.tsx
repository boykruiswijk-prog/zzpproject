import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Loader2, AlertTriangle } from "lucide-react";
import { useUpdateLead } from "@/hooks/useLeads";
import { useToast } from "@/hooks/use-toast";
import { logActiviteit } from "@/lib/activiteitenLog";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { Database } from "@/integrations/supabase/types";

type RejectReasonKey = "portefeuille" | "onvolledig" | "verleden" | "anders";

const REJECT_REASONS: { key: RejectReasonKey; label: string; klantzin: string }[] = [
  {
    key: "portefeuille",
    label: "Past niet in de portefeuille",
    klantzin: "De reden hiervoor is dat je aanvraag niet aansluit bij onze huidige verzekeringsportefeuille.",
  },
  {
    key: "onvolledig",
    label: "Geen volledige aanvraag",
    klantzin: "De reden hiervoor is dat je aanvraag niet volledig was. Je bent van harte welkom om een nieuwe, volledige aanvraag in te dienen.",
  },
  {
    key: "verleden",
    label: "Er is in het verleden iets gebeurd, neem contact op",
    klantzin: "Op basis van eerdere informatie kunnen we je aanvraag helaas niet in behandeling nemen. Neem voor meer uitleg gerust contact met ons op via info@zpzaken.nl.",
  },
  {
    key: "anders",
    label: "Anders (eigen reden opgeven)",
    klantzin: "",
  },
];

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
  const [rejectKey, setRejectKey] = useState<RejectReasonKey | "">("");
  const [rejectAnders, setRejectAnders] = useState("");

  const phaseIndex = PHASES.findIndex(p => p.key === phase);

  const setStatus = (
    status: LeadStatus,
    extra: Record<string, any> = {},
    successMsg?: string,
    logEntry?: { actie_type: string; omschrijving: string },
  ) => {
    updateLead.mutate(
      { id: lead.id, updates: { status, ...extra } },
      {
        onSuccess: () => {
          if (successMsg) toast({ title: successMsg });
          if (logEntry) {
            void logActiviteit({
              actie_type: logEntry.actie_type,
              omschrijving: logEntry.omschrijving,
              lead_id: lead.id,
              klant_email: lead.email ?? null,
            });
          }
        },
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
              <p className="text-muted-foreground text-xs">
                De reden is vastgelegd in de activiteitentijdlijn hieronder.
              </p>
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
                    onClick={() => setStatus(
                      "in_behandeling",
                      {},
                      "Beoordeling gestart",
                      { actie_type: "lead_in_behandeling", omschrijving: `Aanvraag van ${lead.email ?? "lead"} in behandeling genomen` },
                    )}
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
                    onClick={() => setStatus(
                      "offerte_verstuurd",
                      {},
                      "Aanvraag goedgekeurd",
                      { actie_type: "lead_goedgekeurd", omschrijving: `Aanvraag van ${lead.email ?? "lead"} goedgekeurd` },
                    )}
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
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="afwreden">Reden</Label>
              <Select value={rejectKey} onValueChange={(v) => setRejectKey(v as RejectReasonKey)}>
                <SelectTrigger id="afwreden">
                  <SelectValue placeholder="Kies een reden" />
                </SelectTrigger>
                <SelectContent>
                  {REJECT_REASONS.map(r => (
                    <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {rejectKey === "anders" && (
              <div className="space-y-2">
                <Label htmlFor="afwreden-anders">Eigen reden</Label>
                <p className="text-xs text-muted-foreground">
                  Let op: deze tekst wordt letterlijk in de mail naar de klant getoond.
                  Formuleer een nette, klantgerichte zin.
                </p>
                <Textarea
                  id="afwreden-anders"
                  value={rejectAnders}
                  onChange={(e) => setRejectAnders(e.target.value)}
                  rows={3}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Annuleren</Button>
            <Button
              variant="destructive"
              disabled={
                !rejectKey ||
                (rejectKey === "anders" && !rejectAnders.trim()) ||
                isPending
              }
              onClick={async () => {
                const chosen = REJECT_REASONS.find(r => r.key === rejectKey);
                if (!chosen) return;
                const isAnders = chosen.key === "anders";
                const klantzin = isAnders ? rejectAnders.trim() : chosen.klantzin;
                const internLabel = isAnders
                  ? `Anders: ${rejectAnders.trim()}`
                  : chosen.label;

                const stamp = new Date().toLocaleString("nl-NL");
                const note = `[Afgewezen ${stamp}] ${internLabel}`;
                const merged = lead.opmerkingen ? `${note}\n\n${lead.opmerkingen}` : note;
                const alreadyRejected = lead.status === "afgewezen";
                const leadEmail = (lead.email ?? "").trim();

                try {
                  await updateLead.mutateAsync({
                    id: lead.id,
                    updates: { status: "afgewezen" as LeadStatus, opmerkingen: merged },
                  });
                } catch (e: any) {
                  toast({ title: "Fout", description: e.message, variant: "destructive" });
                  return;
                }

                toast({ title: "Aanvraag afgewezen" });
                await logActiviteit({
                  actie_type: "lead_afgewezen",
                  omschrijving: `Aanvraag van ${lead.email ?? "lead"} afgewezen. Reden: ${internLabel}`,
                  lead_id: lead.id,
                  klant_email: lead.email ?? null,
                });

                setRejectOpen(false);
                setRejectKey("");
                setRejectAnders("");

                if (alreadyRejected) return;

                const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(leadEmail);
                if (!emailValid) {
                  toast({
                    title: "Geen afwijsmail verstuurd",
                    description: "Deze lead heeft geen geldig e-mailadres. Neem handmatig contact op met de klant.",
                    variant: "destructive",
                  });
                  await logActiviteit({
                    actie_type: "afwijsmail_overgeslagen",
                    omschrijving: "Afwijsmail overgeslagen: geen geldig e-mailadres bij lead.",
                    lead_id: lead.id,
                    klant_email: null,
                  });
                  return;
                }

                const { data, error } = await supabase.functions.invoke("send-rejection-email", {
                  body: { leadId: lead.id, email: leadEmail, reasonSentence: klantzin },
                });
                const ok = !error && (data?.success === true);
                if (!ok) {
                  const msg = error?.message ?? data?.error ?? "onbekende fout";
                  toast({
                    title: "Afwijsmail kon niet worden verstuurd",
                    description: msg,
                    variant: "destructive",
                  });
                  await logActiviteit({
                    actie_type: "afwijsmail_mislukt",
                    omschrijving: `Afwijsmail aan ${leadEmail} mislukt: ${msg}`,
                    lead_id: lead.id,
                    klant_email: leadEmail,
                  });
                  return;
                }

                if (data?.skipped === "already_sent") {
                  await logActiviteit({
                    actie_type: "afwijsmail_overgeslagen",
                    omschrijving: `Afwijsmail overgeslagen: al eerder verstuurd aan ${leadEmail}.`,
                    lead_id: lead.id,
                    klant_email: leadEmail,
                  });
                  return;
                }

                await logActiviteit({
                  actie_type: "afwijsmail_verstuurd",
                  omschrijving: `Afwijsmail verstuurd aan ${leadEmail}.`,
                  lead_id: lead.id,
                  klant_email: leadEmail,
                });
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

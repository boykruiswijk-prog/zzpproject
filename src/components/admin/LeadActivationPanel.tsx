import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2, AlertTriangle, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatDateTimeNL } from "@/lib/dateFormat";
import { Loader2 as Spinner } from "lucide-react";


type Lead = Record<string, any>;

interface Props {
  lead: Lead;
  isAdmin: boolean;
}

const isValidEmail = (e: any) => typeof e === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const isValidKvk = (k: any) => typeof k === "string" && /^\d{8}$/.test(k.trim());
const isValidIban = (i: any) => {
  if (typeof i !== "string") return false;
  const c = i.replace(/\s/g, "").toUpperCase();
  return /^NL\d{2}[A-Z]{4}\d{10}$/.test(c);
};

export function LeadActivationPanel({ lead, isAdmin }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [isActivating, setIsActivating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const checks = useMemo(() => [
    { label: "Voor- en achternaam", ok: !!(lead.voornaam && lead.achternaam) },
    { label: "Email (geldig formaat)", ok: isValidEmail(lead.email) },
    { label: "Telefoonnummer", ok: !!lead.telefoon },
    { label: "Bedrijfsnaam", ok: !!lead.bedrijfsnaam },
    { label: "KvK-nummer (8 cijfers)", ok: isValidKvk(lead.kvk_nummer) },
    { label: "Adres (straat + huisnummer)", ok: !!(lead.adres_straat && lead.adres_huisnummer) },
    { label: "Postcode + plaats", ok: !!(lead.adres_postcode && lead.adres_plaats) },
    { label: "Branche", ok: !!lead.branche },
    { label: "Gekozen pakket", ok: !!lead.gekozen_pakket },
    { label: "IBAN (NL-formaat)", ok: isValidIban(lead.iban) },
    { label: "SEPA-akkoord", ok: lead.sepa_akkoord === true },
    { label: "Ingangsdatum", ok: !!lead.ingangsdatum },
  ], [lead]);

  const allGreen = checks.every(c => c.ok);
  const missing = checks.filter(c => !c.ok).map(c => c.label);
  const alreadyActivated = !!lead.exact_account_id;
  const isAfgewezen = lead.status === "afgewezen";
  const canShow = isAdmin && !alreadyActivated && !isAfgewezen;

  const activate = async () => {
    setIsActivating(true);
    setDialogOpen(false);
    try {
      const { data, error } = await supabase.functions.invoke("lead-to-exact-activate", {
        body: { lead_id: lead.id },
      });
      if (error) throw error;
      if (!data?.success) {
        const detail = data?.missing ? ` Ontbrekend: ${data.missing.join(", ")}` : "";
        throw new Error(`${data?.error || "Onbekende fout"}${detail}`);
      }
      toast({
        title: "Polis geactiveerd",
        description: `Klant is aangemaakt in Exact. Relatie-ID: ${data.exact_account_id}${data.mandate_warning ? " — let op: " + data.mandate_warning : ""}`,
      });
      qc.invalidateQueries({ queryKey: ["lead", lead.id] });
      qc.invalidateQueries({ queryKey: ["leads"] });
    } catch (e: any) {
      toast({
        title: "Activatie mislukt",
        description: e?.message || "Controleer de gegevens of neem contact op met support.",
        variant: "destructive",
      });
    } finally {
      setIsActivating(false);
    }
  };

  const auditLog: any[] = Array.isArray(lead.activatie_log) ? lead.activatie_log : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-accent" />
          Polis-activatie
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {alreadyActivated ? (
          <div className="rounded-lg border border-green-300 bg-green-50 p-4 flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-700 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-green-900">Polis is geactiveerd in Exact.</p>
              <p className="text-green-800 mt-1">Exact relatie-ID: <code className="bg-white px-1.5 py-0.5 rounded">{lead.exact_account_id}</code></p>
              {lead.geactiveerd_op && (
                <p className="text-green-700 text-xs mt-1">
                  Op {formatDateTimeNL(lead.geactiveerd_op)}
                </p>
              )}
            </div>
          </div>
        ) : (
          <>
            <div>
              <h4 className="text-sm font-medium mb-2">Activatie-checklist</h4>
              <ul className="space-y-1.5">
                {checks.map((c) => (
                  <li key={c.label} className="flex items-center gap-2 text-sm">
                    {c.ok ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
                    )}
                    <span className={c.ok ? "text-foreground" : "text-muted-foreground"}>{c.label}</span>
                  </li>
                ))}
              </ul>
            </div>

            {!canShow ? (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5" />
                <span>
                  {!isAdmin && "Alleen admins kunnen activeren."}
                  {isAdmin && isAfgewezen && "Afgewezen leads kunnen niet worden geactiveerd."}
                </span>
              </div>
            ) : (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-block w-full">
                      <Button
                        onClick={() => setDialogOpen(true)}
                        disabled={!allGreen || isActivating}
                        className="w-full bg-green-600 hover:bg-green-700 text-white disabled:bg-muted disabled:text-muted-foreground"
                      >
                        {isActivating ? (
                          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Bezig met activeren…</>
                        ) : (
                          <>Activeer polis</>
                        )}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {!allGreen && (
                    <TooltipContent className="max-w-xs">
                      <p className="font-medium">Ontbrekende velden:</p>
                      <ul className="text-xs list-disc pl-4">
                        {missing.map(m => <li key={m}>{m}</li>)}
                      </ul>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            )}
          </>
        )}

        {auditLog.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Activatie-historie</h4>
            <ul className="space-y-2">
              {auditLog.map((entry, i) => (
                <li key={i} className="text-xs border-l-2 border-accent pl-3 py-1">
                  <div className="font-medium">{entry.action || "Actie"}</div>
                  <div className="text-muted-foreground">
                    {entry.timestamp ? formatDateTimeNL(entry.timestamp) : ""}{" "}
                    {entry.admin_email ? `· ${entry.admin_email}` : ""}
                  </div>
                  {entry.exact_account_id && (
                    <div className="text-muted-foreground">
                      Exact-ID: <code>{entry.exact_account_id}</code>
                    </div>
                  )}
                  {entry.mandate_warning && (
                    <div className="text-amber-700">⚠ {entry.mandate_warning}</div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>

      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Polis activeren?</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je <strong>{lead.bedrijfsnaam}</strong> wilt activeren?
              Er wordt een relatie, contactpersoon, bankrekening en SEPA-mandaat
              aangemaakt in Exact (administratie ZP Zaken B.V., divisie 4401707).
              Deze actie is niet ongedaan te maken.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleer</AlertDialogCancel>
            <AlertDialogAction onClick={activate} className="bg-green-600 hover:bg-green-700">
              Bevestig activering
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

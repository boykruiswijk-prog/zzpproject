import { LEAD_STATUS_LABELS, LEAD_STATUS_COLORS } from "@/lib/statusLabels";
import { teamWaarschuwingHandmatig } from "../../../supabase/functions/_shared/sectorRegels";
import { useState } from "react";
import { KlantLinkVoorLead } from "@/components/admin/KlantLinkVoorLead";
import { SepaMachtigingBewijsBlok } from "@/components/admin/SepaMachtigingBewijsBlok";
import { CertificaatBeheer } from "@/components/admin/CertificaatBeheer";
import { LeadIngevuldeGegevens } from "@/components/admin/LeadIngevuldeGegevens";

import { useParams, useNavigate, Link } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { LeadNotes } from "@/components/admin/LeadNotes";
import { LeadActivationPanel } from "@/components/admin/LeadActivationPanel";
import { LeadLifecyclePanel } from "@/components/admin/LeadLifecyclePanel";
import { LeadOnboardingStepper, derivePhase } from "@/components/admin/LeadOnboardingStepper";
import { LeadDoorlooptijd } from "@/components/admin/LeadDoorlooptijd";
import { useLead, useUpdateLead, useDeleteLead } from "@/hooks/useLeads";
import { useAuth } from "@/contexts/AuthContext";
import { PortalInviteButton } from "@/components/admin/PortalInviteButton";
import { formatDateNL, formatDateLongNL, formatDateTimeLongNL } from "@/lib/dateFormat";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Mail,
  Phone,
  Building,
  Calendar,
  Trash2,
  Loader2,
  UserCheck,
  FileText,
  Download,
  Receipt,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import type { Database } from "@/integrations/supabase/types";
import { ADMIN_BRANCHES } from "@/data/sectorBranche";

type LeadStatus = Database["public"]["Enums"]["lead_status"];

const statusLabels = LEAD_STATUS_LABELS;
const statusColors = LEAD_STATUS_COLORS;

export default function AdminLeadDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin, isSupervisorOrAdmin, isTeamMember, magCertificaten } = useAuth();
  const { toast } = useToast();
  const { data: lead, isLoading } = useLead(id);
  const updateLead = useUpdateLead();
  const deleteLead = useDeleteLead();
  const [isGenerating, setIsGenerating] = useState(false);

  // Fetch existing policies for this lead
  const { data: policies, refetch: refetchPolicies } = useQuery({
    queryKey: ["policies", id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from("policies")
        .select("*")
        .eq("lead_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });


  const handleGenerateCertificate = async () => {
    if (!id) return;
    setIsGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-certificate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ lead_id: id }),
        }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Fout bij genereren");
      
      toast({ title: "Certificaat aangemaakt!", description: `Nummer: ${result.policy.certificate_number}` });
      refetchPolicies();

      // Auto-download
      if (result.policy.pdf_url) {
        try {
          const { data } = await supabase.storage
            .from("certificates")
            .createSignedUrl(result.policy.pdf_url, 3600);
          if (data?.signedUrl) {
            const pdfResponse = await fetch(data.signedUrl);
            const blob = await pdfResponse.blob();
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = blobUrl;
            a.download = `${result.policy.certificate_number}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);
          }
        } catch (e) {
          console.error("Auto-download error:", e);
        }
      }
    } catch (error: any) {
      console.error("Certificate generation error:", error);
      toast({ title: "Fout", description: error.message, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadCertificate = async (pdfPath: string) => {
    const { data } = await supabase.storage
      .from("certificates")
      .createSignedUrl(pdfPath, 3600);
    if (data?.signedUrl) {
      try {
        const pdfResponse = await fetch(data.signedUrl);
        const blob = await pdfResponse.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = pdfPath.split("/").pop() || "certificaat.pdf";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      } catch (e) {
        console.error("Download error:", e);
      }
    }
  };




  const handleStatusChange = (newStatus: LeadStatus) => {
    if (!id) return;
    const updates: { status: LeadStatus; converted_at?: string | null } = {
      status: newStatus,
    };
    
    if (newStatus === "klant") {
      updates.converted_at = new Date().toISOString();
    } else {
      updates.converted_at = null;
    }

    updateLead.mutate({ id, updates });
  };

  const handleDelete = async () => {
    if (!id) return;
    if (confirm("Weet je zeker dat je deze lead wilt verwijderen?")) {
      await deleteLead.mutateAsync(id);
      navigate("/admin/leads");
    }
  };

  const handleMarkAsCustomer = () => {
    handleStatusChange("klant");
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  if (!lead) {
    return (
      <AdminLayout>
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold mb-2">Lead niet gevonden</h2>
          <Button asChild>
            <Link to="/admin/leads">Terug naar leads</Link>
          </Button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="min-w-0 space-y-6">
        {(lead as any)?.extra_data?.handmatige_acceptatie && (
          <div role="alert" className="rounded-lg border-2 border-destructive bg-destructive/10 p-4 text-sm font-semibold text-destructive">
            {teamWaarschuwingHandmatig(String((lead as any).extra_data.handmatige_acceptatie.sector ?? ""))}
            {(lead as any).extra_data.handmatige_acceptatie.bevestigd_op && (
              <span className="mt-1 block font-normal text-foreground">Acceptatie bevestigd op {new Date((lead as any).extra_data.handmatige_acceptatie.bevestigd_op).toLocaleString("nl-NL")}.</span>
            )}
          </div>
        )}
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3 sm:items-center sm:gap-4">
            <Button variant="outline" size="icon" className="min-h-10 min-w-10 shrink-0" aria-label="Terug naar leads" asChild>
              <Link to="/admin/leads">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div className="min-w-0">
              <h1 className="break-words text-xl font-bold sm:text-2xl">
                {lead.voornaam} {lead.achternaam}
              </h1>
              {lead.bedrijfsnaam && (
                <p className="break-words text-muted-foreground">{lead.bedrijfsnaam}</p>
              )}
              <KlantLinkVoorLead leadId={lead.id} relatiecode={(lead as any).exact_relatie_code} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {lead.type !== "verzekering_aanvraag" && lead.status !== "klant" && (
              <Button variant="accent" onClick={handleMarkAsCustomer}>
                <UserCheck className="h-4 w-4 mr-2" />
                Markeer als klant
              </Button>
            )}
            {isSupervisorOrAdmin && (
              <Button
                variant={lead.is_test ? "secondary" : "outline"}
                size="sm"
                onClick={async () => {
                  const nieuw = !lead.is_test;
                  const { error } = await supabase
                    .from("leads")
                    .update({ is_test: nieuw })
                    .eq("id", lead.id);
                  if (error) {
                    toast({ title: "Fout", description: error.message, variant: "destructive" });
                    return;
                  }
                  try {
                    await supabase.from("activiteiten_log").insert({
                      actie_type: "lead_test_markering_gewijzigd",
                      omschrijving: `Testrecord-markering ${nieuw ? "aangezet" : "uitgezet"} voor ${lead.voornaam ?? ""} ${lead.achternaam ?? ""}`.trim(),
                      lead_id: lead.id,
                      klant_email: (lead.email ?? "").toLowerCase().trim() || null,
                    });
                  } catch { /* log-fout mag toggle niet blokkeren */ }
                  toast({ title: nieuw ? "Als testrecord gemarkeerd" : "Testmarkering verwijderd" });
                  window.location.reload();
                }}
                title="Alleen zichtbaar voor supervisor/admin"
              >
                {lead.is_test ? "✓ Testrecord" : "Markeer als test"}
              </Button>
            )}
            {isSupervisorOrAdmin && (
              <Button variant="destructive" size="icon" onClick={handleDelete}
                      title="Lead verwijderen (supervisor/admin)">
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Onboarding-stepper bovenaan */}
        {lead.type === "verzekering_aanvraag" && (
          <LeadOnboardingStepper lead={lead} />
        )}

        <LeadDoorlooptijd lead={lead} />


        <div className="grid min-w-0 gap-6 lg:grid-cols-3">
          {/* Lead info */}
          <div className="min-w-0 space-y-6 lg:col-span-2">
            <Card className="min-w-0 w-full overflow-hidden">
              <CardHeader>
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle className="break-words">Lead informatie</CardTitle>
                  {isSupervisorOrAdmin ? (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                        Geavanceerd: status handmatig wijzigen
                      </summary>
                      <div className="mt-2">
                        <Select value={lead.status} onValueChange={handleStatusChange}>
                          <SelectTrigger className="w-48">
                            <Badge className={statusColors[lead.status]} variant="secondary">
                              {statusLabels[lead.status]}
                            </Badge>
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(statusLabels).map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </details>
                  ) : (
                    <Badge className={statusColors[lead.status]} variant="secondary">
                      {statusLabels[lead.status]}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <LeadIngevuldeGegevens lead={lead as any} />

                {/* Beheer: branche en IBAN (bewerkbaar) */}
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-1">Beheer</h4>
                  {/* Branche - always visible, full width */}
                  <div className="mt-4">
                    <label className="text-muted-foreground text-sm block mb-1">
                      Branche {lead.branche ? "" : "(nog niet ingevuld)"}
                    </label>
                    <Select
                      value={lead.branche ?? ""}
                      onValueChange={(value) =>
                        updateLead.mutate({ id, updates: { branche: value } as any })
                      }
                    >
                      <SelectTrigger className="max-w-xs">
                        <SelectValue placeholder="Kies branche…" />
                      </SelectTrigger>
                      <SelectContent>
                        {ADMIN_BRANCHES.map((b) => (
                          <SelectItem key={b} value={b}>{b}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* IBAN - always visible, full width, directly under Branche */}
                  {(() => {
                    const ibanLocked = !!lead.geactiveerd_op && !isSupervisorOrAdmin;
                    return (
                      <div className="mt-4">
                        <label className="text-muted-foreground text-sm block mb-1">
                          IBAN {lead.iban ? "" : "(nog niet ingevuld)"}
                          {ibanLocked && (
                            <span className="ml-2 text-xs text-amber-600">
                              (vergrendeld na activatie — supervisor/admin)
                            </span>
                          )}
                        </label>
                        <Input
                          className="max-w-xs"
                          placeholder="NL00BANK0000000000"
                          value={lead.iban ?? ""}
                          disabled={ibanLocked}
                          onChange={(e) =>
                            updateLead.mutate({ id, updates: { iban: e.target.value } as any })
                          }
                        />
                      </div>
                    );
                  })()}
                </div>

                {lead.type === "offerte-aanvraag" && (
                  <div className="border-t pt-4">
                    <Button variant="outline" size="sm" className="mt-4" disabled title="Komt binnenkort">
                      <FileText className="h-4 w-4" /> Maak offerte (binnenkort)
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Notes */}
            <LeadNotes leadId={lead.id} />
          </div>

          {/* Sidebar */}
          <div className="min-w-0 space-y-6">
            {lead.type === "verzekering_aanvraag" && (() => {
              const phase = derivePhase(lead);
              return <LeadActivationPanel lead={lead} magActiveren={isTeamMember} fase={phase} />;
            })()}
            {lead.type === "verzekering_aanvraag" && lead.exact_account_id && (
              <LeadLifecyclePanel lead={lead} />
            )}
            {lead.type === "verzekering_aanvraag" && <SepaMachtigingBewijsBlok bronId={lead.id} />}
            <Card className="min-w-0 overflow-hidden">
              <CardHeader>
                <CardTitle>Tijdlijn</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Aangemaakt:</span>
                  <p className="font-medium">
                    {formatDateTimeLongNL(lead.created_at)}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Laatst bijgewerkt:</span>
                  <p className="font-medium">
                    {formatDateTimeLongNL(lead.updated_at)}
                  </p>
                </div>
                {lead.converted_at && (
                  <div>
                    <span className="text-muted-foreground">Geconverteerd:</span>
                    <p className="font-medium text-green-600">
                      {formatDateTimeLongNL(lead.converted_at)}
                    </p>
                  </div>
                )}

                <div>
                  <span className="text-muted-foreground">Bron:</span>
                  <p className="font-medium capitalize">{lead.bron}</p>
                </div>
              </CardContent>
            </Card>

            {/* Certificate - only for BAV leads */}
            {lead.type === "verzekering_aanvraag" && (
            <Card className="min-w-0 overflow-hidden">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Certificaat
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {lead.status !== "actief" && (
                  <p className="text-sm text-muted-foreground bg-secondary/50 p-3 rounded-lg">
                    Certificaten kunnen pas worden aangemaakt zodra de polis is geactiveerd (status <strong>Polis actief</strong>).
                  </p>
                )}
                <CertificaatBeheer
                  leadId={lead.id}
                  leadActief={lead.status === "actief"}
                  policies={policies || []}
                  isSupervisorOrAdmin={magCertificaten}
                  onChanged={() => refetchPolicies()}
                  onDownload={handleDownloadCertificate}
                />
              </CardContent>
            </Card>
            )}

            {/* Klantportaal uitnodiging — zichtbaar zodra polis actief is */}
            {lead.status === "actief" && (
              <Card className="min-w-0 overflow-hidden">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserCheck className="h-5 w-5" />
                    Klantportaal
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground mb-3">
                    Stuur een uitnodiging zodat de klant zijn polis, documenten en facturen kan inzien.
                  </p>
                  <PortalInviteButton leadId={lead.id} email={lead.email} />
                </CardContent>
              </Card>
            )}

            {/* Invoice (Exact) - only for BAV leads, read-only */}
            {lead.type === "verzekering_aanvraag" && (
            <Card className="min-w-0 overflow-hidden">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5" />
                  Factuur (Exact)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {!lead.exact_account_id && (
                  <p className="text-muted-foreground bg-secondary/50 p-3 rounded-lg">
                    Factureren is pas mogelijk nadat de polis in Exact is geactiveerd.
                  </p>
                )}
                {lead.exact_account_id && !lead.exact_invoice_id && (
                  <p className="text-muted-foreground bg-secondary/50 p-3 rounded-lg">
                    Factuur nog niet aangemaakt. Gebruik de knop in het <strong>Polis-activatie</strong> blok hierboven.
                  </p>
                )}
                {lead.exact_account_id && lead.exact_invoice_id && (
                  <div className="space-y-2 p-3 bg-secondary/50 rounded-lg">
                    <div>
                      <span className="text-muted-foreground">Status:</span>{" "}
                      <span className="font-medium">klaar voor controle</span>
                    </div>
                    {lead.exact_invoice_amount != null && (
                      <div>
                        <span className="text-muted-foreground">Eerste factuur:</span>{" "}
                        <span className="font-medium">€ {Number(lead.exact_invoice_amount).toFixed(2).replace('.', ',')}</span>
                        {lead.gekozen_pakket === "maandelijks" && <span className="text-muted-foreground"> (naar rato) · premie € 55 per maand</span>}
                      </div>
                    )}
                    {lead.exact_invoice_created_at && (
                      <div>
                        <span className="text-muted-foreground">Datum:</span>{" "}
                        <span className="font-medium">{formatDateLongNL(lead.exact_invoice_created_at)}</span>
                      </div>
                    )}
                    <a
                      href={`https://start.exactonline.nl/docs/SalesInvoice.aspx?ID=${lead.exact_invoice_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline text-xs mt-1"
                    >
                      Open in Exact →
                    </a>
                  </div>
                )}

              </CardContent>
            </Card>
            )}

          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

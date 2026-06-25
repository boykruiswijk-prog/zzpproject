import { useState } from "react";

import { useParams, useNavigate, Link } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { LeadNotes } from "@/components/admin/LeadNotes";
import { LeadActivationPanel } from "@/components/admin/LeadActivationPanel";
import { LeadLifecyclePanel } from "@/components/admin/LeadLifecyclePanel";
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

type LeadStatus = Database["public"]["Enums"]["lead_status"];

const statusLabels: Record<LeadStatus, string> = {
  nieuw: "Nieuw",
  nieuw_te_beoordelen: "Te beoordelen",
  in_behandeling: "In behandeling",
  afspraak_gepland: "Afspraak gepland",
  offerte_verstuurd: "Offerte verstuurd",
  klant: "Klant",
  actief: "Actief",
  gepauzeerd: "Gepauzeerd",
  opgezegd: "Opgezegd",
  afgewezen: "Afgewezen",
};

const statusColors: Record<LeadStatus, string> = {
  nieuw: "bg-blue-100 text-blue-800",
  nieuw_te_beoordelen: "bg-blue-100 text-blue-800",
  in_behandeling: "bg-yellow-100 text-yellow-800",
  afspraak_gepland: "bg-purple-100 text-purple-800",
  offerte_verstuurd: "bg-orange-100 text-orange-800",
  klant: "bg-green-100 text-green-800",
  actief: "bg-green-100 text-green-800",
  gepauzeerd: "bg-gray-100 text-gray-800",
  opgezegd: "bg-gray-200 text-gray-700",
  afgewezen: "bg-red-100 text-red-800",
};

export default function AdminLeadDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
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
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" asChild>
              <Link to="/admin/leads">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold">
                {lead.voornaam} {lead.achternaam}
              </h1>
              {lead.bedrijfsnaam && (
                <p className="text-muted-foreground">{lead.bedrijfsnaam}</p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {lead.status !== "klant" && (
              <Button variant="accent" onClick={handleMarkAsCustomer}>
                <UserCheck className="h-4 w-4 mr-2" />
                Markeer als klant
              </Button>
            )}
            {isAdmin && (
              <Button variant="destructive" size="icon" onClick={handleDelete}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Lead info */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Lead informatie</CardTitle>
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
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Contact info */}
                <div>
                  <h4 className="font-medium mb-3">Contactgegevens</h4>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <a
                        href={`mailto:${lead.email}`}
                        className="text-primary hover:underline"
                      >
                        {lead.email}
                      </a>
                    </div>
                    {lead.telefoon && (
                      <div className="flex items-center gap-3">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <a
                          href={`tel:${lead.telefoon}`}
                          className="text-primary hover:underline"
                        >
                          {lead.telefoon}
                        </a>
                      </div>
                    )}
                    {lead.geboortedatum && (
                      <div className="flex items-center gap-3">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>
                          {formatDateNL(lead.geboortedatum)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Company info */}
                <div>
                  <h4 className="font-medium mb-3">Bedrijfsgegevens</h4>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {lead.bedrijfsnaam && (
                      <div className="flex items-center gap-3">
                        <Building className="h-4 w-4 text-muted-foreground" />
                        <span>{lead.bedrijfsnaam}</span>
                      </div>
                    )}
                    {lead.kvk_nummer && (
                      <div>
                        <span className="text-muted-foreground text-sm">KvK:</span>{" "}
                        {lead.kvk_nummer}
                      </div>
                    )}
                    {lead.beroep && (
                      <div>
                        <span className="text-muted-foreground text-sm">Beroep:</span>{" "}
                        {lead.beroep}
                      </div>
                    )}
                    {lead.omzet && (
                      <div>
                        <span className="text-muted-foreground text-sm">Betaalfrequentie:</span>{" "}
                        {lead.omzet === "1" ? "Jaarlijks" : lead.omzet === "2" ? "Maandelijks" : lead.omzet === "maandelijks" ? "Maandelijks" : lead.omzet === "jaarlijks" ? "Jaarlijks" : lead.omzet}
                      </div>
                    )}
                    <div className="sm:col-span-2">
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
                          {[
                            "IT & ICT",
                            "HR & Finance consultancy",
                            "PR & Marketing",
                            "Management consultancy",
                            "Coaches",
                            "Zakelijke dienstverlening",
                          ].map((b) => (
                            <SelectItem key={b} value={b}>{b}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-muted-foreground text-sm block mb-1">
                        IBAN {lead.iban ? "" : "(nog niet ingevuld)"}
                      </label>
                      <Input
                        className="max-w-xs"
                        placeholder="NLxxXXXXxxxxxxxxx"
                        value={lead.iban ?? ""}
                        onChange={(e) =>
                          updateLead.mutate({ id, updates: { iban: e.target.value } as any })
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* Insurance info */}
                {lead.verzekering_type && (
                  <div>
                    <h4 className="font-medium mb-3">Verzekeringsaanvraag</h4>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <span className="text-muted-foreground text-sm">Type:</span>{" "}
                        <Badge variant="outline">{lead.verzekering_type}</Badge>
                      </div>
                      {lead.verzekerd_bedrag && (
                        <div>
                          <span className="text-muted-foreground text-sm">
                            Verzekerd bedrag:
                          </span>{" "}
                          {lead.verzekerd_bedrag}
                        </div>
                      )}
                      {lead.eigen_risico && (
                        <div>
                          <span className="text-muted-foreground text-sm">
                            Eigen risico:
                          </span>{" "}
                          €{lead.eigen_risico}
                        </div>
                      )}
                      {lead.ingangsdatum && (
                        <div>
                          <span className="text-muted-foreground text-sm">
                            Ingangsdatum:
                          </span>{" "}
                          {formatDateNL(lead.ingangsdatum)}
                        </div>
                      )}
                    </div>
                    {lead.opmerkingen && (
                      <div className="mt-4">
                        <span className="text-muted-foreground text-sm">
                          Opmerkingen:
                        </span>
                        <p className="mt-1 text-sm bg-secondary/50 p-3 rounded-lg whitespace-pre-line">
                          {lead.opmerkingen}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {lead.type === "offerte-aanvraag" && (lead as any).extra_data && (
                  <div className="border-t pt-4">
                    <h3 className="font-semibold mb-2">Offerte-aanvraag details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      {Object.entries((lead as any).extra_data as Record<string, unknown>).map(([k, v]) => (
                        <div key={k}>
                          <span className="text-muted-foreground">{k}:</span>{" "}
                          <span className="font-medium break-words">{v == null || v === "" ? "-" : String(v)}</span>
                        </div>
                      ))}
                    </div>
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
          <div className="space-y-6">
            {lead.type === "verzekering_aanvraag" && (
              <LeadActivationPanel lead={lead} isAdmin={isAdmin} />
            )}
            {lead.type === "verzekering_aanvraag" && lead.exact_account_id && (
              <LeadLifecyclePanel lead={lead} />
            )}
            <Card>
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
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Certificaat
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {lead.status !== "klant" && (
                  <p className="text-sm text-muted-foreground bg-secondary/50 p-3 rounded-lg">
                    Certificaten kunnen alleen worden aangemaakt als de lead de status <strong>Klant</strong> heeft.
                  </p>
                )}
                {policies && policies.length > 0 && policies.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-2 bg-secondary rounded-lg">
                    <div>
                      <p className="font-medium text-sm">{p.certificate_number}</p>
                      <p className="text-xs text-muted-foreground">{formatDateNL(p.created_at)}</p>
                    </div>
                    {p.pdf_url && (
                      <Button size="sm" variant="outline" onClick={() => handleDownloadCertificate(p.pdf_url!)}>
                        <Download className="h-3 w-3 mr-1" />
                        PDF
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  variant={policies && policies.length > 0 ? "outline" : "accent"}
                  className="w-full"
                  onClick={handleGenerateCertificate}
                  disabled={isGenerating || lead.status !== "klant"}
                >
                  {isGenerating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
                  {policies && policies.length > 0 ? "Nieuw certificaat" : "Certificaat genereren"}
                </Button>
              </CardContent>
            </Card>
            )}

            {/* Klantportaal uitnodiging — alleen voor klanten */}
            {lead.status === "klant" && (
              <Card>
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
            <Card>
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
                        <span className="text-muted-foreground">Bedrag:</span>{" "}
                        <span className="font-medium">€ {Number(lead.exact_invoice_amount).toFixed(2).replace('.', ',')}</span>
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

import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { LeadNotes } from "@/components/admin/LeadNotes";
import { useLead, useUpdateLead, useDeleteLead } from "@/hooks/useLeads";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  in_behandeling: "In behandeling",
  afspraak_gepland: "Afspraak gepland",
  offerte_verstuurd: "Offerte verstuurd",
  klant: "Klant",
  afgewezen: "Afgewezen",
};

const statusColors: Record<LeadStatus, string> = {
  nieuw: "bg-blue-100 text-blue-800",
  in_behandeling: "bg-yellow-100 text-yellow-800",
  afspraak_gepland: "bg-purple-100 text-purple-800",
  offerte_verstuurd: "bg-orange-100 text-orange-800",
  klant: "bg-green-100 text-green-800",
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
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);

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

  // Fetch existing invoices for this lead
  const { data: invoices, refetch: refetchInvoices } = useQuery({
    queryKey: ["invoices", id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from("invoices")
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
        window.open(result.policy.pdf_url, "_blank");
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
      window.open(data.signedUrl, "_blank");
    }
  };

  const handleGenerateInvoice = async () => {
    if (!id) return;
    setIsGeneratingInvoice(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-invoice`,
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

      toast({ title: "Factuur aangemaakt!", description: `Nummer: ${result.invoice.invoice_number}` });
      refetchInvoices();

      if (result.invoice.pdf_url) {
        try {
          const pdfResponse = await fetch(result.invoice.pdf_url);
          const blob = await pdfResponse.blob();
          const blobUrl = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = blobUrl;
          a.download = `${result.invoice.invoice_number}.pdf`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(blobUrl);
        } catch (e) {
          console.error("Download error:", e);
        }
      }
    } catch (error: any) {
      console.error("Invoice generation error:", error);
      toast({ title: "Fout", description: error.message, variant: "destructive" });
    } finally {
      setIsGeneratingInvoice(false);
    }
  };

  const handleDownloadInvoice = async (pdfPath: string) => {
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
        a.download = pdfPath.split("/").pop() || "factuur.pdf";
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
                          {new Date(lead.geboortedatum).toLocaleDateString("nl-NL")}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Company info */}
                {(lead.bedrijfsnaam || lead.kvk_nummer || lead.beroep) && (
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
                          <span className="text-muted-foreground text-sm">Omzet:</span>{" "}
                          {lead.omzet}
                        </div>
                      )}
                    </div>
                  </div>
                )}

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
                          {new Date(lead.ingangsdatum).toLocaleDateString("nl-NL")}
                        </div>
                      )}
                    </div>
                    {lead.opmerkingen && (
                      <div className="mt-4">
                        <span className="text-muted-foreground text-sm">
                          Opmerkingen:
                        </span>
                        <p className="mt-1 text-sm bg-secondary/50 p-3 rounded-lg">
                          {lead.opmerkingen}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Notes */}
            <LeadNotes leadId={lead.id} />
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Tijdlijn</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Aangemaakt:</span>
                  <p className="font-medium">
                    {new Date(lead.created_at).toLocaleString("nl-NL")}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Laatst bijgewerkt:</span>
                  <p className="font-medium">
                    {new Date(lead.updated_at).toLocaleString("nl-NL")}
                  </p>
                </div>
                {lead.converted_at && (
                  <div>
                    <span className="text-muted-foreground">Geconverteerd:</span>
                    <p className="font-medium text-green-600">
                      {new Date(lead.converted_at).toLocaleString("nl-NL")}
                    </p>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">Bron:</span>
                  <p className="font-medium capitalize">{lead.bron}</p>
                </div>
              </CardContent>
            </Card>

            {/* Certificate */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Certificaat
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {policies && policies.length > 0 ? (
                  <>
                    {policies.map((p) => (
                      <div key={p.id} className="flex items-center justify-between p-2 bg-secondary rounded-lg">
                        <div>
                          <p className="font-medium text-sm">{p.certificate_number}</p>
                          <p className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString("nl-NL")}</p>
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
                      variant="outline"
                      className="w-full"
                      onClick={handleGenerateCertificate}
                      disabled={isGenerating}
                    >
                      {isGenerating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
                      Nieuw certificaat
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="accent"
                    className="w-full"
                    onClick={handleGenerateCertificate}
                    disabled={isGenerating}
                  >
                    {isGenerating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
                    Certificaat genereren
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Invoice */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5" />
                  Factuur
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {invoices && invoices.length > 0 ? (
                  <>
                    {invoices.map((inv) => (
                      <div key={inv.id} className="flex items-center justify-between p-2 bg-secondary rounded-lg">
                        <div>
                          <p className="font-medium text-sm">{inv.invoice_number}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(inv.created_at).toLocaleDateString("nl-NL")} — {`€ ${Number(inv.amount_incl_btw).toFixed(2).replace('.', ',')}`}
                          </p>
                        </div>
                        {inv.pdf_url && (
                          <Button size="sm" variant="outline" onClick={() => handleDownloadInvoice(inv.pdf_url!)}>
                            <Download className="h-3 w-3 mr-1" />
                            PDF
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={handleGenerateInvoice}
                      disabled={isGeneratingInvoice}
                    >
                      {isGeneratingInvoice ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Receipt className="h-4 w-4 mr-2" />}
                      Nieuwe factuur
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="accent"
                    className="w-full"
                    onClick={handleGenerateInvoice}
                    disabled={isGeneratingInvoice}
                  >
                    {isGeneratingInvoice ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Receipt className="h-4 w-4 mr-2" />}
                    Factuur genereren
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

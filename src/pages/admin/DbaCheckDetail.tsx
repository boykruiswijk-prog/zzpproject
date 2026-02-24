import { useParams, Link } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useDbaCheck, useAnalyzeDba } from "@/hooks/useDbaChecks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft, Loader2, Play, RefreshCw, ShieldCheck, CheckCircle2,
  XCircle, AlertTriangle, Award, Copy, ExternalLink, Building2, Download,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const statusLabels: Record<string, string> = {
  uploaded: "Geüpload",
  analyzing: "Bezig met analyse",
  analyzed: "Geanalyseerd",
  reviewed: "Beoordeeld",
  approved: "Goedgekeurd",
  certified: "Gecertificeerd",
};

export default function DbaCheckDetail() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: check, isLoading } = useDbaCheck(id);
  const analyzeDba = useAnalyzeDba();

  const handleAnalyze = async () => {
    if (!id) return;
    try {
      await analyzeDba.mutateAsync({ checkId: id, action: "analyze" });
      toast({ title: "Analyse voltooid!" });
      queryClient.invalidateQueries({ queryKey: ["dba-check", id] });
    } catch (error: any) {
      toast({ title: "Fout bij analyse", description: error.message, variant: "destructive" });
    }
  };

  const handleRewrite = async () => {
    if (!id) return;
    try {
      await analyzeDba.mutateAsync({ checkId: id, action: "rewrite" });
      toast({ title: "Projectomschrijving herschreven!" });
      queryClient.invalidateQueries({ queryKey: ["dba-check", id] });
    } catch (error: any) {
      toast({ title: "Fout bij herschrijven", description: error.message, variant: "destructive" });
    }
  };

  const handleKvkCheck = async () => {
    if (!id) return;
    try {
      await analyzeDba.mutateAsync({ checkId: id, action: "check_kvk" });
      toast({ title: "KVK check voltooid!" });
      queryClient.invalidateQueries({ queryKey: ["dba-check", id] });
    } catch (error: any) {
      toast({ title: "Fout bij KVK check", description: error.message, variant: "destructive" });
    }
  };

  const handleCertify = async () => {
    if (!id) return;
    if (!confirm("Weet je zeker dat je een Wet DBA certificaat wilt afgeven?")) return;
    try {
      const result = await analyzeDba.mutateAsync({ checkId: id, action: "certify" });
      toast({ title: "Certificaat afgegeven!", description: `Nummer: ${result.certificate_number}` });
      queryClient.invalidateQueries({ queryKey: ["dba-check", id] });
    } catch (error: any) {
      toast({ title: "Fout bij certificering", description: error.message, variant: "destructive" });
    }
  };

  const copyVerificationLink = () => {
    if (!check?.verification_token) return;
    const url = `${window.location.origin}/verificatie/dba/${check.verification_token}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link gekopieerd!" });
  };

  const handleDownloadPdf = async () => {
    if (!check?.certificate_pdf_url) return;
    try {
      const { data, error } = await (await import("@/integrations/supabase/client")).supabase.storage
        .from("certificates")
        .download(check.certificate_pdf_url);
      if (error || !data) {
        toast({ title: "Fout bij downloaden", description: error?.message, variant: "destructive" });
        return;
      }
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${check.certificate_number || "certificaat"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast({ title: "Fout bij downloaden", description: err.message, variant: "destructive" });
    }
  };

  const handleViewPdf = async () => {
    if (!check?.certificate_pdf_url) return;
    try {
      const { data, error } = await (await import("@/integrations/supabase/client")).supabase.storage
        .from("certificates")
        .download(check.certificate_pdf_url);
      if (error || !data) {
        toast({ title: "Fout bij openen", description: error?.message, variant: "destructive" });
        return;
      }
      const url = URL.createObjectURL(data);
      window.open(url, "_blank");
    } catch (err: any) {
      toast({ title: "Fout bij openen", description: err.message, variant: "destructive" });
    }
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

  if (!check) {
    return (
      <AdminLayout>
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold mb-2">Check niet gevonden</h2>
          <Button asChild>
            <Link to="/admin/dba-checks">Terug naar overzicht</Link>
          </Button>
        </div>
      </AdminLayout>
    );
  }

  const score = check.suggestions?.[0]?.score;
  const summary = check.suggestions?.[0]?.summary;
  const kvkMatch = check.kvk_check_result?.match;
  const canCertify = check.status === "analyzed";

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" asChild>
              <Link to="/admin/dba-checks">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{check.client_name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary">
                  {statusLabels[check.status] || check.status}
                </Badge>
                {check.certificate_number && (
                  <Badge className="bg-emerald-100 text-emerald-900">
                    {check.certificate_number}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {check.status === "uploaded" && (
              <Button onClick={handleAnalyze} disabled={analyzeDba.isPending}>
                {analyzeDba.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Start analyse
              </Button>
            )}
            {check.status === "analyzed" && (
              <>
                <Button variant="outline" onClick={handleAnalyze} disabled={analyzeDba.isPending}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Opnieuw analyseren
                </Button>
                {canCertify && (
                  <Button onClick={handleCertify} disabled={analyzeDba.isPending} className="bg-emerald-600 hover:bg-emerald-700">
                    <Award className="h-4 w-4 mr-2" />
                    Certificaat afgeven
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            {/* Score */}
            {score !== undefined && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5" />
                    Compliance Score
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4">
                    <Progress value={score} className="flex-1" />
                    <span className={`text-2xl font-bold ${score >= 80 ? "text-green-600" : score >= 50 ? "text-yellow-600" : "text-red-600"}`}>
                      {score}%
                    </span>
                  </div>
                  {summary && <p className="text-sm text-muted-foreground">{summary}</p>}
                </CardContent>
              </Card>
            )}

            {/* Field Results */}
            {check.field_results && check.field_results.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Veldencontrole</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {check.field_results.map((field, idx) => (
                      <div
                        key={idx}
                        className={`p-4 rounded-lg border ${
                          (field.present ?? field.filled)
                            ? "border-green-200 bg-green-50"
                            : "border-red-200 bg-red-50"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {(field.present ?? field.filled) ? (
                            <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium">{field.field_name}</p>
                            {(field.present ?? field.filled) && (field.excerpt || field.value) && (
                              <p className="text-sm text-green-700 mt-1 italic">"{field.excerpt || field.value}"</p>
                            )}
                            {!(field.present ?? field.filled) && field.issue && (
                              <p className="text-sm text-red-700 mt-1">{field.issue}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* KVK Check */}
            {check.kvk_text && check.status !== "uploaded" && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="h-5 w-5" />
                      KVK Check
                    </CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleKvkCheck}
                      disabled={analyzeDba.isPending}
                    >
                      {analyzeDba.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4 mr-2" />
                      )}
                      {check.kvk_check_result ? "Opnieuw checken" : "Start KVK check"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">KVK bedrijfsomschrijving:</p>
                    <div className="p-3 rounded-lg bg-secondary/50 text-sm whitespace-pre-line">
                      {check.kvk_text}
                    </div>
                  </div>
                  {check.kvk_check_result && (
                    <div className={`p-4 rounded-lg border ${
                      check.kvk_check_result.match
                        ? "border-green-200 bg-green-50"
                        : "border-red-200 bg-red-50"
                    }`}>
                      <div className="flex items-start gap-3">
                        {check.kvk_check_result.match ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium">
                            {check.kvk_check_result.match ? "Werkzaamheden passen bij KVK" : "Werkzaamheden passen NIET bij KVK"}
                          </p>
                          <p className="text-sm mt-2">{check.kvk_check_result.explanation}</p>
                          {check.kvk_check_result.suggestions && check.kvk_check_result.suggestions.length > 0 && (
                            <div className="mt-3">
                              <p className="text-sm font-medium">Suggesties:</p>
                              <ul className="list-disc list-inside text-sm mt-1 space-y-1">
                                {check.kvk_check_result.suggestions.map((s, i) => (
                                  <li key={i}>{s}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Project description rewrite */}
            {check.project_description && check.status !== "uploaded" && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Projectomschrijving</CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRewrite}
                      disabled={analyzeDba.isPending}
                    >
                      {analyzeDba.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
                      )}
                      Herschrijf DBA-proof
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">Origineel:</p>
                    <div className="p-3 rounded-lg bg-secondary/50 text-sm whitespace-pre-line">
                      {check.project_description}
                    </div>
                  </div>
                  {check.rewritten_description && (
                    <div>
                      <p className="text-sm font-medium text-green-700 mb-2 flex items-center gap-1">
                        <CheckCircle2 className="h-4 w-4" />
                        Herschreven (DBA-proof):
                      </p>
                      <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-sm whitespace-pre-line">
                        {check.rewritten_description}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => {
                          navigator.clipboard.writeText(check.rewritten_description || "");
                          toast({ title: "Tekst gekopieerd!" });
                        }}
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Kopieer tekst
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Extracted text preview */}
            {check.extracted_text && (
              <Card>
                <CardHeader>
                  <CardTitle>{check.client_name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-h-64 overflow-y-auto p-3 rounded-lg bg-secondary/50 text-sm whitespace-pre-line">
                    {check.extracted_text}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Certificate info */}
            {check.status === "certified" && (
              <Card className="border-emerald-200 bg-emerald-50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-emerald-900">
                    <Award className="h-5 w-5" />
                    Certificaat
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-sm text-emerald-700">Certificaatnummer</p>
                    <p className="font-bold text-emerald-900">{check.certificate_number}</p>
                  </div>
                  <div>
                    <p className="text-sm text-emerald-700">Afgegeven op</p>
                    <p className="font-medium text-emerald-900">
                      {check.certified_at
                        ? new Date(check.certified_at).toLocaleString("nl-NL")
                        : "-"}
                    </p>
                  </div>
                  <div className="pt-2 space-y-2">
                    {check.certificate_pdf_url && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={handleViewPdf}
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Bekijk PDF
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={handleDownloadPdf}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download PDF
                        </Button>
                      </>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={copyVerificationLink}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Kopieer verificatielink
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      asChild
                    >
                      <Link to={`/verificatie/dba/${check.verification_token}`} target="_blank">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Bekijk online
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Aandachtspunten (informatief, blokkeert certificering niet) */}
            {check.status === "analyzed" && check.missing_fields && check.missing_fields.length > 0 && (
              <Card className="border-yellow-200 bg-yellow-50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-yellow-800 text-base">
                    <AlertTriangle className="h-5 w-5" />
                    Aandachtspunten
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-yellow-700 mb-3">
                    Deze punten worden als aandachtspunt opgenomen in het certificaat.
                  </p>
                  <div className="space-y-1">
                    {check.missing_fields.map((field, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm text-yellow-800">
                        <AlertTriangle className="h-3 w-3" />
                        {field}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Timeline */}
            <Card>
              <CardHeader>
                <CardTitle>Tijdlijn</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Aangemaakt:</span>
                  <p className="font-medium">
                    {new Date(check.created_at).toLocaleString("nl-NL")}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Laatst bijgewerkt:</span>
                  <p className="font-medium">
                    {new Date(check.updated_at).toLocaleString("nl-NL")}
                  </p>
                </div>
                {check.original_filename && (
                  <div>
                    <span className="text-muted-foreground">Bestand:</span>
                    <p className="font-medium">{check.original_filename}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

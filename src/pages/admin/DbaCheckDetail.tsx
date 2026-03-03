import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useDbaCheck, useAnalyzeDba } from "@/hooks/useDbaChecks";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft, Loader2, Play, RefreshCw, ShieldCheck, CheckCircle2,
  XCircle, AlertTriangle, Award, Copy, ExternalLink, Building2, Download, Upload, FileText,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
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
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [polisUploading, setPolisUploading] = useState(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!id) return;
    setActiveAction("analyze");
    try {
      await analyzeDba.mutateAsync({ checkId: id, action: "analyze" });
      toast({ title: "Veldenanalyse voltooid!" });

      if (check?.kvk_text) {
        try {
          await analyzeDba.mutateAsync({ checkId: id, action: "check_kvk" });
          toast({ title: "KVK check voltooid!" });
        } catch (e: any) {
          toast({ title: "KVK check mislukt", description: e.message, variant: "destructive" });
        }
      }

      if (check?.polis_text) {
        try {
          await analyzeDba.mutateAsync({ checkId: id, action: "check_polis" });
          toast({ title: "Polis check voltooid!" });
        } catch (e: any) {
          toast({ title: "Polis check mislukt", description: e.message, variant: "destructive" });
        }
      }

      if (check?.project_description || check?.extracted_text) {
        try {
          await analyzeDba.mutateAsync({ checkId: id, action: "rewrite" });
          toast({ title: "Projectomschrijving herschreven!" });
        } catch (e: any) {
          toast({ title: "Herschrijving mislukt", description: e.message, variant: "destructive" });
        }
      }

      queryClient.invalidateQueries({ queryKey: ["dba-check", id] });
    } catch (error: any) {
      toast({ title: "Fout bij analyse", description: error.message, variant: "destructive" });
    } finally {
      setActiveAction(null);
    }
  };

  const handlePolisUpload = async (file: File) => {
    if (!id) return;
    if (file.size > 20 * 1024 * 1024) {
      toast({ title: "Bestand te groot", description: "Maximale bestandsgrootte is 20MB.", variant: "destructive" });
      return;
    }
    setPolisUploading(true);
    try {
      // Upload file
      const polisPath = `polis/${crypto.randomUUID()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("dba-documents")
        .upload(polisPath, file);
      if (uploadError) throw uploadError;

      // Extract text from PDF
      let polisText = "";
      if (file.name.toLowerCase().endsWith(".pdf")) {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url
        ).toString();
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const pageText = content.items
            .map((item: any) => item.str)
            .filter((s: string) => s.trim().length > 0)
            .join(" ");
          polisText += pageText + "\n";
        }
        polisText = polisText.trim();
      }

      // Update the check record
      await supabase.from("dba_checks").update({
        polis_file_url: polisPath,
        polis_filename: file.name,
        polis_text: polisText || null,
      }).eq("id", id);

      toast({ title: "Polis geüpload!" });

      queryClient.invalidateQueries({ queryKey: ["dba-check", id] });

      // Auto-run polis check if text was extracted
      if (polisText) {
        try {
          await analyzeDba.mutateAsync({ checkId: id, action: "check_polis" });
          toast({ title: "Polis check voltooid!" });
          queryClient.invalidateQueries({ queryKey: ["dba-check", id] });
        } catch (e: any) {
          toast({ title: "Polis check mislukt", description: e.message, variant: "destructive" });
        }
      }
    } catch (error: any) {
      toast({ title: "Fout bij uploaden", description: error.message, variant: "destructive" });
    } finally {
      setPolisUploading(false);
    }
  };

  const handlePolisCheck = async () => {
    if (!id) return;
    setActiveAction("check_polis");
    try {
      await analyzeDba.mutateAsync({ checkId: id, action: "check_polis" });
      toast({ title: "Polis check voltooid!" });
      queryClient.invalidateQueries({ queryKey: ["dba-check", id] });
    } catch (error: any) {
      toast({ title: "Fout bij polis check", description: error.message, variant: "destructive" });
    } finally {
      setActiveAction(null);
    }
  };

  const handleRewrite = async () => {
    if (!id) return;
    setActiveAction("rewrite");
    try {
      await analyzeDba.mutateAsync({ checkId: id, action: "rewrite" });
      toast({ title: "Projectomschrijving herschreven!" });
      queryClient.invalidateQueries({ queryKey: ["dba-check", id] });
    } catch (error: any) {
      toast({ title: "Fout bij herschrijven", description: error.message, variant: "destructive" });
    } finally {
      setActiveAction(null);
    }
  };

  const handleKvkCheck = async () => {
    if (!id) return;
    setActiveAction("check_kvk");
    try {
      await analyzeDba.mutateAsync({ checkId: id, action: "check_kvk" });
      toast({ title: "KVK check voltooid!" });
      queryClient.invalidateQueries({ queryKey: ["dba-check", id] });
    } catch (error: any) {
      toast({ title: "Fout bij KVK check", description: error.message, variant: "destructive" });
    } finally {
      setActiveAction(null);
    }
  };

  const handleCertify = async () => {
    if (!id) return;
    if (!confirm("Weet je zeker dat je een Wet DBA certificaat wilt afgeven?")) return;
    setActiveAction("certify");
    try {
      const result = await analyzeDba.mutateAsync({ checkId: id, action: "certify" });
      toast({ title: "Certificaat afgegeven!", description: `Nummer: ${result.certificate_number}` });
      queryClient.invalidateQueries({ queryKey: ["dba-check", id] });
    } catch (error: any) {
      toast({ title: "Fout bij certificering", description: error.message, variant: "destructive" });
    } finally {
      setActiveAction(null);
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
        .createSignedUrl(check.certificate_pdf_url, 3600);
      if (error || !data?.signedUrl) {
        toast({ title: "Fout bij openen", description: error?.message || "Kon URL niet ophalen", variant: "destructive" });
        return;
      }
      setPdfUrl(data.signedUrl);
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
  const rawPolicyDate = check.suggestions?.[0]?.insurance_policy_date;
  const insurancePolicyDate = (rawPolicyDate && rawPolicyDate !== "null" && rawPolicyDate !== "undefined") ? rawPolicyDate : null;
  const insurancePolicyExpired = check.suggestions?.[0]?.insurance_policy_expired;
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
              <Button onClick={handleAnalyze} disabled={activeAction !== null}>
                {activeAction === "analyze" ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Start analyse
              </Button>
            )}
            {check.status === "analyzed" && (
              <>
                <Button variant="outline" onClick={handleAnalyze} disabled={activeAction !== null}>
                  {activeAction === "analyze" ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Opnieuw analyseren
                </Button>
                {canCertify && (
                  <Button onClick={handleCertify} disabled={activeAction !== null} className="bg-primary hover:bg-primary/90">
                    {activeAction === "certify" ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Award className="h-4 w-4 mr-2" />
                    )}
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

            {/* Insurance Policy Section - always show for upload */}
            {check.status !== "uploaded" && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5" />
                      Polis beroeps-/bedrijfsaansprakelijkheid
                    </CardTitle>
                    <div className="flex gap-2">
                      {check.polis_text && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handlePolisCheck}
                          disabled={activeAction !== null}
                        >
                          {activeAction === "check_polis" ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Play className="h-4 w-4 mr-2" />
                          )}
                          {check.suggestions?.[0]?.polis_check_result ? "Opnieuw checken" : "Check polis"}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Upload section */}
                  {!check.polis_filename && (
                    <div>
                      <label
                        htmlFor="polisUpload"
                        className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer hover:bg-secondary/50 transition-colors"
                      >
                        <div className="flex flex-col items-center gap-1 text-muted-foreground">
                          <Upload className="h-6 w-6" />
                          <span className="text-sm">Upload de verzekeringspolis (.pdf)</span>
                        </div>
                      </label>
                      <input
                        id="polisUpload"
                        type="file"
                        accept=".pdf"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handlePolisUpload(f);
                        }}
                      />
                    </div>
                  )}

                  {/* Show uploaded filename */}
                  {check.polis_filename && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <FileText className="h-4 w-4" />
                      <span>{check.polis_filename}</span>
                      <label htmlFor="polisReupload" className="text-primary cursor-pointer hover:underline ml-auto">
                        Vervang
                      </label>
                      <input
                        id="polisReupload"
                        type="file"
                        accept=".pdf"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handlePolisUpload(f);
                        }}
                      />
                    </div>
                  )}

                  {polisUploading && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Bezig met uploaden en analyseren...
                    </div>
                  )}

                  {/* Polis check results */}
                  {check.suggestions?.[0]?.polis_check_result && (
                    <div className="space-y-3">
                      {check.suggestions[0].polis_check_result.coverage_summary && (
                        <div className="p-3 rounded-lg bg-secondary/50 text-sm">
                          <p className="font-medium text-muted-foreground mb-1">Dekking:</p>
                          {check.suggestions[0].polis_check_result.coverage_summary}
                        </div>
                      )}
                      <div className="p-3 rounded-lg bg-secondary/50 text-sm">
                        <p className="font-medium text-muted-foreground mb-1">Beoordeling:</p>
                        {check.suggestions[0].polis_check_result.explanation}
                      </div>
                    </div>
                  )}

                  {insurancePolicyExpired === true && (
                    <div className="p-4 rounded-lg border border-orange-200 bg-orange-50">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5 shrink-0" />
                        <div>
                          <p className="font-medium text-orange-800">Polis ouder dan 1 jaar</p>
                          <p className="text-sm text-orange-700 mt-1">
                            De polis is gedateerd op {insurancePolicyDate ? new Date(insurancePolicyDate).toLocaleDateString("nl-NL") : "onbekend"}.
                            Vraag een actuele polis op (niet ouder dan 1 jaar).
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  {insurancePolicyExpired === false && insurancePolicyDate && (
                    <div className="p-4 rounded-lg border border-green-200 bg-green-50">
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                        <div>
                          <p className="font-medium text-green-800">Polis is actueel</p>
                          <p className="text-sm text-green-700 mt-1">
                            Gedateerd op {new Date(insurancePolicyDate).toLocaleDateString("nl-NL")} — niet ouder dan 1 jaar.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  {(insurancePolicyExpired === null || insurancePolicyExpired === undefined) && !check.polis_filename && check.status !== "uploaded" && (
                    <div className="p-4 rounded-lg border border-yellow-200 bg-yellow-50">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 shrink-0" />
                        <div>
                          <p className="font-medium text-yellow-800">Polisdatum niet gevonden</p>
                          <p className="text-sm text-yellow-700 mt-1">
                            Upload de polis hierboven om de datum automatisch te laten uitlezen.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
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
                      disabled={activeAction !== null}
                    >
                      {activeAction === "check_kvk" ? (
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
                    <>
                      {/* KVK Age Warning */}
                      {check.kvk_check_result.kvk_extract_expired === true && (
                        <div className="p-4 rounded-lg border border-orange-200 bg-orange-50">
                          <div className="flex items-start gap-3">
                            <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5 shrink-0" />
                            <div>
                              <p className="font-medium text-orange-800">KVK-uittreksel ouder dan 3 maanden</p>
                              <p className="text-sm text-orange-700 mt-1">
                                Het KVK-uittreksel is gedateerd op {check.kvk_check_result.kvk_extract_date ? new Date(check.kvk_check_result.kvk_extract_date).toLocaleDateString("nl-NL") : "onbekend"}.
                                Vraag een recent uittreksel op (niet ouder dan 3 maanden).
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                      {check.kvk_check_result.kvk_extract_expired === null && (
                        <div className="p-4 rounded-lg border border-yellow-200 bg-yellow-50">
                          <div className="flex items-start gap-3">
                            <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 shrink-0" />
                            <div>
                              <p className="font-medium text-yellow-800">KVK-uittreksel datum niet gevonden</p>
                              <p className="text-sm text-yellow-700 mt-1">
                                De datum van het KVK-uittreksel kon niet worden bepaald. Controleer handmatig of het niet ouder is dan 3 maanden.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                      {check.kvk_check_result.kvk_extract_expired === false && check.kvk_check_result.kvk_extract_date && (
                        <div className="p-4 rounded-lg border border-green-200 bg-green-50">
                          <div className="flex items-start gap-3">
                            <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                            <div>
                              <p className="font-medium text-green-800">KVK-uittreksel is recent</p>
                              <p className="text-sm text-green-700 mt-1">
                                Gedateerd op {new Date(check.kvk_check_result.kvk_extract_date).toLocaleDateString("nl-NL")} — niet ouder dan 3 maanden.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                      {/* KVK Match Result */}
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
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Project description rewrite */}
            {(check.project_description || check.extracted_text) && check.status !== "uploaded" && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Projectomschrijving</CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRewrite}
                      disabled={activeAction !== null}
                    >
                      {activeAction === "rewrite" ? (
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
                      {check.project_description || check.extracted_text}
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

      {/* PDF Viewer Dialog */}
      <Dialog open={!!pdfUrl} onOpenChange={(open) => { if (!open) { setPdfUrl(null); } }}>
        <DialogContent className="max-w-4xl h-[90vh] p-0 overflow-hidden">
          {pdfUrl && (
            <iframe src={pdfUrl + "#toolbar=1&navpanes=0"} className="w-full h-full rounded-lg border-0" title="Certificaat PDF" style={{ minHeight: "80vh" }} />
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

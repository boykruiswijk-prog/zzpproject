import { useParams, Link } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useDbaBatch, useBatchChecks, useBulkDba } from "@/hooks/useDbaBatches";
import { useAnalyzeDba } from "@/hooks/useDbaChecks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowLeft, Loader2, Play, Award, Eye, CheckCircle2, XCircle,
  Package, FileCheck, ShieldCheck,
} from "lucide-react";

const statusLabels: Record<string, string> = {
  uploaded: "Wacht op analyse",
  analyzing: "Bezig met analyse",
  analyzed: "Geanalyseerd",
  reviewed: "Beoordeeld",
  approved: "Goedgekeurd",
  certified: "Gecertificeerd",
};

const statusColors: Record<string, string> = {
  uploaded: "bg-gray-100 text-gray-800",
  analyzing: "bg-yellow-100 text-yellow-800",
  analyzed: "bg-blue-100 text-blue-800",
  reviewed: "bg-purple-100 text-purple-800",
  approved: "bg-green-100 text-green-800",
  certified: "bg-emerald-100 text-emerald-900",
};

const batchStatusLabels: Record<string, string> = {
  uploading: "Uploaden",
  extracted: "Documenten verwerkt",
  analyzing: "Bezig met analyse",
  analyzed: "Analyse voltooid",
  certified: "Gecertificeerd",
};

export default function DbaCheckBatchDetail() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: batch, isLoading: batchLoading } = useDbaBatch(id);
  const { data: checks, isLoading: checksLoading } = useBatchChecks(id);
  const bulkDba = useBulkDba();
  const analyzeDba = useAnalyzeDba();
  const [selectedChecks, setSelectedChecks] = useState<Set<string>>(new Set());
  const [isCertifying, setIsCertifying] = useState(false);

  const isLoading = batchLoading || checksLoading;
  const isPending = bulkDba.isPending || analyzeDba.isPending;

  const handleAnalyzeAll = async () => {
    if (!id) return;
    try {
      const result = await bulkDba.mutateAsync({ batchId: id, action: "analyze_all" });
      toast({
        title: "Analyse voltooid!",
        description: `${result.processed} kandidaten geanalyseerd.`,
      });
      queryClient.invalidateQueries({ queryKey: ["dba-batch-checks", id] });
      queryClient.invalidateQueries({ queryKey: ["dba-batch", id] });
    } catch (error: any) {
      toast({ title: "Fout bij analyse", description: error.message, variant: "destructive" });
    }
  };

  const handleCertifySelected = async () => {
    if (selectedChecks.size === 0) {
      toast({ title: "Selecteer minimaal 1 kandidaat", variant: "destructive" });
      return;
    }
    if (!confirm(`Weet je zeker dat je ${selectedChecks.size} certificaten wilt afgeven?`)) return;

    setIsCertifying(true);
    let certified = 0;
    for (const checkId of selectedChecks) {
      try {
        await analyzeDba.mutateAsync({ checkId, action: "certify" });
        certified++;
      } catch (e) {
        console.error(`Certify error for ${checkId}:`, e);
      }
    }
    setIsCertifying(false);
    setSelectedChecks(new Set());
    toast({ title: `${certified} certificaten afgegeven!` });
    queryClient.invalidateQueries({ queryKey: ["dba-batch-checks", id] });
    queryClient.invalidateQueries({ queryKey: ["dba-batch", id] });
    queryClient.invalidateQueries({ queryKey: ["dba-checks"] });
  };

  const toggleCheck = (checkId: string) => {
    setSelectedChecks(prev => {
      const next = new Set(prev);
      if (next.has(checkId)) next.delete(checkId);
      else next.add(checkId);
      return next;
    });
  };

  const toggleAll = () => {
    const analyzedChecks = checks?.filter(c => c.status === "analyzed") || [];
    if (selectedChecks.size === analyzedChecks.length) {
      setSelectedChecks(new Set());
    } else {
      setSelectedChecks(new Set(analyzedChecks.map(c => c.id)));
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

  if (!batch) {
    return (
      <AdminLayout>
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold mb-2">Batch niet gevonden</h2>
          <Button asChild>
            <Link to="/admin/dba-checks">Terug naar overzicht</Link>
          </Button>
        </div>
      </AdminLayout>
    );
  }

  const analyzedCount = checks?.filter(c => c.status === "analyzed").length || 0;
  const certifiedCount = checks?.filter(c => c.status === "certified").length || 0;
  const progressPercent = batch.total_candidates > 0
    ? Math.round(((analyzedCount + certifiedCount) / batch.total_candidates) * 100)
    : 0;

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
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Package className="h-6 w-6 text-primary" />
                {batch.name}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary">
                  {batchStatusLabels[batch.status] || batch.status}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {batch.total_candidates} kandidaten
                </span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {batch.status === "extracted" && (
              <Button onClick={handleAnalyzeAll} disabled={isPending}>
                {isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Alles analyseren
              </Button>
            )}
            {selectedChecks.size > 0 && (
              <Button
                onClick={handleCertifySelected}
                disabled={isCertifying}
                className="bg-primary hover:bg-primary/90"
              >
                {isCertifying ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Award className="h-4 w-4 mr-2" />
                )}
                {selectedChecks.size} certificeren
              </Button>
            )}
          </div>
        </div>

        {/* Progress */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Voortgang</span>
              <span className="text-sm text-muted-foreground">
                {analyzedCount + certifiedCount} / {batch.total_candidates} verwerkt
              </span>
            </div>
            <Progress value={progressPercent} className="h-3" />
            <div className="flex gap-6 mt-3 text-sm">
              <span className="flex items-center gap-1 text-muted-foreground">
                <FileCheck className="h-4 w-4" /> {analyzedCount} geanalyseerd
              </span>
              <span className="flex items-center gap-1 text-emerald-600">
                <ShieldCheck className="h-4 w-4" /> {certifiedCount} gecertificeerd
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Checks table */}
        <Card>
          <CardHeader>
            <CardTitle>Kandidaten</CardTitle>
            <CardDescription>
              Selecteer geanalyseerde kandidaten om in bulk te certificeren
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={analyzedCount > 0 && selectedChecks.size === analyzedCount}
                        onCheckedChange={toggleAll}
                      />
                    </TableHead>
                    <TableHead>Kandidaat / Klant</TableHead>
                    <TableHead>Bestand</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>KVK</TableHead>
                    <TableHead className="w-16">Detail</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(!checks || checks.length === 0) ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Geen kandidaten gevonden
                      </TableCell>
                    </TableRow>
                  ) : (
                    checks.map((check: any) => {
                      const score = check.suggestions?.[0]?.score;
                      const kvkMatch = check.kvk_check_result?.match;
                      const canSelect = check.status === "analyzed";
                      return (
                        <TableRow key={check.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedChecks.has(check.id)}
                              onCheckedChange={() => toggleCheck(check.id)}
                              disabled={!canSelect}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{check.client_name}</TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {check.original_filename || "-"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge className={statusColors[check.status] || ""} variant="secondary">
                              {statusLabels[check.status] || check.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {score !== undefined ? (
                              <span className={`font-bold ${score >= 80 ? "text-green-600" : score >= 50 ? "text-yellow-600" : "text-red-600"}`}>
                                {score}/100
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {kvkMatch === true && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                            {kvkMatch === false && <XCircle className="h-4 w-4 text-red-600" />}
                            {kvkMatch === undefined && <span className="text-muted-foreground">-</span>}
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" asChild>
                              <Link to={`/admin/dba-checks/${check.id}`}>
                                <Eye className="h-4 w-4" />
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

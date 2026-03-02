import { Link } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useDbaChecks } from "@/hooks/useDbaChecks";
import { supabase } from "@/integrations/supabase/client";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Plus, Loader2, FileCheck, ShieldCheck, Trash2, Package, Download } from "lucide-react";
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

const statusColors: Record<string, string> = {
  uploaded: "bg-gray-100 text-gray-800",
  analyzing: "bg-yellow-100 text-yellow-800",
  analyzed: "bg-blue-100 text-blue-800",
  reviewed: "bg-purple-100 text-purple-800",
  approved: "bg-green-100 text-green-800",
  certified: "bg-emerald-100 text-emerald-900",
};

export default function AdminDbaChecks() {
  const { data: checks, isLoading } = useDbaChecks();
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Weet je zeker dat je de check voor "${name}" wilt verwijderen?`)) return;
    const { error } = await supabase.from("dba_checks").delete().eq("id", id);
    if (error) {
      toast({ title: "Fout bij verwijderen", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Check verwijderd" });
      queryClient.invalidateQueries({ queryKey: ["dba-checks"] });
    }
  };

  const handleExportPdf = async () => {
    if (!checks?.length) return;
    const { default: jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;

    // Load logos as base64
    const loadImage = async (url: string): Promise<string> => {
      const res = await fetch(url);
      const blob = await res.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    };

    const [zpLogo, onefellowLogo] = await Promise.all([
      loadImage("/templates/zp-approved-export.png"),
      loadImage("/templates/onefellow-export.png"),
    ]);

    const doc = new jsPDF({ orientation: "landscape" });
    const pageWidth = doc.internal.pageSize.getWidth();

    // ZP Approved logo top-left (maintain aspect ratio, ~2:1 width:height)
    doc.addImage(zpLogo, "PNG", 14, 10, 40, 20);

    // Onefellow logo top-right (maintain aspect ratio, ~4:1 width:height)
    doc.addImage(onefellowLogo, "PNG", pageWidth - 54, 14, 40, 10);

    // Title centered
    doc.setFontSize(16);
    doc.text("ZP Approved - Overzicht Wet DBA Checks", pageWidth / 2, 24, { align: "center" });
    doc.setFontSize(9);
    doc.text(`Gegenereerd op ${new Date().toLocaleDateString("nl-NL")}`, pageWidth / 2, 30, { align: "center" });

    const certifiedChecks = checks.filter((c) => c.certificate_number && !c.invoiced_at);

    if (certifiedChecks.length === 0) {
      toast({ title: "Geen checks om te exporteren", description: "Alle gecertificeerde checks zijn al gefactureerd." });
      return;
    }
    
    const tableData = certifiedChecks.map((check) => {
      let opdrachtgever = "";
      if (check.field_results?.length) {
        const field = check.field_results.find(
          (f) => f.field_name?.toLowerCase().includes("opdrachtgever") && !f.field_name?.toLowerCase().includes("eind")
        );
        if (field) opdrachtgever = field.value || "";
      }

      return [
        check.client_name,
        opdrachtgever,
        check.certificate_number || "-",
      ];
    });

    autoTable(doc, {
      startY: 42,
      head: [["Kandidaat", "Entiteit Opdrachtgever", "Certificaatnummer"]],
      body: tableData,
      styles: { fontSize: 10 },
      headStyles: { fillColor: [30, 64, 124] },
    });

    // Save PDF first - only mark as invoiced after successful save
    try {
      doc.save("zp-approved-overzicht.pdf");
    } catch (saveError: any) {
      toast({ title: "PDF opslaan mislukt", description: saveError.message, variant: "destructive" });
      return;
    }

    // Mark exported checks as invoiced only after successful PDF generation
    const now = new Date().toISOString();
    const uninvoicedIds = certifiedChecks.map((c) => c.id);
    
    if (uninvoicedIds.length > 0) {
      await supabase
        .from("dba_checks")
        .update({ invoiced_at: now } as any)
        .in("id", uninvoicedIds);
      queryClient.invalidateQueries({ queryKey: ["dba-checks"] });
    }

    toast({ title: "PDF geëxporteerd", description: `${uninvoicedIds.length} check(s) als gefactureerd gemarkeerd` });
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <ShieldCheck className="h-8 w-8 text-primary" />
              Wet DBA Checks
            </h1>
            <p className="text-muted-foreground">
              Upload overeenkomsten en controleer op Wet DBA compliance
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExportPdf} disabled={!checks?.length}>
              <Download className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
            <Button variant="outline" asChild>
              <Link to="/admin/dba-checks/bulk">
                <Package className="h-4 w-4 mr-2" />
                Bulk upload
              </Link>
            </Button>
            <Button asChild>
              <Link to="/admin/dba-checks/nieuw">
                <Plus className="h-4 w-4 mr-2" />
                Nieuwe check
              </Link>
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                   <TableHead>Klant</TableHead>
                   <TableHead>Document</TableHead>
                   <TableHead>Status</TableHead>
                   <TableHead>Facturatie</TableHead>
                   <TableHead>Score</TableHead>
                   <TableHead>Datum</TableHead>
                   <TableHead className="w-20">Acties</TableHead>
                 </TableRow>
               </TableHeader>
               <TableBody>
                 {checks?.length === 0 ? (
                   <TableRow>
                     <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                       Nog geen DBA checks uitgevoerd
                    </TableCell>
                  </TableRow>
                ) : (
                  checks?.map((check) => {
                    const score = check.suggestions?.[0]?.score;
                    return (
                      <TableRow key={check.id}>
                        <TableCell className="font-medium">{check.client_name}</TableCell>
                        <TableCell>
                          {check.original_filename ? (
                            <span className="flex items-center gap-2 text-sm">
                              <FileCheck className="h-4 w-4 text-muted-foreground" />
                              {check.original_filename}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={statusColors[check.status] || ""} variant="secondary">
                            {statusLabels[check.status] || check.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {check.invoiced_at ? (
                            <Badge className="bg-green-100 text-green-800" variant="secondary">
                              Gefactureerd {new Date(check.invoiced_at).toLocaleDateString("nl-NL")}
                            </Badge>
                          ) : check.status === "certified" ? (
                            <Badge className="bg-orange-100 text-orange-800" variant="secondary">
                              Niet gefactureerd
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
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
                          {new Date(check.created_at).toLocaleDateString("nl-NL")}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" asChild>
                              <Link to={`/admin/dba-checks/${check.id}`}>
                                <Eye className="h-4 w-4" />
                              </Link>
                            </Button>
                            {isAdmin && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(check.id, check.client_name)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

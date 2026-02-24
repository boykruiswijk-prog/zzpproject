import { Link } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useDbaChecks } from "@/hooks/useDbaChecks";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Plus, Loader2, FileCheck, ShieldCheck } from "lucide-react";

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
          <Button asChild>
            <Link to="/admin/dba-checks/nieuw">
              <Plus className="h-4 w-4 mr-2" />
              Nieuwe check
            </Link>
          </Button>
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
                  <TableHead>Score</TableHead>
                  <TableHead>Datum</TableHead>
                  <TableHead className="w-20">Acties</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {checks?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
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
        )}
      </div>
    </AdminLayout>
  );
}

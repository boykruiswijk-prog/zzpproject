import { AdminLayout } from "@/components/admin/AdminLayout";
import { DashboardStats } from "@/components/admin/DashboardStats";
import { DashboardCharts } from "@/components/admin/DashboardCharts";
import { BillingNotifications } from "@/components/admin/BillingNotifications";
import { Button } from "@/components/ui/button";
import { Download, FileCode, Loader2 } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function AdminDashboard() {
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingUBL, setIsExportingUBL] = useState(false);
  const { toast } = useToast();

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "Niet ingelogd", description: "Log opnieuw in om te exporteren.", variant: "destructive" });
        return;
      }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/export-excel`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Export mislukt");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `zpzaken-export-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({ title: "Export succesvol", description: "Het Excel-bestand is gedownload." });
    } catch (error: any) {
      console.error("Export error:", error);
      toast({ title: "Export mislukt", description: error.message, variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportUBL = async () => {
    setIsExportingUBL(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "Niet ingelogd", description: "Log opnieuw in.", variant: "destructive" });
        return;
      }

      const today = new Date().toISOString().slice(0, 10);
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/export-ubl?date=${today}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "UBL export mislukt");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `zpzaken-ubl-${today}.xml`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({ title: "UBL export succesvol", description: "Het XML-bestand is gedownload." });
    } catch (error: any) {
      console.error("UBL export error:", error);
      toast({ title: "UBL export mislukt", description: error.message, variant: "destructive" });
    } finally {
      setIsExportingUBL(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">
              Overzicht van leads en conversies
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExportUBL} disabled={isExportingUBL}>
              {isExportingUBL ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCode className="h-4 w-4" />}
              UBL Export
            </Button>
            <Button variant="outline" onClick={handleExport} disabled={isExporting}>
              {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Excel
            </Button>
          </div>
        </div>

        <BillingNotifications />
        <DashboardStats />
        <DashboardCharts />
      </div>
    </AdminLayout>
  );
}

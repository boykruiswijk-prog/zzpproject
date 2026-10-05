import { AdminLayout } from "@/components/admin/AdminLayout";
import { DashboardStats } from "@/components/admin/DashboardStats";
import { DashboardCharts } from "@/components/admin/DashboardCharts";
import { MFAManagement } from "@/components/admin/MFAManagement";
import { SupervisorKpiPanel } from "@/components/admin/SupervisorKpiPanel";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { ExactKoppelingAlarm } from "@/components/admin/ExactKoppelingAlarm";
import { CollectiefAanmeldingenTeller } from "@/components/admin/CollectiefAanmeldingenTeller";
import { ZekerChatKpi } from "@/components/admin/ZekerChatKpi";
import { VandaagTeDoen } from "@/components/admin/VandaagTeDoen";
import { ToonTestrecordsSchakelaar } from "@/components/admin/ToonTestrecordsSchakelaar";


export default function AdminDashboard() {
  const [isExporting, setIsExporting] = useState(false);
  const { isSupervisor, isVerzekering } = useAuth();
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

  return (
    <AdminLayout>
      <div className="min-w-0 space-y-8">
        {(isSupervisor || isVerzekering) && <ExactKoppelingAlarm />}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="break-words text-2xl font-bold sm:text-3xl">Dashboard</h1>
            <p className="text-muted-foreground">
              Klanten, contracten en leads uit het CRM
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <ToonTestrecordsSchakelaar />
            <Button variant="outline" onClick={handleExport} disabled={isExporting}>
              {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Excel
            </Button>
          </div>
        </div>

        <VandaagTeDoen />
        <DashboardStats />
        <MFAManagement />
        <ZekerChatKpi />
        {isSupervisor && <CollectiefAanmeldingenTeller />}
        {isSupervisor && <SupervisorKpiPanel />}
        <DashboardCharts />
      </div>
    </AdminLayout>
  );

}

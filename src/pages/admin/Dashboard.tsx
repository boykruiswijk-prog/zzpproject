import { AdminLayout } from "@/components/admin/AdminLayout";
import { DashboardStats } from "@/components/admin/DashboardStats";
import { DashboardCharts } from "@/components/admin/DashboardCharts";

export default function AdminDashboard() {
  return (
    <AdminLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Overzicht van leads en conversies
          </p>
        </div>

        <DashboardStats />
        <DashboardCharts />
      </div>
    </AdminLayout>
  );
}

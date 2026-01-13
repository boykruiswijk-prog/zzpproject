import { AdminLayout } from "@/components/admin/AdminLayout";
import { LeadTable } from "@/components/admin/LeadTable";

export default function AdminLeads() {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Leads</h1>
          <p className="text-muted-foreground">
            Beheer en volg alle leads
          </p>
        </div>

        <LeadTable />
      </div>
    </AdminLayout>
  );
}

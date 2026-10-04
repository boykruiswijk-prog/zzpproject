import { ToonTestrecordsSchakelaar } from "@/components/admin/ToonTestrecordsSchakelaar";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { LeadTable } from "@/components/admin/LeadTable";

export default function AdminLeads() {
  return (
    <AdminLayout>
      <div className="min-w-0 space-y-6">
        <div>
          <h1 className="break-words text-2xl font-bold sm:text-3xl">Leads</h1>
          <p className="text-muted-foreground">
            Beheer en volg alle leads
          </p>
          <div className="mt-2"><ToonTestrecordsSchakelaar /></div>

        </div>

        <LeadTable />
      </div>
    </AdminLayout>
  );
}

import { ToonTestrecordsSchakelaar } from "@/components/admin/ToonTestrecordsSchakelaar";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { LeadTable } from "@/components/admin/LeadTable";

/** Leads: offerte-, contact- en terugbelverzoeken. Aanvragen (afsluitingen) staan op een eigen pagina. */
export default function AdminLeads({ soort = "leads" }: { soort?: "aanvragen" | "leads" }) {
  const aanvragen = soort === "aanvragen";
  return (
    <AdminLayout>
      <div className="min-w-0 space-y-6">
        <div>
          <h1 className="break-words text-2xl font-bold sm:text-3xl">{aanvragen ? "Aanvragen" : "Leads"}</h1>
          <p className="text-muted-foreground">
            {aanvragen ? "Afsluitingen van verzekeringen via de site" : "Offerteaanvragen, contact- en terugbelverzoeken"}
          </p>
          <div className="mt-2"><ToonTestrecordsSchakelaar /></div>
        </div>
        <LeadTable key={soort} soort={soort} />
      </div>
    </AdminLayout>
  );
}

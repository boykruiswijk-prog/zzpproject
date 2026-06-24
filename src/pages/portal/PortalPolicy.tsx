import { PortalLayout } from "@/components/portal/PortalLayout";
import { formatDateNL } from "@/lib/dateFormat";
import { usePortalPolicies } from "@/hooks/usePortalData";
import { PolicyLifecycleActions } from "@/components/portal/PolicyLifecycleActions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Download, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function PortalPolicy() {
  const { data: policies, isLoading } = usePortalPolicies();
  const { toast } = useToast();

  const handleDownload = async (path: string) => {
    const { data, error } = await supabase.storage.from("certificates").createSignedUrl(path, 3600);
    if (error || !data) {
      toast({ title: "Download mislukt", description: error?.message, variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  return (
    <PortalLayout>
      <h1 className="text-3xl font-bold mb-6">Mijn polis</h1>
      <div className="mb-6">
        <PolicyLifecycleActions />
      </div>
      {isLoading && <Loader2 className="h-6 w-6 animate-spin text-accent" />}
      {!isLoading && (!policies || policies.length === 0) && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p>Er is nog geen polis aan je account gekoppeld.</p>
          </CardContent>
        </Card>
      )}
      <div className="space-y-4">
        {policies?.map((p) => (
          <Card key={p.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{p.package_type}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Certificaat {p.certificate_number}
                  </p>
                </div>
                {p.pdf_url && (
                  <Button variant="outline" size="sm" onClick={() => handleDownload(p.pdf_url!)}>
                    <Download className="h-4 w-4 mr-2" />
                    PDF
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">Verzekerde</dt>
                  <dd className="font-medium">{p.insured_name}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Beroep</dt>
                  <dd className="font-medium">{p.profession}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Ingangsdatum</dt>
                  <dd className="font-medium">{formatDateNL(p.start_date)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Looptijd</dt>
                  <dd className="font-medium">{p.contract_duration}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">BAV per gebeurtenis</dt>
                  <dd className="font-medium">{p.bav_per_event}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">BAV per jaar</dt>
                  <dd className="font-medium">{p.bav_per_year}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">AVB per gebeurtenis</dt>
                  <dd className="font-medium">{p.avb_per_event}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">AVB per jaar</dt>
                  <dd className="font-medium">{p.avb_per_year}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground">Eigen risico</dt>
                  <dd className="font-medium">{p.own_risk}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground">Dekkingsgebied</dt>
                  <dd className="font-medium">{p.coverage_area}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        ))}
      </div>
    </PortalLayout>
  );
}

import { useState } from "react";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { formatDateLongNL } from "@/lib/dateFormat";
import { useCustomerInvoices, downloadCustomerInvoicePdf, type CustomerInvoice } from "@/hooks/useCustomerInvoices";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, Receipt, Loader2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function StatusBadge({ status }: { status: CustomerInvoice["status"] }) {
  if (status === "betaald") {
    return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200">Betaald</Badge>;
  }
  if (status === "vervallen") {
    return <Badge className="bg-red-100 text-red-800 hover:bg-red-100 border-red-200">Vervallen</Badge>;
  }
  return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200">Open</Badge>;
}

function formatEuro(n: number) {
  return `€ ${n.toFixed(2).replace(".", ",")}`;
}

export default function PortalInvoices() {
  const { data: invoices, isLoading, isError } = useCustomerInvoices();
  const { toast } = useToast();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownload = async (inv: CustomerInvoice) => {
    setDownloadingId(inv.id);
    try {
      await downloadCustomerInvoicePdf(inv.id, inv.factuurnummer);
    } catch (e) {
      toast({
        title: "Download mislukt",
        description: e instanceof Error ? e.message : "Probeer het later opnieuw.",
        variant: "destructive",
      });
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <PortalLayout>
      <h1 className="text-3xl font-bold mb-6">Facturen</h1>

      {isLoading && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Card key={i}>
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-9 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!isLoading && isError && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <AlertCircle className="h-12 w-12 mx-auto mb-3 text-red-400" />
            <p>Er ging iets mis bij het ophalen van je facturen. Probeer het later opnieuw.</p>
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && (!invoices || invoices.length === 0) && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Receipt className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p>
              Je hebt nog geen facturen ontvangen. Zodra je polis is geactiveerd en de eerste
              factuur is verstuurd, verschijnt deze hier.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {invoices?.map((inv) => (
          <Card key={inv.id}>
            <CardContent className="flex items-center justify-between p-4 gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium">{inv.factuurnummer}</p>
                  <StatusBadge status={inv.status} />
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {formatDateLongNL(inv.datum)} · <span className="font-medium text-foreground">{formatEuro(inv.bedrag)}</span>
                </p>
                {inv.omschrijving && (
                  <p className="text-xs text-muted-foreground mt-1 truncate">{inv.omschrijving}</p>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDownload(inv)}
                disabled={downloadingId === inv.id}
              >
                {downloadingId === inv.id ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                PDF
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </PortalLayout>
  );
}

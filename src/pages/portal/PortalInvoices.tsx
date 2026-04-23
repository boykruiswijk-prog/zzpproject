import { PortalLayout } from "@/components/portal/PortalLayout";
import { usePortalInvoices } from "@/hooks/usePortalData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, Receipt } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function PortalInvoices() {
  const { data: invoices, isLoading } = usePortalInvoices();
  const { toast } = useToast();

  const handleDownload = (url: string, name: string) => {
    if (!url) {
      toast({ title: "Geen PDF beschikbaar", variant: "destructive" });
      return;
    }
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}.pdf`;
    a.target = "_blank";
    a.click();
  };

  return (
    <PortalLayout>
      <h1 className="text-3xl font-bold mb-6">Facturen</h1>
      {isLoading && <Loader2 className="h-6 w-6 animate-spin text-accent" />}
      {!isLoading && (!invoices || invoices.length === 0) && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Receipt className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p>Er zijn nog geen facturen.</p>
          </CardContent>
        </Card>
      )}
      <div className="space-y-3">
        {invoices?.map((inv) => (
          <Card key={inv.id}>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium">{inv.invoice_number}</p>
                  <Badge variant={inv.status === "betaald" ? "default" : "outline"}>
                    {inv.status}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {new Date(inv.invoice_date).toLocaleDateString("nl-NL")} —{" "}
                  € {Number(inv.amount_incl_btw).toFixed(2).replace(".", ",")}
                </p>
                <p className="text-xs text-muted-foreground">{inv.description}</p>
              </div>
              {inv.pdf_url && (
                <Button variant="outline" size="sm" onClick={() => handleDownload(inv.pdf_url!, inv.invoice_number)}>
                  <Download className="h-4 w-4 mr-2" />
                  PDF
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </PortalLayout>
  );
}

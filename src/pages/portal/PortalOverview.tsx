import { PortalLayout } from "@/components/portal/PortalLayout";
import { usePortalAuth } from "@/contexts/PortalAuthContext";
import { usePortalPolicies } from "@/hooks/usePortalData";
import { useCustomerInvoices } from "@/hooks/useCustomerInvoices";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { FileText, Receipt, Briefcase, ArrowRight } from "lucide-react";

export default function PortalOverview() {
  const { user } = usePortalAuth();
  const { data: policies } = usePortalPolicies();
  const { data: invoices } = useCustomerInvoices();

  const activePolicy = policies?.[0];
  const totalInvoices = invoices?.length || 0;
  const openCount = invoices?.filter((i) => i.status === "open").length || 0;
  const paidCount = invoices?.filter((i) => i.status === "betaald").length || 0;
  const overdueCount = invoices?.filter((i) => i.status === "vervallen").length || 0;

  const invoicesLabel =
    totalInvoices === 0
      ? "Je hebt nog geen facturen ontvangen."
      : totalInvoices === 1
      ? "Je hebt 1 factuur."
      : `Je hebt ${totalInvoices} facturen.`;

  return (
    <PortalLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">
            Welkom{user?.user_metadata?.full_name ? `, ${user.user_metadata.full_name}` : ""}
          </h1>
          <p className="text-muted-foreground mt-1">
            Hier vind je een overzicht van je polis, documenten en facturen.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Actieve polis</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {activePolicy ? activePolicy.package_type : "-"}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {activePolicy ? `Certificaat ${activePolicy.certificate_number}` : "Nog geen polis gekoppeld"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Openstaande facturen</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{openInvoices}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {invoices && invoices.length > 0
                  ? `${invoices.length} facturen totaal`
                  : "Zodra je polis is geactiveerd verschijnt hier je eerste factuur."}
              </p>
            </CardContent>

          </Card>
        </div>

        {/* Onefellow — geherformuleerd: ZP Zaken stelt je gratis voor aan opdrachtgevers */}
        <Card className="border-accent/30 bg-accent/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-accent" />
              Gratis voorgesteld worden aan opdrachtgevers
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-foreground/80">
              Via Onefellow, onderdeel van dezelfde eigenaren als ZP Zaken. Je wordt gratis
              voorgesteld aan opdrachtgevers die op zoek zijn naar zelfstandige professionals. Geen
              tussenpartij die meedeelt in je tarief: de opdrachtgever betaalt, jij ontvangt je
              volledige uurtarief.
            </p>
            <Button asChild variant="accent" size="sm">
              <a href="https://onefellow.com" target="_blank" rel="noopener noreferrer">
                Meer informatie <ArrowRight className="h-4 w-4 ml-2" />
              </a>
            </Button>
          </CardContent>
        </Card>

        <div className="grid sm:grid-cols-2 gap-4">
          <Button asChild variant="outline" className="h-auto py-4 justify-start">
            <Link to="/portal/polis">
              <FileText className="h-5 w-5 mr-3" />
              <div className="text-left">
                <div className="font-medium">Bekijk je polis</div>
                <div className="text-xs text-muted-foreground">Dekking, certificaat en details</div>
              </div>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-auto py-4 justify-start">
            <Link to="/portal/facturen">
              <Receipt className="h-5 w-5 mr-3" />
              <div className="text-left">
                <div className="font-medium">Naar je facturen</div>
                <div className="text-xs text-muted-foreground">Download PDF's</div>
              </div>
            </Link>
          </Button>
        </div>
      </div>
    </PortalLayout>
  );
}

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Receipt, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";

interface BillingItem {
  lead_id: string;
  client_name: string;
  company_name: string | null;
  package_type: string;
  betaalfrequentie: string;
  last_invoice_date: string;
  next_invoice_date: string;
  is_due: boolean;
  is_overdue: boolean;
}

export function BillingNotifications() {
  const { data: billingItems, isLoading } = useQuery({
    queryKey: ["billing-notifications"],
    queryFn: async () => {
      // Get all klant leads
      const { data: leads, error: leadsError } = await supabase
        .from("leads")
        .select("id, voornaam, achternaam, bedrijfsnaam, verzekering_type, omzet")
        .eq("status", "klant");

      if (leadsError) throw leadsError;
      if (!leads || leads.length === 0) return [];

      // Get latest invoice per lead
      const { data: invoices, error: invError } = await supabase
        .from("invoices")
        .select("lead_id, invoice_date, amount_incl_btw")
        .order("invoice_date", { ascending: false });

      if (invError) throw invError;

      const now = new Date();
      const items: BillingItem[] = [];

      for (const lead of leads) {
        const freq = lead.omzet;
        if (!freq) continue;

        const isMonthly = freq === "maandelijks" || freq === "2";
        const leadInvoices = (invoices || []).filter((i) => i.lead_id === lead.id);
        const lastInvoice = leadInvoices[0];

        let nextDate: Date;
        if (lastInvoice) {
          nextDate = new Date(lastInvoice.invoice_date);
          if (isMonthly) {
            nextDate.setMonth(nextDate.getMonth() + 1);
          } else {
            nextDate.setFullYear(nextDate.getFullYear() + 1);
          }
        } else {
          // No invoice yet — due now
          nextDate = new Date(now);
        }

        const isDue = nextDate <= new Date(now.getFullYear(), now.getMonth() + 1, 0); // due this month
        const isOverdue = nextDate < now;

        if (isDue || !lastInvoice) {
          items.push({
            lead_id: lead.id,
            client_name: `${lead.voornaam} ${lead.achternaam}`,
            company_name: lead.bedrijfsnaam,
            package_type: lead.verzekering_type || "Combi Uitgebreid",
            betaalfrequentie: isMonthly ? "Maandelijks" : "Jaarlijks",
            last_invoice_date: lastInvoice?.invoice_date || "-",
            next_invoice_date: nextDate.toISOString().slice(0, 10),
            is_due: isDue,
            is_overdue: isOverdue,
          });
        }
      }

      // Sort: overdue first, then by next date
      items.sort((a, b) => {
        if (a.is_overdue && !b.is_overdue) return -1;
        if (!a.is_overdue && b.is_overdue) return 1;
        return new Date(a.next_invoice_date).getTime() - new Date(b.next_invoice_date).getTime();
      });

      return items;
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Te factureren
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-20 bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
    );
  }

  if (!billingItems || billingItems.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Te factureren
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Geen openstaande facturatiemomenten.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="h-5 w-5" />
          Te factureren
          <Badge variant="destructive" className="ml-auto">{billingItems.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {billingItems.map((item) => (
            <div
              key={item.lead_id}
              className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {item.is_overdue && <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />}
                  <p className="font-medium text-sm truncate">{item.client_name}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {item.betaalfrequentie} · {item.package_type}
                  {item.last_invoice_date !== "-" && ` · Laatste: ${new Date(item.last_invoice_date).toLocaleDateString("nl-NL")}`}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant={item.is_overdue ? "destructive" : "outline"} className="text-xs">
                  {item.is_overdue ? "Achterstallig" : "Deze maand"}
                </Badge>
                <Button size="sm" variant="outline" asChild>
                  <Link to={`/admin/leads/${item.lead_id}`}>
                    <Receipt className="h-3 w-3" />
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

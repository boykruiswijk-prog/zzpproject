import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Receipt, AlertTriangle, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface BillingPeriod {
  lead_id: string;
  client_name: string;
  company_name: string | null;
  package_type: string;
  betaalfrequentie: string;
  period_start: string;
  period_end: string;
  is_overdue: boolean;
  periods_behind: number;
}

export function BillingNotifications() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [generatingKey, setGeneratingKey] = useState<string | null>(null);

  const { data: billingItems, isLoading } = useQuery({
    queryKey: ["billing-notifications"],
    queryFn: async () => {
      const { data: leads, error: leadsError } = await supabase
        .from("leads")
        .select("id, voornaam, achternaam, bedrijfsnaam, verzekering_type, omzet, ingangsdatum, converted_at")
        .eq("status", "klant");

      if (leadsError) throw leadsError;
      if (!leads || leads.length === 0) return [];

      const { data: invoices, error: invError } = await supabase
        .from("invoices")
        .select("lead_id, invoice_date, amount_incl_btw")
        .order("invoice_date", { ascending: false });

      if (invError) throw invError;

      const now = new Date();
      const items: BillingPeriod[] = [];

      for (const lead of leads) {
        const freq = lead.omzet;
        if (!freq) continue;

        const isMonthly = freq === "maandelijks" || freq === "2";
        const leadInvoices = (invoices || []).filter((i) => i.lead_id === lead.id);
        const lastInvoice = leadInvoices[0];

        // Determine the start of coverage: use last invoice date, or ingangsdatum, or converted_at
        let coverageStart: Date;
        if (lastInvoice) {
          coverageStart = new Date(lastInvoice.invoice_date);
        } else if (lead.ingangsdatum) {
          coverageStart = new Date(lead.ingangsdatum);
        } else if (lead.converted_at) {
          coverageStart = new Date(lead.converted_at);
        } else {
          coverageStart = new Date(now);
        }

        // Calculate all missed periods from coverageStart to now
        let periodStart = new Date(coverageStart);
        // If there's a last invoice, the next period starts after that invoice's period
        if (lastInvoice) {
          if (isMonthly) {
            periodStart.setMonth(periodStart.getMonth() + 1);
          } else {
            periodStart.setFullYear(periodStart.getFullYear() + 1);
          }
        }

        let periodIndex = 0;
        while (periodStart <= now) {
          const periodEnd = new Date(periodStart);
          if (isMonthly) {
            periodEnd.setMonth(periodEnd.getMonth() + 1);
          } else {
            periodEnd.setFullYear(periodEnd.getFullYear() + 1);
          }

          const isOverdue = periodEnd < now;

          items.push({
            lead_id: lead.id,
            client_name: `${lead.voornaam} ${lead.achternaam}`,
            company_name: lead.bedrijfsnaam,
            package_type: lead.verzekering_type || "Combi Uitgebreid",
            betaalfrequentie: isMonthly ? "Maandelijks" : "Jaarlijks",
            period_start: periodStart.toISOString().slice(0, 10),
            period_end: periodEnd.toISOString().slice(0, 10),
            is_overdue: isOverdue,
            periods_behind: periodIndex,
          });

          // Move to next period
          periodStart = new Date(periodEnd);
          periodIndex++;

          // Safety limit
          if (periodIndex > 24) break;
        }
      }

      // Sort: overdue first, then by period start
      items.sort((a, b) => {
        if (a.is_overdue && !b.is_overdue) return -1;
        if (!a.is_overdue && b.is_overdue) return 1;
        return new Date(a.period_start).getTime() - new Date(b.period_start).getTime();
      });

      return items;
    },
  });

  const handleQuickInvoice = async (item: BillingPeriod) => {
    const key = `${item.lead_id}-${item.period_start}`;
    setGeneratingKey(key);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-invoice`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            lead_id: item.lead_id,
            invoice_date: item.period_start,
          }),
        }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Fout bij genereren");

      toast({ title: "Factuur aangemaakt!", description: `${result.invoice.invoice_number} — periode ${formatNL(item.period_start)} t/m ${formatNL(item.period_end)}` });

      // Download PDF
      if (result.invoice.pdf_url) {
        try {
          const pdfResponse = await fetch(result.invoice.pdf_url);
          const blob = await pdfResponse.blob();
          const blobUrl = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = blobUrl;
          a.download = `${result.invoice.invoice_number}.pdf`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(blobUrl);
        } catch (e) {
          console.error("Download error:", e);
        }
      }

      queryClient.invalidateQueries({ queryKey: ["billing-notifications"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    } catch (error: any) {
      toast({ title: "Fout", description: error.message, variant: "destructive" });
    } finally {
      setGeneratingKey(null);
    }
  };

  const formatNL = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("nl-NL", { day: "2-digit", month: "short", year: "numeric" });
  };

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
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {billingItems.map((item) => {
            const key = `${item.lead_id}-${item.period_start}`;
            const isGenerating = generatingKey === key;
            return (
              <div
                key={key}
                className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg gap-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {item.is_overdue && <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />}
                    <p className="font-medium text-sm truncate">{item.client_name}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {item.betaalfrequentie} · {item.package_type}
                  </p>
                  <p className="text-xs font-medium mt-0.5">
                    Periode: {formatNL(item.period_start)} — {formatNL(item.period_end)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={item.is_overdue ? "destructive" : "outline"} className="text-xs">
                    {item.is_overdue ? "Achterstallig" : "Deze maand"}
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleQuickInvoice(item)}
                    disabled={isGenerating}
                    title="Factuur aanmaken voor deze periode"
                  >
                    {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Receipt className="h-3 w-3" />}
                  </Button>
                  <Button size="sm" variant="ghost" asChild>
                    <Link to={`/admin/leads/${item.lead_id}`}>
                      Bekijk
                    </Link>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

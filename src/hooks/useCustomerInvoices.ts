import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePortalAuth } from "@/contexts/PortalAuthContext";

export type CustomerInvoice = {
  id: string;
  factuurnummer: string;
  datum: string | null;
  vervaldatum: string | null;
  bedrag: number;
  status: "open" | "betaald" | "vervallen";
  omschrijving: string;
  payment_reference: string | null;
};

export function useCustomerInvoices() {
  const { user, session } = usePortalAuth();
  return useQuery({
    queryKey: ["customer-invoices", user?.id],
    enabled: !!user && !!session,
    staleTime: 60_000,
    queryFn: async (): Promise<CustomerInvoice[]> => {
      const { data, error } = await supabase.functions.invoke("get-customer-invoices");
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      return ((data as { invoices?: CustomerInvoice[] })?.invoices) ?? [];
    },
  });
}

export async function downloadCustomerInvoicePdf(invoiceId: string, factuurnummer: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Niet ingelogd");
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-invoice-pdf`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({ invoice_id: invoiceId }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`PDF-download mislukt (${res.status}): ${text.slice(0, 200)}`);
  }
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = `factuur-${factuurnummer || invoiceId}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
}

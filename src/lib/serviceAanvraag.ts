import { supabase } from "@/integrations/supabase/client";

/**
 * Serviceaanvragen bijwerken uitsluitend via RPC's (supervisor/admin/verzekering met 2FA).
 * Gooit een fout als er niets is bijgewerkt, zodat de UI nooit ten onrechte "bijgewerkt" meldt.
 */
async function roep(fn: string, args: Record<string, unknown>) {
  const { data, error } = await (supabase.rpc as any)(fn, args);
  if (error) throw new Error(error.message || "Bijwerken mislukt");
  if (!data || Number((data as any).bijgewerkt ?? 0) < 1) throw new Error("Er is niets bijgewerkt. Ververs de pagina of vraag een supervisor.");
  return data;
}
export const serviceAanvraagStatus = (id: string, status: string) => roep("service_aanvraag_status", { _id: id, _status: status });
export const serviceAanvraagAfronden = (id: string) => roep("service_aanvraag_afronden", { _id: id });
export const serviceAanvraagNotitie = (id: string, notitie: string) => roep("service_aanvraag_notitie", { _id: id, _notitie: notitie });

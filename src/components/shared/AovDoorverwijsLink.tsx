import { ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AOV_ADVISEUR_URL, AOV_REKENTOOL_URL } from "@/config/aovPagina";
import { aovAnalyticsToestemming, aovBron, aovDoorklik, AovDoel } from "@/lib/aovDoorverwijzing";
import { trackGa } from "@/lib/tracking";

export function AovDoorverwijsLink({ doel, children }: { doel: AovDoel; children: ReactNode }) {
  const cache = useQueryClient();
  const klik = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.type === "auxclick" && e.button !== 1) return;
    e.preventDefault();
    const klik_id = crypto.randomUUID();
    let landing = null;
    try { landing = JSON.parse(sessionStorage.getItem("zp_attributie") || "null"); } catch { /* geen opslag */ }
    const test = !["zpzaken.nl", "www.zpzaken.nl"].includes(window.location.hostname);
    const rij = { klik_id, bron: aovBron(window.location.pathname, landing, test), doel, user_id: null, klant_ref: null };
    aovDoorklik(rij, async (r) => {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user.id ?? null;
      // Alleen al geladen Mijn ZP-polisgegevens, nooit een extra klantquery.
      const polissen = userId ? cache.getQueryData<{ certificate_number?: string | null }[]>(["portal-policies", userId]) : undefined;
      const klantRef = polissen?.find(p => p.certificate_number)?.certificate_number ?? null;
      return supabase.from("aov_doorverwijzingen").insert({ ...r, user_id: userId, klant_ref: klantRef?.slice(0, 100) ?? null });
    }, url => { window.open(url, "_blank", "noopener"); });
    if (aovAnalyticsToestemming()) trackGa("aov_doorverwijzing", { doel });
  };
  return <a href={doel === "rekentool" ? AOV_REKENTOOL_URL : AOV_ADVISEUR_URL} target="_blank" rel="noopener" onClick={klik} onAuxClick={klik}>{children}</a>;
}
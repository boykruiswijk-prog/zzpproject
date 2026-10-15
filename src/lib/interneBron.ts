export { saneerInterneBron } from "../../supabase/functions/_shared/interneBron";
import { saneerInterneBron } from "../../supabase/functions/_shared/interneBron";
export function interneBronUitZoek(zoek: string) {
  return saneerInterneBron(new URLSearchParams(zoek).get("bron"));
}
export function eviLeadLabel(extra: unknown): string | null {
  if (!extra || typeof extra !== "object") return null;
  return (extra as Record<string, unknown>).formulier_naam === "Interesse pensioen via Evi" ? "Pensioen via Evi" : null;
}
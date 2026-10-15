// Vlag in de acceptatie: pure filterlogica (gedeeld met tests) en de twee RPC's.
import { supabase } from "@/integrations/supabase/client";

export type VlagSoort = "later" | "actie";
export type VlagTab = "te_doen" | "gemarkeerd" | "alle";
export type MetVlag = { vlag?: string | null; vlag_datum?: string | null };

export const VLAG_LABEL: Record<VlagSoort, string> = { later: "Later aandacht", actie: "Actie nodig" };

/** Vandaag als jjjj-mm-dd in Nederlandse tijd. */
export function vandaagNL(nu: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam", year: "numeric", month: "2-digit", day: "2-digit" }).format(nu);
}

/** Gevlagd en nog niet aan de beurt (datum in de toekomst, of 'actie' zonder datum). Zelfde regel als SQL lead_vlag_geparkeerd. */
export function isGeparkeerd(l: MetVlag, vandaag: string): boolean {
  return !!l.vlag && (!l.vlag_datum || l.vlag_datum > vandaag);
}

/** Opvolgdatum bereikt: terug in Te doen met "Vandaag opvolgen". */
export function isOpvolgen(l: MetVlag, vandaag: string): boolean {
  return !!l.vlag && !!l.vlag_datum && l.vlag_datum <= vandaag;
}

export function filterOpTab<T extends MetVlag>(leads: T[], tab: VlagTab, vandaag: string): T[] {
  if (tab === "gemarkeerd") return leads.filter((l) => !!l.vlag);
  if (tab === "te_doen") return leads.filter((l) => !isGeparkeerd(l, vandaag));
  return leads;
}

/** Validatie zoals de server: notitie 3-500 tekens, datum verplicht bij 'later'. */
export function vlagFout(soort: VlagSoort | null, notitie: string, datum: string): string | null {
  if (!soort) return "Kies Later aandacht of Actie nodig.";
  const n = notitie.trim().length;
  if (n < 3 || n > 500) return "Notitie is verplicht (3 tot 500 tekens).";
  if (soort === "later" && !datum) return "Kies een opvolgdatum.";
  return null;
}

export async function zetVlag(leadId: string, soort: VlagSoort, notitie: string, datum: string | null) {
  const { error } = await (supabase.rpc as any)("zet_lead_vlag", { _lead_id: leadId, _soort: soort, _notitie: notitie.trim(), _datum: datum || null });
  if (error) throw new Error(error.message);
}

export async function verwijderVlag(leadId: string, toelichting: string) {
  const { error } = await (supabase.rpc as any)("verwijder_lead_vlag", { _lead_id: leadId, _toelichting: toelichting.trim() });
  if (error) throw new Error(error.message);
}

export const datumNL = (d?: string | null) => (d ? d.split("-").reverse().join("-") : "");

/** Doel van de vlag: aanvraag/lead of bestaande klant (onderneming). */
export type VlagDoel = "lead" | "klant";

export async function zetVlagVoor(doel: VlagDoel, id: string, soort: VlagSoort, notitie: string, datum: string | null) {
  if (doel === "lead") return zetVlag(id, soort, notitie, datum);
  const { error } = await (supabase.rpc as any)("zet_klant_vlag", { _onderneming_id: id, _soort: soort, _notitie: notitie.trim(), _datum: datum || null });
  if (error) throw new Error(error.message);
}

export async function verwijderVlagVoor(doel: VlagDoel, id: string, toelichting: string) {
  if (doel === "lead") return verwijderVlag(id, toelichting);
  const { error } = await (supabase.rpc as any)("verwijder_klant_vlag", { _onderneming_id: id, _toelichting: toelichting.trim() });
  if (error) throw new Error(error.message);
}

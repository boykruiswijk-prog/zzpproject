import { isNlTelefoon, normaliseerNlTelefoon } from "../../supabase/functions/_shared/telefoon";
import { kvkFoutmelding } from "@/lib/kvkInvoer";

export const HANDMATIGE_BRONNEN = { telefoon: "Telefoon", mail: "Mail", netwerk: "Netwerk", partner: "Partner", beurs: "Beurs", overig: "Overig" };
export const LEAD_INTERESSES = { bav_avb: "BAV + AVB", cyber: "Cyber", aov: "AOV", overig: "Overig" };
export type HandmatigeLead = { voornaam: string; achternaam: string; bedrijfsnaam: string; kvk: string; email: string; telefoon: string; beroep: string; interesse: string; bron: string; notitie: string; opvolgdatum: string };
export const legeHandmatigeLead: HandmatigeLead = { voornaam: "", achternaam: "", bedrijfsnaam: "", kvk: "", email: "", telefoon: "", beroep: "", interesse: "bav_avb", bron: "telefoon", notitie: "", opvolgdatum: "" };

export function handmatigeLeadFout(g: HandmatigeLead): string | null {
  if (!g.voornaam.trim() || !g.achternaam.trim()) return "Voornaam en achternaam zijn verplicht";
  if (!g.email.trim() && !g.telefoon.trim()) return "Vul minstens e-mail of telefoon in";
  if (g.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(g.email.trim())) return "Vul een geldig e-mailadres in";
  if (g.telefoon.trim() && !isNlTelefoon(g.telefoon)) return "Vul een geldig Nederlands telefoonnummer in";
  if (g.kvk.trim()) { const fout = kvkFoutmelding(g.kvk); if (fout) return fout; }
  if (!(g.bron in HANDMATIGE_BRONNEN) || !(g.interesse in LEAD_INTERESSES)) return "Kies bron en interesse";
  if (g.notitie.length > 2000 || g.beroep.length > 1000) return "Invoer is te lang";
  return null;
}
export function handmatigeLeadGegevens(g: HandmatigeLead) {
  return { ...g, email: g.email.trim().toLowerCase(), telefoon: g.telefoon.trim() ? normaliseerNlTelefoon(g.telefoon) : "", kvk: g.kvk.replace(/\s/g, ""), voornaam: g.voornaam.trim(), achternaam: g.achternaam.trim() };
}

export type LeadVoorinvulling = { voornaam?: string | null; achternaam?: string | null; bedrijfsnaam?: string | null; email?: string | null; telefoon?: string | null; kvk_nummer?: string | null; kvk?: string | null; beroep?: string | null };
/** No PII in a URL, storage or persistent browser state. Used as router state only. */
export function aanvraagVoorinvulling(g: LeadVoorinvulling) {
  return { voornaam: g.voornaam ?? "", achternaam: g.achternaam ?? "", bedrijfsnaam: g.bedrijfsnaam ?? "", email: g.email ?? "", telefoon: g.telefoon ?? "", kvkNummer: g.kvk_nummer ?? g.kvk ?? "", beroep: g.beroep ?? "" };
}
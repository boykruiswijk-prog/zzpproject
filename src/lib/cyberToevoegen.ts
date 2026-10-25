import { beoordeelCyber } from "../../supabase/functions/_shared/cyber";
import { ingangsdatumFout } from "@/lib/ingangsdatum";
/** E-aanvulling 6: alleen Ellen, in de admin, bij een klant met cyber in de oorspronkelijke aanvraag; vroegst de BAV-ingangsdatum. Server: cyber_terugwerkend_vroegst. */
export const CYBER_TERUGWERKEND_EMAIL = "ellen.baars@zpzaken.nl";
export function cyberTerugwerkendVroegst(o: { email: string | null | undefined; team: boolean; cyberInAanvraag: boolean; bavIngang: string | null | undefined }): string | null {
  if (!o.team || !o.cyberInAanvraag || !o.bavIngang) return null;
  if ((o.email ?? "").trim().toLowerCase() !== CYBER_TERUGWERKEND_EMAIL) return null;
  return o.bavIngang.slice(0, 10);
}
export function cyberVerzoekFout(antwoorden: unknown, datum: string, akkoord: boolean, team = false, notitie = "", moment = new Date(), terugwerkendVanaf: string | null = null) {
  if (!beoordeelCyber(antwoorden).toegestaan) return "Beantwoord alle cybervragen en voldoe aan de voorwaarden.";
  if (!datum) return "Kies een gewenste ingangsdatum.";
  const fout = ingangsdatumFout(datum, moment);
  if (fout) {
    if (!team || !terugwerkendVanaf) return fout;
    if (datum < terugwerkendVanaf) return `De ingangsdatum is vroegst de ingangsdatum van de BAV + AVB (${terugwerkendVanaf.split("-").reverse().join("-")}).`;
  }
  if (!akkoord) return "Geef akkoord op de cybervoorwaarden.";
  if (notitie.length > 1000 || (team && notitie.trim().length < 10)) return "Voeg een notitie van 10 tot 1.000 tekens toe.";
  return null;
}
export const CYBER_VERZOEK_STATUS: Record<string, string> = {
  wacht_op_beoordeling: "Wacht op handmatige beoordeling",
  akkoord_wacht_op_activatie: "Akkoord, nog niet actief",
  afgewezen: "Afgewezen",
};
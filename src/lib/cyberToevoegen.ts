import { beoordeelCyber } from "../../supabase/functions/_shared/cyber";
import { ingangsdatumFout } from "@/lib/ingangsdatum";
export function cyberVerzoekFout(antwoorden: unknown, datum: string, akkoord: boolean, team = false, notitie = "", moment = new Date()) {
  if (!beoordeelCyber(antwoorden).toegestaan) return "Beantwoord alle cybervragen en voldoe aan de voorwaarden.";
  if (!datum) return "Kies een gewenste ingangsdatum.";
  const fout = ingangsdatumFout(datum, moment);
  if (fout) return fout;
  if (!akkoord) return "Geef akkoord op de cybervoorwaarden.";
  if (notitie.length > 1000 || (team && notitie.trim().length < 10)) return "Voeg een notitie van 10 tot 1.000 tekens toe.";
  return null;
}
export const CYBER_VERZOEK_STATUS: Record<string, string> = {
  wacht_op_beoordeling: "Wacht op handmatige beoordeling",
  akkoord_wacht_op_activatie: "Akkoord, nog niet actief",
  afgewezen: "Afgewezen",
};
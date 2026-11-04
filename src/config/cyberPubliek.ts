// Boy 4-11 vervangt E4: officiële cybervoorwaarden op de eigen site.
// Aanvraagformulier, edge functions en mails blijven CYBER_POLISVOORWAARDEN uit _shared/cyber.ts gebruiken.
import { CYBER_DEKKING, CYBER_HULP, CYBER_POLISVOORWAARDEN } from "../../supabase/functions/_shared/cyber";
export const CYBER_DEKKING_EN_HULP = `${CYBER_DEKKING}. ${CYBER_HULP}`;
export const CYBER_GEBIED_PUBLIEK = "Cyberdekkingsgebied: Europa.";
export const CYBER_VOORWAARDEN_PAD = "/voorwaarden#cyber";
export const CYBER_VOORWAARDEN_OPVRAGEN = "De cybervoorwaarden vind je op zpzaken.nl/voorwaarden#cyber.";
export const metPubliekeCybertekst = (t: string) => (t === CYBER_POLISVOORWAARDEN ? CYBER_VOORWAARDEN_OPVRAGEN : t);

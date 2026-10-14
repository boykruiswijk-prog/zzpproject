// Publieke cybertekst (besluit E4): de cybervoorwaarden staan niet op de site, bezoekers vragen ze op.
// Aanvraagformulier, edge functions en mails blijven CYBER_POLISVOORWAARDEN uit _shared/cyber.ts gebruiken.
import { CYBER_POLISVOORWAARDEN } from "../../supabase/functions/_shared/cyber";
import { SITE_CONFIG } from "./site";
export const CYBER_VOORWAARDEN_OPVRAGEN = `De cybervoorwaarden vraag je op via ${SITE_CONFIG.phoneDisplay} of via zpzaken.nl/contact.`;
export const metPubliekeCybertekst = (t: string) => (t === CYBER_POLISVOORWAARDEN ? CYBER_VOORWAARDEN_OPVRAGEN : t);

// Teksten voor het aparte cybercertificaat (register E-aanvulling 5/5a, besluit Boy 23-10-2026).
import { COMPANY } from "./company.ts";
import { POLISBLAD_NOTITIE } from "./certificaatRegels.ts";

export const CYBER_CERTIFICAAT_TITEL = "VERZEKERINGSCERTIFICAAT CYBERVERZEKERING";
export const CYBER_CERTIFICAAT_ONDERTITEL = "CYBERVERZEKERING";
export const CYBER_POLISNUMMER = "HCR3202063";
export const CYBER_SOORT = "CyberClear by Hiscox, ZP Zaken Cyber Collectief";
export const CYBER_VERZEKERD_BEDRAG = "EUR 50.000 per schade en per deelnemer (inclusief kosten).";
/** Jaarmaximum voor alle deelnemers samen, zonder "EUR" (bijv. "250.000"). Leeg: generator weigert echte klanten. */
export const CYBER_JAARMAXIMUM = "5.000.000"; // Besluit Boy, register E-aanvulling 5d
/** Echte klantcertificaten pas na goedkeuring voorbeeld door Boy. */
export const CYBERCERTIFICAAT_LIVE = false;
export const CYBER_JAARMAXIMUM_VOORBEELD = "XXX";
export function cyberVerzekerdBedrag(jaarmaximum: string): string {
  return `${CYBER_VERZEKERD_BEDRAG}\nEUR ${jaarmaximum} per verzekeringsjaar voor alle deelnemers samen.`;
}
export const CYBER_EIGEN_RISICO = "EUR 500 per schade, bij cyberfraude EUR 1.000";
export const CYBER_POLISVOORWAARDEN = `CyberClear by Hiscox (HCC-2022/01) en de van toepassing zijnde clausules. De voorwaarden zijn op te vragen via ${COMPANY.phoneDisplay}.`;
export const CYBER_DEKKINGSGEBIED = "Europa";
export const CYBER_MELDING_SCHADE = "Meld een schade of incident zo spoedig als redelijkerwijs mogelijk bij de verzekeraar: Hiscox Nederland (Hiscox incident response team), telefoon +31 (0)20 517 0700, e-mail hiscox.claims@hiscox.nl, Postbus 87033, 1080 JA Amsterdam.";

export function cyberPrioriteiten(polisnummer = CYBER_POLISNUMMER): string {
  return `Dit certificaat is gebaseerd op de polisdocumenten onder ${polisnummer}. Voor zover sprake mocht zijn van tegenstrijdigheden tussen de tekst van dit certificaat en de polisdocumenten, gaan de polisdocumenten voor.`;
}

/** "2026-10-24" -> "24-10-2026" zonder tijdzone-effecten. */
export function korteDatum(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}-${m}-${y}`;
}

/** Einde eerste cyberjaar: ingang + 12 maanden - 1 dag. */
export function cyberEinddatum(ingang: string): string {
  const [y, m, d] = ingang.slice(0, 10).split("-").map(Number);
  const e = new Date(Date.UTC(y + 1, m - 1, d));
  e.setUTCDate(e.getUTCDate() - 1);
  return e.toISOString().slice(0, 10);
}

export function cyberContractduur(ingang: string, eind?: string | null): string {
  return `${korteDatum(ingang)} tot en met ${korteDatum(eind || cyberEinddatum(ingang))}. Daarna stilzwijgend verlengd met 12 maanden. Cyber is dagelijks opzegbaar. Al betaalde premie voor cyber krijg je bij opzeggen niet terug. Cyber is niet pauzeerbaar.`;
}

export type CyberCertificaatInvoer = {
  certificaathouder: string;
  kvk?: string | null;
  verzekeringsnemer: string;
  bav_certificaatnummer: string;
  cyber_ingangsdatum: string;
  cyber_einddatum?: string | null;
  afgiftedatum: string; // ISO
  voor_gezien: string;
  polisnummer?: string;
  /** Alleen voor fictieve voorbeelden; anders CYBER_JAARMAXIMUM. */
  jaarmaximum?: string;
};

export type CyberRij = { label: string; waarde: string; vet?: boolean; notitie?: string };

/** Vaste volgorde van de rijen op het cybercertificaat (afgifte/voor gezien apart, lange datum). */
export function cyberCertificaatRijen(i: CyberCertificaatInvoer): CyberRij[] {
  const polis = i.polisnummer || CYBER_POLISNUMMER;
  const rijen: CyberRij[] = [{ label: "Certificaathouder:", waarde: i.certificaathouder }];
  if (i.kvk?.trim()) rijen.push({ label: "KvK:", waarde: i.kvk.trim() });
  rijen.push(
    { label: "Verzekeringsnemer:", waarde: i.verzekeringsnemer },
    { label: "Bij BAV + AVB-certificaat:", waarde: i.bav_certificaatnummer, vet: true },
    { label: "Soort verzekering:", waarde: CYBER_SOORT },
    { label: "Polisnummer:", waarde: polis },
    { label: "Ingangsdatum:", waarde: korteDatum(i.cyber_ingangsdatum), vet: true },
    { label: "Verzekerd bedrag:", waarde: cyberVerzekerdBedrag(i.jaarmaximum || CYBER_JAARMAXIMUM || CYBER_JAARMAXIMUM_VOORBEELD), notitie: POLISBLAD_NOTITIE },
    { label: "Eigen risico:", waarde: CYBER_EIGEN_RISICO },
    { label: "Polisvoorwaarden:", waarde: CYBER_POLISVOORWAARDEN },
    { label: "Dekkingsgebied:", waarde: CYBER_DEKKINGSGEBIED },
    { label: "Contractduur:", waarde: cyberContractduur(i.cyber_ingangsdatum, i.cyber_einddatum) },
    { label: "Prioriteiten:", waarde: cyberPrioriteiten(polis) },
    { label: "Melding van schade:", waarde: CYBER_MELDING_SCHADE },
  );
  return rijen;
}

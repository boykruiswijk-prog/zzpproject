// Pure versioned cyber rules. Existing leads without this version remain legacy.
import { plusMaanden } from "./starterTarief.ts";
export const CYBER_VERSIE = "2026-10-08";
export const CYBER = { maandprijs: 27.5, jaarprijs: 250, perSchade: 50_000, gedeeldJaarmaximum: 2_500_000, eigenRisico: 500, fraudeEigenRisico: 1000, incident72uur: 15_000 } as const;
export const CYBER_AKKOORD = "Ik begrijp dat de cyberdekking een looptijd heeft van 12 maanden en daarna stilzwijgend met 12 maanden wordt verlengd. De BAV + AVB blijft dagelijks opzegbaar.";
export const CYBER_DEKKING = "Cyber: tot €50.000 per schade, eigen risico €500 (cyberfraude €1.000).";
export const CYBER_HULP = "Directe hulp bij een cyberincident: kosten in de eerste 72 uur tot €15.000, zonder eigen risico.";
export const CYBER_DETAILS = "Het jaarmaximum van €2.500.000 is een gedeelde limiet voor alle deelnemers aan het ZP Zaken Cyber Collectief. Dekkingsgebied: wereld exclusief VS en Canada. Verzekerd via Hiscox (CyberClear, polisvoorwaarden HCC-2022/01).";
export const CYBER_LOOPTIJD = "Cyber heeft een vaste looptijd van 12 maanden en wordt daarna stilzwijgend met 12 maanden verlengd. Opzeggen kan tegen het einde van de looptijd. Cyber is niet dagelijks opzegbaar en niet pauzeerbaar. Bij maandbetaling betaal je het jaarcontract in 12 termijnen van €27,50. Zeg je de BAV + AVB op, dan loopt cyber door tot het einde van het lopende cyberjaar en blijven de resterende cybertermijnen verschuldigd.";
export const CYBER_AFGEWEZEN = "Cyberdekking past op dit moment niet bij jouw situatie. Je BAV + AVB sluit je gewoon af; Ellen neemt contact op over een passende oplossing.";
export const CYBER_VRAGEN = [
  { id: "a", afwijzenBij: true, tekst: "Werk je in een van deze sectoren: financiële instelling, advies of bemiddeling in financiële producten, betalingsverwerking, sociale media/sociale netwerken, kredietbeoordeling (rating), kansspelen, seksbranche, logistiek of opslag/koeriersdienst, gemeente, of lever je diensten als managed service provider (je beheert de IT-omgeving van klanten)?" },
  { id: "b", afwijzenBij: false, tekst: "Heb je een actief antivirusprogramma van een bekende leverancier op al je apparaten (ook Apple)?" },
  { id: "c", afwijzenBij: false, tekst: "Maak je minimaal wekelijks een back-up van je belangrijke gegevens, los van je computer of in de cloud (OneDrive, Google Drive, iCloud e.d.)?" },
  { id: "d", afwijzenBij: false, tekst: "Installeer je updates en patches binnen 30 dagen nadat ze uitkomen?" },
  { id: "e", afwijzenBij: true, tekst: "Gebruik je nog een besturingssysteem dat niet meer wordt ondersteund, zoals Windows 7 of XP?" },
  { id: "f", afwijzenBij: true, tekst: "Haal je meer dan 10% van je omzet uit de VS of Canada, of heb je een vestiging buiten de EER of het VK?" },
] as const;
export type CyberAntwoorden = Partial<Record<(typeof CYBER_VRAGEN)[number]["id"], boolean>>;
export function beoordeelCyber(input: unknown) {
  const bron = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const antwoorden: CyberAntwoorden = {};
  for (const vraag of CYBER_VRAGEN) if (typeof bron[vraag.id] === "boolean") antwoorden[vraag.id] = bron[vraag.id] as boolean;
  const volledig = CYBER_VRAGEN.every((q) => typeof antwoorden[q.id] === "boolean");
  const redenen = CYBER_VRAGEN.filter((q) => antwoorden[q.id] === q.afwijzenBij).map((q) => q.id);
  return { antwoorden, volledig, toegestaan: volledig && redenen.length === 0, redenen };
}
export function isCyberPakket(pakket: string | null | undefined) { return !!pakket && /[-_]cyber$/.test(pakket); }
export function basisPakket(pakket: string) { return pakket.startsWith("maandelijks") ? "maandelijks" : "jaarlijks"; }
export function nieuweCyber(lead: { extra_data?: unknown }) {
  const extra = lead.extra_data as { cyber?: { versie?: string; gekozen?: boolean } } | null;
  return extra?.cyber?.versie === CYBER_VERSIE && extra.cyber.gekozen === true;
}
export function cyberJaarEind(start: string, vandaag = start) {
  let n = 12;
  while (plusMaanden(start, n) <= vandaag) n += 12;
  return new Date(new Date(`${plusMaanden(start, n)}T00:00:00Z`).getTime() - 86400000).toISOString().slice(0, 10);
}
export function cyberPremie(pakket: string) { return pakket.startsWith("maandelijks") ? CYBER.maandprijs : CYBER.jaarprijs; }
export function aanvraagPremie(pakket: string, starter: boolean) {
  const maand = pakket.startsWith("maandelijks");
  const bav = starter ? (maand ? 45 : 495) : (maand ? 55 : 600);
  return { bav, cyber: isCyberPakket(pakket) ? cyberPremie(pakket) : 0, totaal: bav + (isCyberPakket(pakket) ? cyberPremie(pakket) : 0), maand };
}
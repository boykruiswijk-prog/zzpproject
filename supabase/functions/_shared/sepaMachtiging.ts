// SEPA-machtigingstekst — ENIGE definitie van de tekst die de klant ziet en die in het
// bewijsrecord (sepa_machtiging_bewijs.getoonde_tekst) wordt vastgelegd.
//
// BEWUST GEDUPLICEERD: dit bestand staat byte-voor-byte gelijk in
//   - supabase/functions/_shared/sepaMachtiging.ts  (Edge Functions)
//   - src/lib/sepaMachtiging.ts                     (frontend)
// src/test/sepaMachtiging.test.ts bewijst dat beide bestanden identiek zijn.
// Wijzig altijd beide en verhoog MACHTIGING_TEKST_VERSIE bij elke tekstwijziging.
//
// Standaardtekst volgens het model van Betaalvereniging Nederland.
// Geen Deno- of browser-API's in dit bestand: het moet in beide omgevingen draaien.

export const MACHTIGING_TEKST_VERSIE = "2026-09-28.1";

export type MachtigingType = "doorlopend" | "eenmalig";

export interface DebiteurAdres {
  straat: string;
  huisnummer: string;
  postcode: string;
  plaats: string;
  land: string;
}

export interface MachtigingData {
  type: MachtigingType;
  incassantNaam: string;
  incassantAdres: string; // volledig, incl. land
  incassantId: string;
  mandaatkenmerk: string;
  reden: string;
  debiteurNaam: string;
  debiteurAdres: DebiteurAdres;
  iban: string;
}

export const ELEKTRONISCH_ONDERTEKENEN_ZIN =
  "Door het aanvinken van onderstaand vakje en het versturen van dit formulier ondertekent u deze machtiging elektronisch.";

export function machtigingTitel(type: MachtigingType): string {
  return type === "doorlopend" ? "Doorlopende SEPA-machtiging" : "Eenmalige SEPA-machtiging";
}

export function machtigingCheckboxLabel(type: MachtigingType, incassantNaam: string): string {
  return `Ik geef ${incassantNaam} deze ${type === "doorlopend" ? "doorlopende" : "eenmalige"} SEPA-machtiging`;
}

/** Mandaatkenmerk: "ZPZ" + UUID zonder streepjes, hoofdletters (35 tekens). */
export function mandaatkenmerkVoor(uuid: string): string {
  return "ZPZ" + uuid.replace(/-/g, "").toUpperCase();
}

export function isUuid(v: unknown): v is string {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

export function normaliseerIban(raw: string): string {
  return (raw ?? "").replace(/\s/g, "").toUpperCase();
}

/** IBAN in groepen van 4 voor weergave. */
export function formatIban(raw: string): string {
  return normaliseerIban(raw).replace(/(.{4})/g, "$1 ").trim();
}

/** IBAN-validatie: formaat + mod-97. */
export function isValidIban(raw: string): boolean {
  const iban = normaliseerIban(raw);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) return false;
  const herschikt = iban.slice(4) + iban.slice(0, 4);
  const numeriek = herschikt.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let rest = 0;
  for (const cijfer of numeriek) rest = (rest * 10 + Number(cijfer)) % 97;
  return rest === 1;
}

/** Eerste 4 en laatste 4 tekens zichtbaar. */
export function maskeerIban(raw: string): string {
  const iban = normaliseerIban(raw);
  if (iban.length <= 8) return iban;
  return `${iban.slice(0, 4)} **** **** ${iban.slice(-4)}`;
}

export function formatDebiteurAdres(a: DebiteurAdres): string {
  return `${a.straat.trim()} ${a.huisnummer.trim()}, ${a.postcode.trim().toUpperCase()} ${a.plaats.trim()}, ${a.land.trim()}`;
}

// "ZP Zaken B.V." eindigt al op een punt: geen dubbele punt aan het zinseinde.
function metPunt(s: string): string {
  return s.endsWith(".") ? s : `${s}.`;
}

export function standaardtekst(type: MachtigingType, incassantNaam: string): string {
  if (type === "doorlopend") {
    return (
      `Door ondertekening van dit formulier geeft u toestemming aan ${incassantNaam} om doorlopende incasso-opdrachten te sturen naar uw bank om een bedrag van uw rekening af te schrijven en aan uw bank om doorlopend een bedrag van uw rekening af te schrijven overeenkomstig de opdracht van ${metPunt(incassantNaam)} ` +
      "Als u het niet eens bent met deze afschrijving kunt u deze laten terugboeken. Neem hiervoor binnen 8 weken na afschrijving contact op met uw bank. Vraag uw bank naar de voorwaarden."
    );
  }
  return (
    `Door ondertekening van dit formulier geeft u toestemming aan ${incassantNaam} om een eenmalige incasso-opdracht te sturen naar uw bank om een bedrag van uw rekening af te schrijven en aan uw bank om eenmalig een bedrag van uw rekening af te schrijven overeenkomstig de opdracht van ${metPunt(incassantNaam)} ` +
    "Als u het niet eens bent met deze afschrijving kunt u deze laten terugboeken. Neem hiervoor binnen 8 weken na afschrijving contact op met uw bank. Vraag uw bank naar de voorwaarden."
  );
}

/** Velden van de machtiging als [label, waarde]-paren, in vaste volgorde. */
export function machtigingVelden(d: MachtigingData): Array<[string, string]> {
  return [
    ["Naam incassant", d.incassantNaam],
    ["Adres incassant", d.incassantAdres],
    ["Incassant-ID", d.incassantId || "(nog niet bekend)"],
    ["Kenmerk machtiging", d.mandaatkenmerk],
    ["Reden betaling", d.reden],
    ["Naam rekeninghouder", d.debiteurNaam.trim()],
    ["Adres rekeninghouder", formatDebiteurAdres(d.debiteurAdres)],
    ["IBAN", formatIban(d.iban)],
  ];
}

/**
 * De volledige, ingevulde machtigingstekst zoals de klant hem ziet.
 * Server-side opnieuw opgebouwd en gehasht (sha256) in het bewijsrecord.
 */
export function renderMachtigingstekst(d: MachtigingData): string {
  const regels: string[] = [];
  regels.push(machtigingTitel(d.type));
  regels.push("");
  for (const [label, waarde] of machtigingVelden(d)) regels.push(`${label}: ${waarde}`);
  regels.push("");
  regels.push(ELEKTRONISCH_ONDERTEKENEN_ZIN);
  regels.push("");
  regels.push(standaardtekst(d.type, d.incassantNaam));
  regels.push("");
  regels.push(machtigingCheckboxLabel(d.type, d.incassantNaam));
  regels.push("");
  regels.push(`Tekstversie: ${MACHTIGING_TEKST_VERSIE}`);
  return regels.join("\n");
}

/** Pakketnamen screening zoals in de machtiging (reden betaling). Server en frontend gelijk. */
export const SCREENING_PAKKET_LABELS: Record<string, string> = {
  basis: "Basis screening",
  uitgebreid: "Uitgebreide screening",
  compleet: "Complete screening",
};

export function redenBav(): string {
  return "Premie beroeps- en bedrijfsaansprakelijkheidsverzekering";
}

export function redenScreening(pakketNaam: string, bedrag: number): string {
  return `Screening, pakket ${pakketNaam}, € ${bedrag.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

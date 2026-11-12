// Besluit Boy 12-11-2026 11:39 (register D-aanvulling Rechtsvormwijziging 2).
// Zelfservice "Mijn onderneming wijzigt van rechtsvorm": gedeelde, pure regels voor Mijn ZP en de serverfunctie.
import { ingangsdatumFout, plusDagen } from "./ingangsdatum.ts";

export const RECHTSVORMEN = ["Eenmanszaak", "BV"] as const;
export type Rechtsvorm = (typeof RECHTSVORMEN)[number];

export const ERKENNING_TEKST =
  "Wij erkennen je bv als voortzetter van je eenmanszaak. Werk dat je eerder via je eenmanszaak deed, valt zo onder je nieuwe verzekering en er ontstaat geen gat in je dekking.";

// Besluit Boy 12-11-2026 12:11: einddatum oud en ingangsdatum nieuw hoeven niet aan te sluiten en mogen overlappen.
// Gat geeft een waarschuwing, overlap een informatieve melding; geen van beide blokkeert.
export const MELDING_GAT = "Let op: tussen deze datums ben je niet verzekerd";
export const MELDING_OVERLAP = "In deze periode heb je dubbele dekking: je betaalt voor beide ondernemingen.";
export const MELDING_EIND_VOOR_INGANG = "De einddatum van je oude onderneming ligt voor de oorspronkelijke ingangsdatum van je polis.";

export const OVERGANG_TEKST =
  "Je dekking gaat over naar je nieuwe onderneming. Loopt er nog een opdracht via je eenmanszaak (of andersom), dan kan het nodig zijn om een aantal weken of maanden beide verzekeringen naast elkaar te houden. Leidend is je overeenkomst met je opdrachtgever: met welke onderneming heb je die overeenkomst gesloten? Die bepaalt tot wanneer de oude dekking moet lopen en vanaf wanneer de nieuwe begint.";

const DATUM = /^\d{4}-\d{2}-\d{2}$/;

/** Blokkerende datumfouten: einddatum en ingangsdatum verplicht, ingang vroegst morgen (D4), einde niet voor oorspronkelijke ingang. */
export function datumsFout(einddatum: string, ingangsdatum: string, nu: Date | string = new Date(), oorspronkelijkeIngang?: string | null): string | null {
  if (!DATUM.test(einddatum ?? "")) return "Vul de einddatum van je huidige onderneming in.";
  if (!DATUM.test(ingangsdatum ?? "")) return "Vul de ingangsdatum van je nieuwe onderneming in.";
  const vroeg = ingangsdatumFout(ingangsdatum, nu);
  if (vroeg) return vroeg;
  if (oorspronkelijkeIngang && DATUM.test(oorspronkelijkeIngang.slice(0, 10)) && einddatum < oorspronkelijkeIngang.slice(0, 10)) return MELDING_EIND_VOOR_INGANG;
  return null;
}

/** Niet-blokkerende melding: gat (waarschuwing) of overlap (informatie). */
export function datumsMelding(einddatum: string, ingangsdatum: string): { soort: "gat" | "overlap"; tekst: string } | null {
  if (!DATUM.test(einddatum ?? "") || !DATUM.test(ingangsdatum ?? "")) return null;
  if (plusDagen(einddatum, 1) < ingangsdatum) return { soort: "gat", tekst: MELDING_GAT };
  if (ingangsdatum <= einddatum) return { soort: "overlap", tekst: MELDING_OVERLAP };
  return null;
}

/** Laatste dekkingsdag van de oude onderneming: precies de opgegeven einddatum. */
export function laatsteDagOud(einddatum: string): string {
  return einddatum;
}

export function richting(oud: string | null | undefined, nieuw: string): "eenmanszaak_naar_bv" | "bv_naar_eenmanszaak" | "overig" {
  const o = String(oud ?? "").toLowerCase();
  if (nieuw === "BV" && (o === "" || o.includes("eenmans"))) return "eenmanszaak_naar_bv";
  if (nieuw === "Eenmanszaak" && o.includes("bv")) return "bv_naar_eenmanszaak";
  return "overig";
}

export type NieuweOnderneming = { naam: string; kvk: string; rechtsvorm: string; straat: string; huisnummer: string; postcode: string; plaats: string; land: string };

export function nieuweOndernemingFout(n: NieuweOnderneming, oudeKvk?: string | null): string | null {
  if ((n.naam ?? "").trim().length < 2 || n.naam.trim().length > 200) return "Vul de naam van je nieuwe onderneming in.";
  const kvk = (n.kvk ?? "").replace(/\D/g, "");
  if (kvk.length !== 8) return "Vul het KvK-nummer van je nieuwe onderneming in (8 cijfers).";
  if (oudeKvk && kvk === oudeKvk.replace(/\D/g, "")) return "Het KvK-nummer van je nieuwe onderneming is hetzelfde als het oude. Bij een rechtsvormwijziging hoort een nieuw KvK-nummer.";
  if (!(RECHTSVORMEN as readonly string[]).includes(n.rechtsvorm)) return "Kies de rechtsvorm van je nieuwe onderneming.";
  for (const [k, label] of [["straat", "straat"], ["huisnummer", "huisnummer"], ["postcode", "postcode"], ["plaats", "plaats"], ["land", "land"]] as const) {
    const v = String(n[k] ?? "").trim();
    if (!v || v.length > 120) return `Vul de ${label} van je nieuwe onderneming in.`;
  }
  return null;
}

/** Nieuwe zakelijke rekening: nieuwe incassomachtiging is dan verplicht onderdeel van het verzoek. */
export function machtigingFout(m: { nieuweRekening: boolean; ibanGeldig: boolean; rekeninghouder: string; akkoord: boolean }): string | null {
  if (!m.nieuweRekening) return null;
  if (!m.ibanGeldig) return "Vul een geldig IBAN in voor je nieuwe zakelijke rekening.";
  if ((m.rekeninghouder ?? "").trim().length < 2) return "Vul de naam van de rekeninghouder in.";
  if (!m.akkoord) return "Vink het vakje aan om de nieuwe incassomachtiging te geven.";
  return null;
}

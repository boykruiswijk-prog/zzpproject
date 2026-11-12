// Besluit Boy 12-11-2026 11:39 (register D-aanvulling Rechtsvormwijziging 2).
// Zelfservice "Mijn onderneming wijzigt van rechtsvorm": gedeelde, pure regels voor Mijn ZP en de serverfunctie.
import { ingangsdatumFout, plusDagen } from "./ingangsdatum.ts";

export const RECHTSVORMEN = ["Eenmanszaak", "BV"] as const;
export type Rechtsvorm = (typeof RECHTSVORMEN)[number];

export const ERKENNING_TEKST =
  "Wij erkennen je bv als voortzetter van je eenmanszaak. Werk dat je eerder via je eenmanszaak deed, valt zo onder je nieuwe verzekering en er ontstaat geen gat in je dekking.";

export const MELDING_GAT = "Tussen de einddatum en de ingangsdatum zit een gat. Laat de nieuwe onderneming ingaan op de dag na de einddatum.";
export const MELDING_OVERLAP = "De ingangsdatum ligt voor de einddatum. Dan ben je twee keer verzekerd. Laat de nieuwe onderneming ingaan op de dag na de einddatum.";

const DATUM = /^\d{4}-\d{2}-\d{2}$/;

/** Einddatum oud en ingangsdatum nieuw moeten aansluiten: ingang = eind + 1 dag, of gelijk. */
export function datumsFout(einddatum: string, ingangsdatum: string, nu: Date | string = new Date()): string | null {
  if (!DATUM.test(einddatum ?? "")) return "Vul de einddatum van je huidige onderneming in.";
  if (!DATUM.test(ingangsdatum ?? "")) return "Vul de ingangsdatum van je nieuwe onderneming in.";
  const vroeg = ingangsdatumFout(ingangsdatum, nu);
  if (vroeg) return vroeg;
  if (ingangsdatum > plusDagen(einddatum, 1)) return MELDING_GAT;
  if (ingangsdatum < einddatum) return MELDING_OVERLAP;
  return null;
}

/** Laatste dekkingsdag van de oude onderneming: altijd de dag voor de ingangsdatum (geen dubbele dekking of factuur). */
export function laatsteDagOud(ingangsdatum: string): string {
  return plusDagen(ingangsdatum, -1);
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

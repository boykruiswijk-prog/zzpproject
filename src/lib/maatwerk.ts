// Maatwerk-melding (besluit Boy 12-11-2026 12:03). Sectoren: dezelfde als handmatige acceptatie (zorg, bouw & techniek).
import { isHandmatigeAcceptatieSector } from "@/data/sectorVerzekeringskaart";
export { maatwerkMailZin, maatwerkVlag } from "../../supabase/functions/_shared/sectorRegels";

export const MAATWERK_TITEL = "Mogelijk maatwerk";
export const MAATWERK_TEKST = "Werk je in de bouw, techniek of zorg? Dan past jouw situatie mogelijk niet helemaal in ons standaardpakket en kan het om een maatwerkpolis gaan. Rond je aanvraag gewoon af. Wij nemen daarna contact met je op om dit samen te bekijken.";
export const MAATWERK_KNOP = "Begrepen, verder met aanvragen";
export const MAATWERK_LABEL = "Maatwerk: contact opnemen";

export const isMaatwerkSector = (sector: string | null | undefined) => isHandmatigeAcceptatieSector(sector);

/** Popup alleen bij de overgang van geen maatwerk naar maatwerk; wisselen tussen bouw en zorg toont hem niet opnieuw. */
export function moetMaatwerkTonen(vorige: string | null | undefined, nieuwe: string | null | undefined): boolean {
  return isMaatwerkSector(nieuwe) && !isMaatwerkSector(vorige);
}

export function heeftMaatwerkVlag(extraData: unknown): boolean {
  return !!extraData && typeof extraData === "object" && (extraData as Record<string, unknown>).maatwerk_check === true;
}

/** Vooraf ingevulde sector (link of beroepspagina): popup één keer tonen zodra het sectorveld in beeld komt (besluit Boy 12-11). */
export function moetMaatwerkTonenBijVoorinvullen(voorinvulSector: string | null | undefined, huidigeSector: string | null | undefined, alGetoond: boolean): boolean {
  return !alGetoond && !!voorinvulSector && voorinvulSector === huidigeSector && isMaatwerkSector(voorinvulSector);
}

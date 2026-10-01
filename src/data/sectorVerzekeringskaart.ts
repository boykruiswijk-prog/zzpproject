// Enige bron: sector (BAV-AVB-wizard) → verzekeringskaart beroepsaansprakelijkheid.
// Kaartpaden komen uit de branches van de Documenten-pagina (documentenLijst.ts).
import { branches } from "@/data/documentenLijst";

export type BrancheId = "ict" | "management-consultancy" | "pr-marketing" | "coaches" | "zakelijke-dienstverlening";

export const FALLBACK_BRANCHE: BrancheId = "zakelijke-dienstverlening";

export interface Sector {
  id: string;
  label: string;
  branche: BrancheId;
  /** true = geen eigen kaart, valt terug op Overige zakelijke dienstverlening (MPH-2013B). */
  fallback: boolean;
  /** true = buiten standaard Hiscox-propositie: klant sluit normaal af, intern handmatige acceptatie. */
  handmatigeAcceptatie?: boolean;
}

export const WIZARD_SECTOREN: Sector[] = [
  { id: "ict", label: "ICT", branche: "ict", fallback: false },
  { id: "management-consultancy", label: "Management consultancy", branche: "management-consultancy", fallback: false },
  { id: "pr-marketing", label: "Reclame- & marketingbureaus", branche: "pr-marketing", fallback: false },
  { id: "coaches", label: "Coaches", branche: "coaches", fallback: false },
  { id: "zakelijke-dienstverlening", label: "Zakelijke dienstverlening", branche: "zakelijke-dienstverlening", fallback: false },
  // Geen eigen kaart aanwezig in public/documenten → fallback, bewust gemarkeerd.
  { id: "zorg", label: "Zorg", branche: FALLBACK_BRANCHE, fallback: true, handmatigeAcceptatie: true },
  { id: "bouw", label: "Bouw & techniek", branche: FALLBACK_BRANCHE, fallback: true, handmatigeAcceptatie: true },
  { id: "overig", label: "Overig", branche: FALLBACK_BRANCHE, fallback: true },
];

/** Herkent id of label van een sector met handmatige acceptatie (zorg, bouw). */
export function isHandmatigeAcceptatieSector(idOfLabel: string | null | undefined): boolean {
  if (!idOfLabel) return false;
  const v = idOfLabel.trim();
  return WIZARD_SECTOREN.some((s) => s.handmatigeAcceptatie === true && (s.id === v || s.label === v));
}

export interface KaartKeuze {
  sector: Sector;
  brancheNaam: string;
  path: string;
  productCode?: string;
}

export function verzekeringskaartVoorSector(sectorId: string): KaartKeuze | null {
  const sector = WIZARD_SECTOREN.find((s) => s.id === sectorId);
  if (!sector) return null;
  const branche = branches.find((b) => b.id === sector.branche);
  const kaart = branche?.documenten.find((d) => d.type === "verzekeringskaart");
  if (!branche || !kaart) return null;
  return { sector, brancheNaam: branche.naam, path: kaart.path, productCode: kaart.productCode };
}

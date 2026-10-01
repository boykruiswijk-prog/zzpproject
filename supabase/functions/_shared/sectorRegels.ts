// Sectoren die niet direct online afgesloten mogen worden (alleen via offerte).
// Moet gelijk blijven aan WIZARD_SECTOREN[].alleenOfferte in src/data/sectorVerzekeringskaart.ts (test borgt dit).
export const ALLEEN_OFFERTE_SECTOREN: ReadonlyArray<{ id: string; label: string }> = [
  { id: "zorg", label: "Zorg" },
  { id: "bouw", label: "Bouw & techniek" },
];

export function isAlleenOfferteSector(idOfLabel: string | null | undefined): boolean {
  if (!idOfLabel || typeof idOfLabel !== "string") return false;
  const v = idOfLabel.trim();
  return ALLEEN_OFFERTE_SECTOREN.some((s) => s.id === v || s.label === v);
}

export const KLANTMELDING_ALLEEN_OFFERTE =
  "Voor deze sector is direct online afsluiten niet mogelijk. Vraag een vrijblijvende offerte aan via zpzaken.nl/offerte, dan nemen we binnen 24 uur contact met je op.";

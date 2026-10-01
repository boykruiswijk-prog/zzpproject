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

/** Pure check op een process-bav-wizard-body: top-level sector/sector_id en extra_data.sector/sector_id. */
export function bodyIsAlleenOfferte(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const ruw = body as Record<string, unknown>;
  const extra = (ruw.extra_data && typeof ruw.extra_data === "object" ? ruw.extra_data : {}) as Record<string, unknown>;
  return [ruw.sector, ruw.sector_id, extra.sector, extra.sector_id]
    .some((k) => typeof k === "string" && isAlleenOfferteSector(k));
}

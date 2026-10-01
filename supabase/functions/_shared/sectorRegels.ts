// Sectoren buiten de standaard Hiscox-propositie: klant sluit normaal af, intern handmatige acceptatie.
// Moet gelijk blijven aan WIZARD_SECTOREN[].handmatigeAcceptatie in src/data/sectorVerzekeringskaart.ts (test borgt dit).
export const HANDMATIGE_ACCEPTATIE_SECTOREN: ReadonlyArray<{ id: string; label: string }> = [
  { id: "zorg", label: "Zorg" },
  { id: "bouw", label: "Bouw & techniek" },
];

export const HANDMATIGE_ACCEPTATIE_REDEN = "sector_buiten_standaard_propositie";

export function isHandmatigeAcceptatieSector(idOfLabel: string | null | undefined): boolean {
  if (!idOfLabel || typeof idOfLabel !== "string") return false;
  const v = idOfLabel.trim();
  return HANDMATIGE_ACCEPTATIE_SECTOREN.some((s) => s.id === v || s.label === v);
}

/** Pure check op een process-bav-wizard-body: top-level sector/sector_id en extra_data.sector/sector_id. */
export function vereistHandmatigeAcceptatie(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const ruw = body as Record<string, unknown>;
  const extra = (ruw.extra_data && typeof ruw.extra_data === "object" ? ruw.extra_data : {}) as Record<string, unknown>;
  return [ruw.sector, ruw.sector_id, extra.sector, extra.sector_id]
    .some((k) => typeof k === "string" && isHandmatigeAcceptatieSector(k));
}

export function teamWaarschuwingHandmatig(sectorLabel: string): string {
  return `Let op: handmatige acceptatie — sector ${sectorLabel} valt buiten de standaard Hiscox-propositie. Eerst afstemmen voordat je activeert.`;
}

export const MELDING_BEVESTIGING_VEREIST =
  "Deze aanvraag vraagt om handmatige acceptatie (sector buiten de standaard Hiscox-propositie). Vink 'Acceptatie is afgestemd (verzekeraar/klant)' aan voordat je activeert.";

/** Pure activatiecheck: geen markering → ok; markering zonder bevestiging → 409; met bevestiging → ok. */
export function controleerHandmatigeAcceptatie(
  extraData: unknown,
  body: unknown,
): { ok: true; gemarkeerd: boolean } | { ok: false; status: 409; error: string } {
  const extra = (extraData && typeof extraData === "object" ? extraData : {}) as Record<string, unknown>;
  if (!extra.handmatige_acceptatie) return { ok: true, gemarkeerd: false };
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  if (b.handmatige_acceptatie_bevestigd === true) return { ok: true, gemarkeerd: true };
  return { ok: false, status: 409, error: MELDING_BEVESTIGING_VEREIST };
}

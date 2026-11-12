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

// Maatwerk-melding (besluit Boy 12-11-2026 12:03): bouw, techniek of zorg. Zelfde sectoren als handmatige acceptatie.
const MAATWERK_TEKST: Record<string, string> = { zorg: "de zorg", bouw: "de bouw of techniek" };

/** Vlag voor extra_data, door de server afgeleid uit de gekozen sector(en); nooit vertrouwd van de browser. */
export function maatwerkVlag(...sectoren: unknown[]): { maatwerk_check: true; maatwerk_sectoren: string[] } | null {
  const ids = new Set<string>();
  for (const s of sectoren) {
    if (typeof s !== "string") continue;
    const hit = HANDMATIGE_ACCEPTATIE_SECTOREN.find((x) => x.id === s.trim() || x.label === s.trim());
    if (hit) ids.add(hit.label);
  }
  return ids.size ? { maatwerk_check: true, maatwerk_sectoren: [...ids] } : null;
}

/** Eén zin voor de klantbevestiging, alleen als de vlag aan staat. */
export function maatwerkMailZin(extraData: unknown): string | null {
  const e = (extraData && typeof extraData === "object" ? extraData : {}) as Record<string, unknown>;
  if (e.maatwerk_check !== true || !Array.isArray(e.maatwerk_sectoren)) return null;
  const teksten = e.maatwerk_sectoren.map((l) => HANDMATIGE_ACCEPTATIE_SECTOREN.find((x) => x.label === l)?.id).filter((id): id is string => !!id).map((id) => MAATWERK_TEKST[id]);
  if (!teksten.length) return null;
  return `Omdat je actief bent in ${teksten.join(" en ")} nemen wij binnenkort contact met je op over je dekking.`;
}

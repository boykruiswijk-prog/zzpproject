export type AanvragenOpbouw = {
  totaal: number; klant: number; in_behandeling: number; te_beoordelen: number; overig: number;
};
export type InstroomOpbouw = { via_aanvraag: number; voor_6_okt: number; afas_overzetting: number; nog_in_te_gaan: number; overig: number };
export type LeadsOpbouw = { totaal: number; aanvragen: number; contact: number; offerte: number; handmatig?: number };
export function controleerLeadsOpbouw(l: LeadsOpbouw | undefined) {
  if (!l) return;
  const handmatig = l.handmatig ?? 0;
  if (![l.totaal,l.aanvragen,l.contact,l.offerte,handmatig].every(n => Number.isInteger(n) && n >= 0) || l.totaal !== l.aanvragen + l.contact + l.offerte + handmatig) throw new Error("Leadopbouw sluit niet aan op het totaal");
}

/** Fail loudly through the existing dashboard error or screen stale-cache path. */
export function controleerDashboardOpbouw(a: AanvragenOpbouw | undefined, doel: number | undefined) {
  if (!a) return; // Older cached payloads predate this additive field.
  const waarden = [a.totaal, a.klant, a.in_behandeling, a.te_beoordelen, a.overig];
  if (!waarden.every(n => Number.isInteger(n) && n >= 0) || a.totaal !== doel ||
    a.totaal !== a.klant + a.in_behandeling + a.te_beoordelen + a.overig) {
    throw new Error("Aanvraagopbouw sluit niet aan op het doelaantal");
  }
}

export function conversieAanvragen(a: AanvragenOpbouw | undefined) {
  return a && a.totaal > 0 ? Math.round(a.klant / a.totaal * 1000) / 10 : 0;
}
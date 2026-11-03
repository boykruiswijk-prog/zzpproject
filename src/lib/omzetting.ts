// Pure regels voor omzetting en het afronden van een aanvraag (gedeeld met tests; server hanteert dezelfde grenzen).

/** Invoer "Omzetten naar BV": onderneming, datum en toelichting van minstens 10 tekens. */
export function omzettenInvoerFout(i: { naarId: string | null; datum: string; reden: string }): string | null {
  if (!i.naarId) return "Kies de nieuwe onderneming.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(i.datum)) return "Kies de ingangsdatum van de BV.";
  if (i.reden.trim().length < 10) return "Toelichting is verplicht (minimaal 10 tekens).";
  return null;
}

export type AanvraagStap = { sleutel: string; label: string; automatisch: string; klaar: boolean; op?: string | null };

/** Een aanvraag is pas afgerond als het certificaat verstuurd is, of na een handmatige keuze met reden. */
export function aanvraagAfgerond(l: { aanvraag_afgerond_op?: string | null }): boolean {
  return !!l.aanvraag_afgerond_op;
}

/** Handmatig afronden: reden van minstens 10 tekens. */
export function handmatigAfrondenFout(reden: string): string | null {
  return reden.trim().length < 10 ? "Geef een reden (minimaal 10 tekens)." : null;
}

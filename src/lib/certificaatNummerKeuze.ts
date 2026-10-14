// A14: nooit stil een nieuw nummer. Pure keuzelogica voor de dialoog "Nummer bevestigen en certificaat maken".

export const NUMMER_ROLLEN = ["admin", "supervisor", "verzekering"] as const;
export function magNummerWijzigen(rol: string | null | undefined): boolean {
  return !!rol && (NUMMER_ROLLEN as readonly string[]).includes(rol);
}

/** Zelfde normalisatie en formaat als bav_nummer_handmatig_bevestigen. */
export function normaliseerNummer(n: string): string {
  return (n ?? "").trim().replace(/\s+/g, "").toUpperCase();
}
export function geldigNummer(n: string): boolean {
  const x = normaliseerNummer(n);
  return x.length >= 3 && /^[A-Z0-9.\-/]+$/.test(x);
}

export type Voorstel = { nummer: string | null; bron: string; onderneming_id?: string | null; staat_al_op_policy?: boolean };
export type NummerKeuze =
  | { soort: "bekend"; nummer: string }          // bekend nummer van de klant, server kiest hetzelfde
  | { soort: "klantopgave"; nummer: string }     // opgave klant: eerst bav_nummer_bevestigen
  | { soort: "nieuw"; nummer: string }           // eerstvolgend vrij nummer: 'NIEUW' + bevestig_nieuw_nummer
  | { soort: "eigen"; nummer: string }           // getypt: eerst bav_nummer_handmatig_bevestigen
  | { soort: "ongeldig"; nummer: string };

export function bepaalKeuze(invoer: string, ctx: { voorstel: Voorstel | null; klantopgave: string | null; voorbeeld: string | null }): NummerKeuze {
  const n = normaliseerNummer(invoer);
  if (!geldigNummer(n)) return { soort: "ongeldig", nummer: n };
  if (ctx.voorstel?.nummer && normaliseerNummer(ctx.voorstel.nummer) === n) return { soort: "bekend", nummer: n };
  if (ctx.klantopgave && normaliseerNummer(ctx.klantopgave) === n) return { soort: "klantopgave", nummer: n };
  if (!ctx.voorstel?.nummer && ctx.voorbeeld && normaliseerNummer(ctx.voorbeeld) === n) return { soort: "nieuw", nummer: n };
  return { soort: "eigen", nummer: n };
}

/** Startwaarde van het invoerveld en de brontekst. */
export function startVoorstel(ctx: { voorstel: Voorstel | null; klantopgave: string | null; voorbeeld: string | null }): { nummer: string; bron: string } {
  if (ctx.voorstel?.nummer) return { nummer: ctx.voorstel.nummer, bron: ctx.voorstel.bron };
  if (ctx.klantopgave) return { nummer: normaliseerNummer(ctx.klantopgave), bron: "klantopgave" };
  return { nummer: ctx.voorbeeld ?? "", bron: "nieuw" };
}

/** Toelichting verplicht (min. 3) bij een eigen getypt nummer of klantopgave. */
export function magBevestigen(k: NummerKeuze, toelichting: string): boolean {
  if (k.soort === "ongeldig") return false;
  if (k.soort === "eigen") return toelichting.trim().length >= 3;
  return true;
}

/** Gelijktijdigheid: is er intussen een ander nieuw nummer uitgegeven dan het voorbeeld? */
export function afwijkingNieuwNummer(voorbeeld: string | null, echt: string | null): string | null {
  if (!voorbeeld || !echt) return null;
  return normaliseerNummer(voorbeeld) === normaliseerNummer(echt) ? null
    : `Let op: uitgegeven nummer is ${echt} (${voorbeeld} was intussen al vergeven).`;
}

export function magNummerOpslaan(nummer: string, huidig: string, reden: string): boolean {
  return geldigNummer(nummer) && normaliseerNummer(nummer) !== normaliseerNummer(huidig) && reden.trim().length >= 10;
}

export const BRON_TEKST: Record<string, string> = {
  overgenomen: "overgenomen bij omzetting",
  bevestigd: "bevestigd door team",
  klant_certificaat: "bekend certificaat van de klant",
  eerdere_policy: "eerder certificaat van deze klant",
  eerdere_policy_ingetrokken: "eerder certificaat (ingetrokken)",
  klantopgave: "opgegeven door klant, wordt bij bevestigen vastgelegd",
  nieuw: "nieuw nummer (eerstvolgend vrij)",
};

/**
 * AFGELEIDE BEREKENING — bij welke winst betaal je nul inkomstenbelasting?
 *
 * Bevat geen eigen bedragen of percentages: alles komt uit
 * src/data/fiscaleCijfers.ts en de heffingskortingstabellen daar. Wijzigt een
 * cijfer, dan wijzigt de uitkomst automatisch mee — ook in artikelteksten, via
 * de afgeleide tokens in src/lib/fiscaleTokens.ts.
 *
 * Aannames (moeten in elk artikel zichtbaar worden genoemd):
 *  - geen fiscale partner
 *  - de AOW-leeftijd is nog niet bereikt
 *  - er is voldaan aan het urencriterium
 *  - alleen de standaard ondernemersaftrek (zelfstandigenaftrek, geen startersaftrek)
 *  - geen andere inkomsten, aftrekposten of kortingen
 */

import {
  berekenAlgemeneHeffingskorting,
  berekenArbeidskorting,
  fiscaleCijfers,
} from "./fiscaleCijfers";

export interface NulgrensStap {
  winst: number;
  ondernemersaftrek: number;
  winstNaOndernemersaftrek: number;
  mkbVrijstellingBedrag: number;
  belastbaarInkomen: number;
  belastingSchijf1: number;
  algemeneHeffingskorting: number;
  arbeidskorting: number;
  teBetalen: number;
}

/** Rekent de volledige keten door voor een gegeven winst. */
export function berekenInkomstenbelastingUitWinst(winst: number): NulgrensStap {
  const ondernemersaftrek = Math.min(winst, fiscaleCijfers.zelfstandigenaftrek.waarde);
  const winstNaOndernemersaftrek = Math.max(0, winst - ondernemersaftrek);
  const mkbVrijstellingBedrag =
    winstNaOndernemersaftrek * (fiscaleCijfers.mkbWinstvrijstelling.waarde / 100);
  const belastbaarInkomen = Math.round(winstNaOndernemersaftrek - mkbVrijstellingBedrag);

  // Tot de nulgrens blijft het inkomen ruim onder de grens van de eerste schijf,
  // dus rekenen we met het tarief van schijf 1.
  const belastingSchijf1 = Math.round(
    Math.min(belastbaarInkomen, fiscaleCijfers.schijf1Grens.waarde) *
      (fiscaleCijfers.schijf1Tarief.waarde / 100),
  );

  const algemeneHeffingskorting = berekenAlgemeneHeffingskorting(belastbaarInkomen);
  const arbeidskorting = berekenArbeidskorting(belastbaarInkomen);

  return {
    winst,
    ondernemersaftrek,
    winstNaOndernemersaftrek,
    mkbVrijstellingBedrag: Math.round(mkbVrijstellingBedrag),
    belastbaarInkomen,
    belastingSchijf1,
    algemeneHeffingskorting,
    arbeidskorting,
    teBetalen: Math.max(0, belastingSchijf1 - algemeneHeffingskorting - arbeidskorting),
  };
}

/** Hoogste winst waarbij er na de heffingskortingen niets te betalen blijft. */
export function berekenNulgrens(): NulgrensStap {
  let laatsteNul = berekenInkomstenbelastingUitWinst(0);
  for (let winst = 0; winst <= 200_000; winst++) {
    const stap = berekenInkomstenbelastingUitWinst(winst);
    if (stap.teBetalen > 0) break;
    laatsteNul = stap;
  }
  return laatsteNul;
}

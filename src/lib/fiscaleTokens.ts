/**
 * Tokenvervanging voor fiscale cijfers in artikelcontent.
 *
 * Tokenvorm (zie ook de documentatie boven src/data/fiscaleCijfers.ts):
 *   {{fiscaal:<sleutel>}}          waarde + belastingjaar
 *   {{fiscaal:<sleutel>:waarde}}   alleen de waarde
 *   {{fiscaal:<sleutel>:jaar}}     alleen het belastingjaar
 *   {{fiscaal:<sleutel>:label}}    het label
 *   {{fiscaal:<sleutel>:volledig}} label, waarde en jaar
 *   {{fiscaal:<sleutel>:bron}}     markdown-link naar de officiele bron
 *   {{fiscaal:<sleutel>:2025}}     waarde van een specifiek jaar
 *   {{fiscaal:<sleutel>:euro}}     alleen de waarde als lopende tekst ("1.200 euro")
 *   {{fiscaal:<sleutel>:2027_euro}} waarde van een jaar als lopende tekst, zonder jaartal
 *
 * Onbekende sleutels of varianten blijven letterlijk staan; zo valt een
 * typefout op in de verouderingscheck en wordt niets stil verkeerd getoond.
 */

import {
  formatFiscaleWaarde,
  getFiscaalCijfer,
  getFiscaleWaardeVoorJaar,
} from "../data/fiscaleCijfers";
import { berekenNulgrens } from "../data/nulgrensBerekening";

/** Matcht {{fiscaal:sleutel}} en {{fiscaal:sleutel:variant}}. */
export const FISCAAL_TOKEN_REGEX = /\{\{\s*fiscaal:([a-zA-Z0-9_]+)(?::([a-zA-Z0-9_]+))?\s*\}\}/g;

/**
 * AFGELEIDE TOKENS — uitkomsten die volledig uit fiscaleCijfers.ts volgen.
 * Zo staat er ook voor een berekende uitkomst nooit een vast getal in een
 * artikel. Zie src/data/nulgrensBerekening.ts voor de aannames.
 */
function afgeleideWaarden(): Record<string, number> {
  const n = berekenNulgrens();
  return {
    nulgrensWinst: n.winst,
    nulgrensOndernemersaftrek: n.ondernemersaftrek,
    nulgrensWinstNaOndernemersaftrek: n.winstNaOndernemersaftrek,
    nulgrensMkbVrijstelling: n.mkbVrijstellingBedrag,
    nulgrensBelastbaarInkomen: n.belastbaarInkomen,
    nulgrensBelastingSchijf1: n.belastingSchijf1,
    nulgrensAlgemeneHeffingskorting: n.algemeneHeffingskorting,
    nulgrensArbeidskorting: n.arbeidskorting,
    nulgrensTeBetalen: n.teBetalen,
  };
}

/** Bedrag als lopende tekst, bijvoorbeeld "1.200 euro". */
function euroTekst(waarde: number): string {
  return `${waarde.toLocaleString("nl-NL", { maximumFractionDigits: 2 })} euro`;
}

export function resolveFiscaalToken(sleutel: string, variant?: string): string | null {
  const afgeleid = afgeleideWaarden()[sleutel];
  if (afgeleid !== undefined) {
    // Afgeleide tokens kennen alleen een bedrag; varianten zijn niet van toepassing.
    return formatFiscaleWaarde(Math.round(afgeleid), "euro");
  }

  const cijfer = getFiscaalCijfer(sleutel);
  if (!cijfer) return null;

  const waardeTekst = formatFiscaleWaarde(cijfer.waarde, cijfer.eenheid);

  if (!variant) return `${waardeTekst} (${cijfer.belastingjaar})`;

  switch (variant) {
    case "waarde":
      return waardeTekst;
    case "euro":
      return cijfer.eenheid === "euro" ? euroTekst(cijfer.waarde) : null;
    case "jaar":
      return String(cijfer.belastingjaar);
    case "label":
      return cijfer.label;
    case "volledig":
      return `${cijfer.label}: ${waardeTekst} (${cijfer.belastingjaar})`;
    case "bron":
      return `[${cijfer.bron.naam}](${cijfer.bron.url})`;
    default: {
      const tekstJaar = /^(\d{4})_euro$/.exec(variant);
      if (tekstJaar) {
        const w = getFiscaleWaardeVoorJaar(sleutel, Number(tekstJaar[1]));
        return w && w.eenheid === "euro" ? euroTekst(w.waarde) : null;
      }
      const jaar = Number(variant);
      if (!Number.isInteger(jaar)) return null;
      const historisch = getFiscaleWaardeVoorJaar(sleutel, jaar);
      if (!historisch) return null;
      return `${formatFiscaleWaarde(historisch.waarde, historisch.eenheid)} (${jaar})`;
    }
  }
}

/** Vervangt alle fiscale tokens in een tekst door de actuele waarden. */
export function resolveFiscaleTokens(text: string | null | undefined): string {
  if (!text) return "";
  return text.replace(FISCAAL_TOKEN_REGEX, (match, sleutel: string, variant?: string) => {
    const resolved = resolveFiscaalToken(sleutel, variant);
    return resolved ?? match;
  });
}

/** Alle tokens in een tekst, met de melding of ze oplosbaar zijn. */
export function vindFiscaleTokens(
  text: string | null | undefined,
): Array<{ token: string; sleutel: string; variant?: string; oplosbaar: boolean }> {
  if (!text) return [];
  const found: Array<{ token: string; sleutel: string; variant?: string; oplosbaar: boolean }> = [];
  for (const m of text.matchAll(FISCAAL_TOKEN_REGEX)) {
    const sleutel = m[1];
    const variant = m[2];
    found.push({
      token: m[0],
      sleutel,
      variant,
      oplosbaar: resolveFiscaalToken(sleutel, variant) !== null,
    });
  }
  return found;
}

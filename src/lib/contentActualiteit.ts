/**
 * Verouderingscheck voor kennisbankartikelen.
 *
 * Puur signalerend: dit bestand wijzigt nooit content. Het levert per artikel
 * een lijst signalen die een redacteur moet nalopen, met een geverifieerde bron.
 *
 * Gecontroleerd wordt:
 *  1. genoemde jaartallen van 2019 t/m het vorige belastingjaar
 *  2. euro-bedragen die niet via een fiscaal token lopen
 *  3. verwijzingen naar regelingen die zijn gewijzigd of vervallen
 *  4. de datum van de laatste inhoudelijke controle (content_reviewed_at)
 */

import { HUIDIG_BELASTINGJAAR } from "@/data/fiscaleCijfers";
import { FISCAAL_TOKEN_REGEX, vindFiscaleTokens } from "@/lib/fiscaleTokens";

export const EERSTE_CONTROLEJAAR = 2019;
/** Jaartallen t/m dit jaar zijn verdacht (het vorige belastingjaar en ouder). */
export const LAATSTE_VERDACHTE_JAAR = HUIDIG_BELASTINGJAAR - 1;

export type SignaalType = "jaartal" | "bedrag" | "regeling" | "controledatum" | "token";

export interface Signaal {
  type: SignaalType;
  omschrijving: string;
  /** Letterlijke tekstfragmenten uit het artikel. */
  voorbeelden: string[];
  aantal: number;
}

export interface RegelingRegel {
  /** Zoekterm (case-insensitive, hele woorden waar mogelijk). */
  patroon: RegExp;
  naam: string;
  toelichting: string;
}

/**
 * Regelingen die zijn gewijzigd of vervallen. Uitbreiden mag alleen met een
 * officiele bron (belastingdienst.nl, rijksoverheid.nl of de Staatscourant).
 */
export const GEWIJZIGDE_REGELINGEN: RegelingRegel[] = [
  {
    patroon: /\bfiscale oudedagsreserve\b|\boudedagsreserve\b|\bFOR\b/,
    naam: "Fiscale oudedagsreserve (FOR)",
    toelichting: "Opbouw is vervallen per 1 januari 2023; alleen afbouw van bestaande reserve.",
  },
  {
    patroon: /\bmiddelingsregeling\b/,
    naam: "Middelingsregeling",
    toelichting: "Afgeschaft; laatste tijdvak betrof 2022-2024.",
  },
  {
    patroon: /\bVAR\b|\bverklaring arbeidsrelatie\b/,
    naam: "VAR (Verklaring arbeidsrelatie)",
    toelichting: "Vervallen sinds de Wet DBA (2016).",
  },
  {
    patroon: /\bhandhavingsmoratorium\b|\bhandhavingsmoratorium wet dba\b/,
    naam: "Handhavingsmoratorium Wet DBA",
    toelichting: "Opgeheven per 1 januari 2025; volledige handhaving door de Belastingdienst.",
  },
  {
    patroon: /\bWet VBAR\b|\bVBAR\b/,
    naam: "Wet VBAR",
    toelichting: "Wetstraject loopt; controleer de actuele status en beoogde inwerkingtreding.",
  },
  {
    patroon: /\bTOZO\b|\bNOW\b|\bTVL\b|\bcoronasteun\b|\bcorona-?steun\b/,
    naam: "Coronasteunmaatregelen",
    toelichting: "Vervallen regelingen; alleen nog relevant als historische context.",
  },
  {
    patroon: /\bkleineondernemersregeling\b|\bKOR\b/,
    naam: "Kleineondernemersregeling (KOR)",
    toelichting: "Gewijzigd per 2025 (EU-KOR, aanmelding en beëindiging); controleer de tekst.",
  },
  {
    patroon: /\bzelfstandigenaftrek\b/,
    naam: "Zelfstandigenaftrek",
    toelichting: "Wordt jaarlijks afgebouwd; bedrag moet via een fiscaal token lopen.",
  },
  {
    patroon: /\bwet toekomst pensioenen\b|\bWtp\b/,
    naam: "Wet toekomst pensioenen",
    toelichting: "Overgangstermijnen lopen tot 2028; controleer genoemde data.",
  },
  {
    patroon: /\bjaarruimte\b|\breserveringsruimte\b/,
    naam: "Jaarruimte / reserveringsruimte lijfrente",
    toelichting: "Percentages en maxima zijn per 2023 verruimd en wijzigen jaarlijks.",
  },
  {
    patroon: /\bzelfstandigenwet\b|\bwet basisverzekering arbeidsongeschiktheid\b|\bBAZ\b/,
    naam: "Basisverzekering arbeidsongeschiktheid zelfstandigen (BAZ)",
    toelichting: "Wetsvoorstel in behandeling; controleer de actuele stand.",
  },
];

/** Euro-bedragen: € 1.200, 1.200 euro, EUR 1.200,50 */
const EURO_REGEX = /(?:€\s?\d[\d.,]*|\bEUR\s?\d[\d.,]*|\b\d[\d.,]*\s?euro\b)/gi;

function jaartalRegex(): RegExp {
  return /\b(20(?:1[9]|2[0-9]))\b/g;
}

function uniek(values: string[], max = 8): string[] {
  return Array.from(new Set(values)).slice(0, max);
}

export interface ArtikelVoorControle {
  id: string;
  slug: string;
  title: string;
  category: string;
  is_published: boolean;
  content: string | null;
  excerpt: string | null;
  published_at: string | null;
  updated_at: string | null;
  content_reviewed_at: string | null;
}

export interface ControleResultaat {
  artikel: ArtikelVoorControle;
  signalen: Signaal[];
  /** Totaal aantal signalen; bepaalt de sorteervolgorde. */
  score: number;
  /** Datum laatste inhoudelijke controle, of null. */
  laatsteInhoudelijkeControle: string | null;
}

export function controleerArtikel(artikel: ArtikelVoorControle): ControleResultaat {
  const tekst = `${artikel.title}\n\n${artikel.excerpt ?? ""}\n\n${artikel.content ?? ""}`;
  const signalen: Signaal[] = [];

  // 1. Verdachte jaartallen.
  const jaartallen: string[] = [];
  for (const m of tekst.matchAll(jaartalRegex())) {
    const jaar = Number(m[1]);
    if (jaar >= EERSTE_CONTROLEJAAR && jaar <= LAATSTE_VERDACHTE_JAAR) jaartallen.push(m[1]);
  }
  if (jaartallen.length) {
    signalen.push({
      type: "jaartal",
      omschrijving: `Jaartallen ${EERSTE_CONTROLEJAAR}–${LAATSTE_VERDACHTE_JAAR} in de tekst`,
      voorbeelden: uniek(jaartallen).sort(),
      aantal: jaartallen.length,
    });
  }

  // 2. Euro-bedragen buiten tokens: eerst tokens weghalen, dan zoeken.
  const zonderTokens = tekst.replace(FISCAAL_TOKEN_REGEX, " ");
  const bedragen = Array.from(zonderTokens.matchAll(EURO_REGEX)).map((m) => m[0].trim());
  if (bedragen.length) {
    signalen.push({
      type: "bedrag",
      omschrijving: "Euro-bedragen die niet via een fiscaal token lopen",
      voorbeelden: uniek(bedragen),
      aantal: bedragen.length,
    });
  }

  // 3. Gewijzigde of vervallen regelingen.
  const regelingen: string[] = [];
  for (const regel of GEWIJZIGDE_REGELINGEN) {
    const re = new RegExp(regel.patroon.source, "gi");
    if (re.test(tekst)) regelingen.push(`${regel.naam} — ${regel.toelichting}`);
  }
  if (regelingen.length) {
    signalen.push({
      type: "regeling",
      omschrijving: "Verwijzingen naar gewijzigde of vervallen regelingen",
      voorbeelden: regelingen,
      aantal: regelingen.length,
    });
  }

  // 4. Onbekende tokens (typefouten) melden.
  const kapotteTokens = vindFiscaleTokens(tekst).filter((t) => !t.oplosbaar);
  if (kapotteTokens.length) {
    signalen.push({
      type: "token",
      omschrijving: "Fiscale tokens die niet oplosbaar zijn (onbekende sleutel of variant)",
      voorbeelden: uniek(kapotteTokens.map((t) => t.token)),
      aantal: kapotteTokens.length,
    });
  }

  // 5. Inhoudelijke controledatum.
  if (!artikel.content_reviewed_at) {
    signalen.push({
      type: "controledatum",
      omschrijving: "Nooit inhoudelijk gecontroleerd (geen controledatum vastgelegd)",
      voorbeelden: [],
      aantal: 1,
    });
  } else {
    const maanden =
      (Date.now() - new Date(artikel.content_reviewed_at).getTime()) / (1000 * 60 * 60 * 24 * 30.44);
    if (maanden > 12) {
      signalen.push({
        type: "controledatum",
        omschrijving: `Laatste inhoudelijke controle langer dan een jaar geleden (${Math.round(maanden)} maanden)`,
        voorbeelden: [],
        aantal: 1,
      });
    }
  }

  return {
    artikel,
    signalen,
    score: signalen.reduce((sum, s) => sum + s.aantal, 0),
    laatsteInhoudelijkeControle: artikel.content_reviewed_at,
  };
}

/** Alle artikelen gecontroleerd, gesorteerd op meeste signalen eerst. */
export function controleerArtikelen(artikelen: ArtikelVoorControle[]): ControleResultaat[] {
  return artikelen
    .map(controleerArtikel)
    .sort((a, b) => b.score - a.score || b.signalen.length - a.signalen.length);
}

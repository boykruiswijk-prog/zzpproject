/**
 * FISCALE CIJFERS — ENIGE BRON VAN WAARHEID
 * =========================================
 *
 * Alle fiscale bedragen en percentages die op de site of in artikelen worden
 * genoemd staan hier. Nergens anders in de codebase mogen deze bedragen
 * hardcoded staan.
 *
 * WIJZIGEN MAG UITSLUITEND OP BASIS VAN EEN OFFICIELE BRON:
 *   - belastingdienst.nl
 *   - rijksoverheid.nl
 *   - de Staatscourant (officielebekendmakingen.nl)
 * Schrijf bij elke wijziging de bron-URL mee in het `bron`-veld en werk
 * `belastingjaar` bij. Geen bron = geen wijziging.
 *
 * GEBRUIK IN ARTIKELTEKST — TOKENS
 * --------------------------------
 * Zet in de markdown-content van een artikel nooit een los bedrag, maar een
 * token. Bij het renderen wordt het token vervangen door de actuele waarde uit
 * dit bestand, inclusief belastingjaar. Tokenvorm:
 *
 *   {{fiscaal:<sleutel>}}            → waarde + jaar, bijv. "€ 1.200 (2026)"
 *   {{fiscaal:<sleutel>:waarde}}     → alleen de waarde, bijv. "€ 1.200"
 *   {{fiscaal:<sleutel>:jaar}}       → alleen het belastingjaar, bijv. "2026"
 *   {{fiscaal:<sleutel>:label}}      → het label, bijv. "Zelfstandigenaftrek"
 *   {{fiscaal:<sleutel>:volledig}}   → label, waarde en jaar
 *   {{fiscaal:<sleutel>:bron}}       → markdown-link naar de officiele bron
 *   {{fiscaal:<sleutel>:2025}}       → historische waarde van dat jaar
 *
 * Voorbeeld: "De zelfstandigenaftrek bedraagt {{fiscaal:zelfstandigenaftrek}}."
 * Onbekende sleutels blijven ongewijzigd staan, zodat een typefout opvalt in de
 * verouderingscheck in de admin en niet stil verkeerd wordt weergegeven.
 */

export type FiscaalEenheid = "euro" | "procent" | "uren";

export interface FiscaleBron {
  naam: string;
  url: string;
}

export interface FiscaalCijfer {
  /** Belastingjaar waarop `waarde` betrekking heeft. */
  belastingjaar: number;
  waarde: number;
  eenheid: FiscaalEenheid;
  label: string;
  /** Korte toelichting op de toepassing; optioneel. */
  toelichting?: string;
  /** Voorbehouden: tijdelijke besluiten, nog te bekrachtigen wetgeving, uitvoeringsbeperkingen. */
  voorbehoud?: readonly string[];
  bron: FiscaleBron;
  /** Waarden van andere jaren, voor context in artikelen. */
  historie?: Record<number, number>;
  /** Officieel aangekondigde, nog niet geldende waarden. */
  aangekondigd?: Record<number, number>;
}

/** Het belastingjaar waarop de actuele cijfers betrekking hebben. */
export const HUIDIG_BELASTINGJAAR = 2026;

const BRON_BELASTINGDIENST_ONDERNEMERSAFTREK: FiscaleBron = {
  naam: "Belastingdienst — ondernemersaftrek",
  url: "https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/zakelijk/winst/inkomstenbelasting/inkomstenbelasting_voor_ondernemers/ondernemersaftrek/",
};

const BRON_BELASTINGDIENST_ZVW: FiscaleBron = {
  naam: "Belastingdienst — percentages inkomensafhankelijke bijdrage Zvw",
  url: "https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/zakelijk/personeel_en_loon/loonheffingen_berekenen/inkomensafhankelijke_bijdrage_zvw/",
};

const BRON_STAATSCOURANT_BIJDRAGE_INKOMEN: FiscaleBron = {
  naam: "Regeling van 3 november 2025, Staatscourant 2025, nr. 38055 (ministerie van VWS)",
  url: "https://zoek.officielebekendmakingen.nl/stcrt-2025-38055.html",
};

const BRON_BELEIDSBESLUIT_KILOMETERS_2026: FiscaleBron = {
  naam:
    "Beleidsbesluit van de staatssecretaris van Financien, Staatscourant mei 2026, vooruitlopend op het Belastingplan 2027",
  url: "https://www.officielebekendmakingen.nl/staatscourant",
};

const BRON_BELASTINGDIENST_KILOMETERVERGOEDING: FiscaleBron = {
  naam:
    "Belastingdienst — nieuwsbericht 25 juni 2026 over de verhoging van de onbelaste kilometervergoeding, en tabel 13 van 'Tarieven, bedragen en percentages loonheffingen vanaf 1 januari 2026' (vierde uitgave)",
  url: "https://www.belastingdienst.nl/wps/wcm/connect/nl/loonheffingen/",
};

/** Voorbehoud dat geldt voor beide kilometerbedragen 2026. */
const VOORBEHOUD_TIJDELIJK_BELEIDSBESLUIT =
  "Het beleidsbesluit is tijdelijk en vervalt per 1 januari 2027; de structurele verankering moet nog via het Belastingplan 2027 door de Tweede en Eerste Kamer.";

const VOORBEHOUD_UITVOERINGSTOETS =
  "Volgens de uitvoeringstoets van de Belastingdienst kunnen IB-ondernemers de verhoging pas toepassen bij de definitieve aangifte inkomstenbelasting over 2026.";


const BRON_BELASTINGDIENST_BOX1_2026: FiscaleBron = {
  naam: "Belastingdienst — tarieven en heffingskortingen box 1 2026",
  url: "https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/prive/inkomstenbelasting/heffingskortingen_boxen_tarieven/",
};

/**
 * NOG TE VERIFIEREN — NIET GEBRUIKEN IN ARTIKELEN
 * De afbouwgrenzen (afbouwpunten en afbouwpercentages) van de algemene
 * heffingskorting en de arbeidskorting staan hier BEWUST NIET in: de bronnen
 * spreken elkaar daarover tegen. Deze waarden moeten eerst worden geverifieerd
 * bij de officiele tabellen van de Belastingdienst voordat ze hier mogen worden
 * toegevoegd of in een artikel gebruikt mogen worden. Verzin geen waarde.
 */

export const fiscaleCijfers = {

  zelfstandigenaftrek: {
    belastingjaar: 2026,
    waarde: 1200,
    eenheid: "euro",
    label: "Zelfstandigenaftrek",
    toelichting:
      "Aftrek voor ondernemers die aan het urencriterium voldoen. Wordt stapsgewijs afgebouwd.",
    bron: BRON_BELASTINGDIENST_ONDERNEMERSAFTREK,
    historie: { 2024: 3750, 2025: 2470 },
    aangekondigd: { 2027: 900 },
  },
  startersaftrek: {
    belastingjaar: 2026,
    waarde: 2123,
    eenheid: "euro",
    label: "Startersaftrek",
    toelichting:
      "Extra aftrek boven op de zelfstandigenaftrek, maximaal drie keer in de eerste vijf jaar.",
    bron: BRON_BELASTINGDIENST_ONDERNEMERSAFTREK,
  },
  mkbWinstvrijstelling: {
    belastingjaar: 2026,
    waarde: 12.7,
    eenheid: "procent",
    label: "Mkb-winstvrijstelling",
    toelichting: "Toe te passen op de winst na de ondernemersaftrek.",
    bron: BRON_BELASTINGDIENST_ONDERNEMERSAFTREK,
  },
  tariefcorrectieAftrekposten: {
    belastingjaar: 2026,
    waarde: 37.56,
    eenheid: "procent",
    label: "Maximaal tarief aftrekposten",
    toelichting:
      "Maximale tarief waartegen onder andere de zelfstandigenaftrek en de mkb-winstvrijstelling worden verrekend.",
    bron: BRON_BELASTINGDIENST_ONDERNEMERSAFTREK,
    historie: { 2025: 37.48 },
  },
  urencriterium: {
    belastingjaar: 2026,
    waarde: 1225,
    eenheid: "uren",
    label: "Urencriterium",
    toelichting:
      "Minimaal aantal uren per kalenderjaar dat je aan je onderneming besteedt voor recht op ondernemersaftrek.",
    bron: BRON_BELASTINGDIENST_ONDERNEMERSAFTREK,
  },
  zvwBijdrageOndernemers: {
    belastingjaar: 2026,
    waarde: 4.85,
    eenheid: "procent",
    label: "Inkomensafhankelijke bijdrage Zvw (ondernemers)",
    bron: BRON_BELASTINGDIENST_ZVW,
    historie: { 2025: 5.26 },
  },
  zvwWerkgeversheffing: {
    belastingjaar: 2026,
    waarde: 6.1,
    eenheid: "procent",
    label: "Werkgeversheffing Zvw",
    bron: BRON_BELASTINGDIENST_ZVW,
    historie: { 2025: 6.51 },
  },
  zvwMaximumBijdrageInkomen: {
    belastingjaar: 2026,
    waarde: 79409,
    eenheid: "euro",
    label: "Maximum bijdrage-inkomen Zvw",
    bron: BRON_STAATSCOURANT_BIJDRAGE_INKOMEN,
    historie: { 2025: 75864 },
  },
  zvwMaximaleBijdrage: {
    belastingjaar: 2026,
    waarde: 3851,
    eenheid: "euro",
    label: "Maximale inkomensafhankelijke bijdrage Zvw (ondernemers)",
    toelichting:
      "Afgeleid: maximum bijdrage-inkomen maal het bijdragepercentage voor ondernemers. Afgerond bedrag.",
    bron: BRON_STAATSCOURANT_BIJDRAGE_INKOMEN,
  },
  kilometeraftrekOndernemer: {
    belastingjaar: 2026,
    waarde: 0.25,
    eenheid: "euro",
    label: "Kilometeraftrek ondernemer (per zakelijke kilometer)",
    toelichting:
      "Geldt voor IB-ondernemers, zzp'ers, vennoten in een VOF en maten in een maatschap, voor zakelijke ritten met een privevervoermiddel. Met terugwerkende kracht vanaf 1 januari 2026.",
    voorbehoud: [VOORBEHOUD_TIJDELIJK_BELEIDSBESLUIT, VOORBEHOUD_UITVOERINGSTOETS],
    bron: BRON_BELEIDSBESLUIT_KILOMETERS_2026,
    historie: { 2025: 0.23 },
  },
  onbelasteKilometervergoedingWerknemer: {
    belastingjaar: 2026,
    waarde: 0.25,
    eenheid: "euro",
    label: "Onbelaste kilometervergoeding werknemer (per kilometer)",
    toelichting: "Met terugwerkende kracht vanaf 1 januari 2026.",
    voorbehoud: [VOORBEHOUD_TIJDELIJK_BELEIDSBESLUIT],
    bron: BRON_BELASTINGDIENST_KILOMETERVERGOEDING,
    historie: { 2025: 0.23 },
  },
} as const satisfies Record<string, FiscaalCijfer>;


export type FiscaalCijferSleutel = keyof typeof fiscaleCijfers;

export const fiscaleCijferSleutels = Object.keys(fiscaleCijfers) as FiscaalCijferSleutel[];

/** Nederlands geformatteerde waarde, inclusief eenheid. */
export function formatFiscaleWaarde(waarde: number, eenheid: FiscaalEenheid): string {
  if (eenheid === "euro") {
    return `€ ${waarde.toLocaleString("nl-NL", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })}`;
  }
  if (eenheid === "procent") {
    return `${waarde.toLocaleString("nl-NL", { maximumFractionDigits: 2 })}%`;
  }
  return `${waarde.toLocaleString("nl-NL")} uur`;
}

export function getFiscaalCijfer(sleutel: string): FiscaalCijfer | undefined {
  return (fiscaleCijfers as Record<string, FiscaalCijfer>)[sleutel];
}

/**
 * Waarde van een cijfer voor een specifiek jaar (actueel, historie of
 * aangekondigd). Geeft undefined als dat jaar niet is vastgelegd.
 */
export function getFiscaleWaardeVoorJaar(
  sleutel: string,
  jaar: number,
): { waarde: number; eenheid: FiscaalEenheid } | undefined {
  const cijfer = getFiscaalCijfer(sleutel);
  if (!cijfer) return undefined;
  if (cijfer.belastingjaar === jaar) return { waarde: cijfer.waarde, eenheid: cijfer.eenheid };
  const uitHistorie = cijfer.historie?.[jaar] ?? cijfer.aangekondigd?.[jaar];
  if (uitHistorie === undefined) return undefined;
  return { waarde: uitHistorie, eenheid: cijfer.eenheid };
}

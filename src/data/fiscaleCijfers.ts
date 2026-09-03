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

export type FiscaalEenheid =
  | "euro"
  | "procent"
  | "uren"
  | "jaren"
  | "maanden"
  | "kilometers";

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


const BRON_BELASTINGDIENST_KIA_2026: FiscaleBron = {
  naam: "Belastingdienst — Kleinschaligheidsinvesteringsaftrek 2026",
  url: "https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/zakelijk/winst/inkomstenbelasting/inkomstenbelasting_voor_ondernemers/investeringsaftrek_en_desinvesteringsbijtelling/kleinschaligheidsinvesteringsaftrek/",
};

const BRON_BELASTINGDIENST_BIJTELLING_2026: FiscaleBron = {
  naam: "Belastingdienst — bijtelling privegebruik auto 2026",
  url: "https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/zakelijk/auto_en_vervoer/",
};

const BRON_BELASTINGDIENST_BOX1_2026: FiscaleBron = {
  naam: "Belastingdienst — tarieven en heffingskortingen box 1 2026",
  url: "https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/prive/inkomstenbelasting/heffingskortingen_boxen_tarieven/",
};

/**
 * HEFFINGSKORTINGEN — VOLLEDIGE TABELLEN
 * De afbouwgrenzen en afbouwpercentages van de algemene heffingskorting en de
 * arbeidskorting zijn geverifieerd bij de officiele tabellen van de
 * Belastingdienst voor 2026 en staan onderaan dit bestand als
 * ALGEMENE_HEFFINGSKORTING en ARBEIDSKORTING, met de rekenfuncties
 * berekenAlgemeneHeffingskorting() en berekenArbeidskorting().
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
  schijf1Grens: {
    belastingjaar: 2026,
    waarde: 38883,
    eenheid: "euro",
    label: "Grens eerste schijf box 1",
    bron: BRON_BELASTINGDIENST_BOX1_2026,
    historie: { 2025: 38441 },
  },
  schijf1Tarief: {
    belastingjaar: 2026,
    waarde: 35.75,
    eenheid: "procent",
    label: "Tarief eerste schijf box 1",
    bron: BRON_BELASTINGDIENST_BOX1_2026,
    historie: { 2025: 36.97 },
  },
  schijf2Grens: {
    belastingjaar: 2026,
    waarde: 78426,
    eenheid: "euro",
    label: "Grens tweede schijf box 1",
    bron: BRON_BELASTINGDIENST_BOX1_2026,
  },
  schijf2Tarief: {
    belastingjaar: 2026,
    waarde: 37.56,
    eenheid: "procent",
    label: "Tarief tweede schijf box 1",
    bron: BRON_BELASTINGDIENST_BOX1_2026,
  },
  schijf3Tarief: {
    belastingjaar: 2026,
    waarde: 49.5,
    eenheid: "procent",
    label: "Tarief derde schijf box 1",
    toelichting: "Geldt over het inkomen boven € 78.426.",
    bron: BRON_BELASTINGDIENST_BOX1_2026,
  },
  maximaleArbeidskorting: {
    belastingjaar: 2026,
    waarde: 5685,
    eenheid: "euro",
    label: "Maximale arbeidskorting",
    bron: BRON_BELASTINGDIENST_BOX1_2026,
  },
  maximaleAlgemeneHeffingskorting: {
    belastingjaar: 2026,
    waarde: 3115,
    eenheid: "euro",
    label: "Maximale algemene heffingskorting",
    bron: BRON_BELASTINGDIENST_BOX1_2026,
  },

  /* --- KLEINSCHALIGHEIDSINVESTERINGSAFTREK (KIA) 2026 --------------------
   * Bron onder- en bovengrens: Belastingdienst, pagina
   * 'Kleinschaligheidsinvesteringsaftrek 2026'.
   * LET OP: de twee schijfwaarden (percentage eerste schijf en vast bedrag
   * tweede schijf, inclusief de in de toelichting genoemde schijfgrenzen)
   * komen uit een SECUNDAIRE BRON en moeten nog tegen de officiele KIA-tabel
   * van de Belastingdienst worden geverifieerd.
   * Het afbouwpercentage boven de tweede schijf (2025: 7,56 procent) is voor
   * 2026 NIET geverifieerd en staat daarom bewust niet in dit bestand.
   * -------------------------------------------------------------------- */
  kiaOndergrens: {
    belastingjaar: 2026,
    waarde: 2901,
    eenheid: "euro",
    label: "Ondergrens kleinschaligheidsinvesteringsaftrek",
    toelichting:
      "Minimaal totaal investeringsbedrag per jaar om in aanmerking te komen voor de KIA.",
    bron: BRON_BELASTINGDIENST_KIA_2026,
  },
  kiaBovengrens: {
    belastingjaar: 2026,
    waarde: 398236,
    eenheid: "euro",
    label: "Bovengrens kleinschaligheidsinvesteringsaftrek",
    toelichting: "Vanaf dit totale investeringsbedrag is er geen KIA meer.",
    bron: BRON_BELASTINGDIENST_KIA_2026,
    historie: { 2025: 392230 },
  },
  kiaMinimumPerBedrijfsmiddel: {
    belastingjaar: 2026,
    waarde: 450,
    eenheid: "euro",
    label: "Minimuminvestering per bedrijfsmiddel voor de KIA",
    bron: BRON_BELASTINGDIENST_KIA_2026,
  },
  kiaPercentageEersteSchijf: {
    belastingjaar: 2026,
    waarde: 28,
    eenheid: "procent",
    label: "KIA-percentage eerste schijf",
    toelichting:
      "Geldt over een totale investering van € 2.901 tot en met € 71.683. In 2025 liep deze schijf tot € 70.602. Schijfgrens uit secundaire bron: nog te verifieren tegen de officiele KIA-tabel.",
    bron: BRON_BELASTINGDIENST_KIA_2026,
  },
  kiaVastBedragTweedeSchijf: {
    belastingjaar: 2026,
    waarde: 20072,
    eenheid: "euro",
    label: "Vast KIA-bedrag tweede schijf",
    toelichting:
      "Geldt bij een totale investering van € 71.684 tot en met € 132.746. In 2025 was dit € 19.769 bij een schijf tot € 130.744. Bedrag en schijfgrenzen uit secundaire bron: nog te verifieren tegen de officiele KIA-tabel.",
    bron: BRON_BELASTINGDIENST_KIA_2026,
    historie: { 2025: 19769 },
  },


  /* --- BIJTELLING PRIVEGEBRUIK AUTO 2026 --------------------------------
   * Bron: Belastingdienst, pagina 'Bijtelling privegebruik auto 2026'.
   * In 2026 zijn er twee bijtellingstarieven, afhankelijk van de CO2-uitstoot.
   * -------------------------------------------------------------------- */
  bijtellingVerlaagdTarief: {
    belastingjaar: 2026,
    waarde: 18,
    eenheid: "procent",
    label: "Verlaagd bijtellingstarief",
    toelichting:
      "Geldt volledig alleen voor auto's op waterstof en voor auto's die volledig worden aangedreven door geintegreerde zonnecellen, met een vermogen van ten minste 1 kilowattpiek en een accu zonder lood. Voor andere nulemissie-auto's geldt dit tarief tot en met de drempel in de cataloguswaarde; over het deel daarboven geldt het standaardtarief.",
    bron: BRON_BELASTINGDIENST_BIJTELLING_2026,
    historie: { 2025: 17 },
  },
  bijtellingStandaardtarief: {
    belastingjaar: 2026,
    waarde: 22,
    eenheid: "procent",
    label: "Standaard bijtellingstarief",
    toelichting:
      "Geldt over de volledige cataloguswaarde voor auto's met CO2-uitstoot, en voor het deel van de cataloguswaarde van een nulemissie-auto boven de drempel.",
    bron: BRON_BELASTINGDIENST_BIJTELLING_2026,
  },
  bijtellingDrempelCataloguswaarde: {
    belastingjaar: 2026,
    waarde: 30000,
    eenheid: "euro",
    label: "Drempel cataloguswaarde verlaagd bijtellingstarief",
    toelichting:
      "Voor nulemissie-auto's geldt het verlaagde tarief tot en met deze cataloguswaarde; over het deel daarboven geldt het standaardtarief.",
    bron: BRON_BELASTINGDIENST_BIJTELLING_2026,
  },
  bijtellingYoungtimerTarief: {
    belastingjaar: 2026,
    waarde: 35,
    eenheid: "procent",
    label: "Bijtelling youngtimer",
    toelichting:
      "Percentage van de waarde in het economisch verkeer in plaats van de cataloguswaarde.",
    bron: BRON_BELASTINGDIENST_BIJTELLING_2026,
  },
  bijtellingYoungtimerLeeftijd: {
    belastingjaar: 2026,
    waarde: 16,
    eenheid: "jaren",
    label: "Minimumleeftijd youngtimer",
    toelichting:
      "Sinds 2026 geldt de youngtimerbijtelling voor auto's ouder dan 16 jaar; tot en met 2025 was dat ouder dan 15 jaar. Gebruikte iemand de auto in 2025 en was die op 31 december 2025 ouder dan 15 jaar, dan valt die auto in 2026 ook onder de youngtimerbijtelling.",
    bron: BRON_BELASTINGDIENST_BIJTELLING_2026,
    historie: { 2025: 15 },
  },
  bijtellingVastePeriode: {
    belastingjaar: 2026,
    waarde: 60,
    eenheid: "maanden",
    label: "Periode waarin het bijtellingspercentage vaststaat",
    toelichting: "Gerekend vanaf de eerste tenaamstelling van de auto.",
    bron: BRON_BELASTINGDIENST_BIJTELLING_2026,
  },
  bijtellingPriveKilometergrens: {
    belastingjaar: 2026,
    waarde: 500,
    eenheid: "kilometers",
    label: "Grens privegebruik zonder bijtelling",
    toelichting:
      "Geen bijtelling bij aantoonbaar minder dan dit aantal privekilometers per jaar, met een sluitende rittenregistratie.",
    bron: BRON_BELASTINGDIENST_BIJTELLING_2026,
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
  const getal = waarde.toLocaleString("nl-NL");
  if (eenheid === "jaren") return `${getal} jaar`;
  if (eenheid === "maanden") return `${getal} maanden`;
  if (eenheid === "kilometers") return `${getal} kilometer`;
  return `${getal} uur`;
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

/* ==========================================================================
 * HEFFINGSKORTINGEN 2026 — VOLLEDIGE TABELLEN
 * Bron: Belastingdienst, Tabel algemene heffingskorting 2026 en Tabel
 * arbeidskorting 2026. Beide tabellen gelden voor wie de AOW-leeftijd nog niet
 * heeft bereikt. Waarden uitsluitend wijzigen op basis van die tabellen.
 * De rekenfuncties bevatten geen bedragen: zij lezen uitsluitend deze data.
 * ========================================================================== */

export interface KortingSchijf {
  /** Ondergrens van de schijf in euro, inclusief. */
  van: number;
  /** Bovengrens in euro, inclusief. null = geen bovengrens. */
  totEnMet: number | null;
  /** Vast bedrag in euro binnen deze schijf. */
  basis: number;
  /** Percentage over (inkomen - percentageVanaf). Positief = opbouw, negatief = afbouw. */
  percentage: number;
  /** Inkomensdrempel waarover het percentage wordt gerekend. */
  percentageVanaf: number;
}

export interface KortingTabel {
  belastingjaar: number;
  label: string;
  toelichting: string;
  bron: FiscaleBron;
  schijven: readonly KortingSchijf[];
}

export const ALGEMENE_HEFFINGSKORTING: KortingTabel = {
  belastingjaar: 2026,
  label: "Algemene heffingskorting",
  toelichting: "Voor wie de AOW-leeftijd nog niet heeft bereikt. Grondslag: verzamelinkomen.",
  bron: {
    naam: "Belastingdienst — Tabel algemene heffingskorting 2026",
    url: "https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/prive/inkomstenbelasting/heffingskortingen_boxen_tarieven/heffingskortingen/algemene_heffingskorting/",
  },
  schijven: [
    { van: 0, totEnMet: 29736, basis: 3115, percentage: 0, percentageVanaf: 0 },
    { van: 29737, totEnMet: 78426, basis: 3115, percentage: -6.398, percentageVanaf: 29736 },
    { van: 78427, totEnMet: null, basis: 0, percentage: 0, percentageVanaf: 0 },
  ],
};

export const ARBEIDSKORTING: KortingTabel = {
  belastingjaar: 2026,
  label: "Arbeidskorting",
  toelichting: "Voor wie de AOW-leeftijd nog niet heeft bereikt. Grondslag: arbeidsinkomen.",
  bron: {
    naam: "Belastingdienst — Tabel arbeidskorting 2026",
    url: "https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/prive/inkomstenbelasting/heffingskortingen_boxen_tarieven/heffingskortingen/arbeidskorting/",
  },
  schijven: [
    { van: 0, totEnMet: 11965, basis: 0, percentage: 8.324, percentageVanaf: 0 },
    { van: 11966, totEnMet: 25845, basis: 996, percentage: 31.009, percentageVanaf: 11965 },
    { van: 25846, totEnMet: 45592, basis: 5300, percentage: 1.95, percentageVanaf: 25845 },
    { van: 45593, totEnMet: 132920, basis: 5685, percentage: -6.51, percentageVanaf: 45592 },
    { van: 132921, totEnMet: null, basis: 0, percentage: 0, percentageVanaf: 0 },
  ],
};

/** Berekent een heffingskorting op basis van de schijven in de tabel. Afgerond op hele euro's. */
export function berekenKorting(tabel: KortingTabel, inkomen: number): number {
  const inkomenAfgerond = Math.max(0, Math.round(inkomen));
  const schijf =
    tabel.schijven.find(
      (s) => inkomenAfgerond >= s.van && (s.totEnMet === null || inkomenAfgerond <= s.totEnMet),
    ) ?? tabel.schijven[tabel.schijven.length - 1];
  const bedrag =
    schijf.basis + (schijf.percentage / 100) * (inkomenAfgerond - schijf.percentageVanaf);
  return Math.max(0, Math.round(bedrag));
}

/** Algemene heffingskorting bij een gegeven verzamelinkomen. */
export function berekenAlgemeneHeffingskorting(verzamelinkomen: number): number {
  return berekenKorting(ALGEMENE_HEFFINGSKORTING, verzamelinkomen);
}

/** Arbeidskorting bij een gegeven arbeidsinkomen. */
export function berekenArbeidskorting(arbeidsinkomen: number): number {
  return berekenKorting(ARBEIDSKORTING, arbeidsinkomen);
}

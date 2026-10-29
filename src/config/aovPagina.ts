// F9: één vlag voor de nieuwe AOV-pagina; uit = nieuwe pagina alleen in de preview, live blijft de huidige /aov.
export const AOV_NIEUW_PUBLIEK = false; // F9-6: blijft uit tot er een bewaartermijn is (AOV_BEWAARTERMIJN)
export const AOV_PAD = "/aov";
export const AOV_ADVISEUR_URL = "https://www.wijzijnaov.nl";
export const AOV_REKENTOOL_URL = "https://movir-aov-exon.smartplatforms.io/frame/0f148d2f-a3e4-4ba2-adb3-384917fde229";
export const AOV_REKENTOOL_TEKST =
  "De rekentool en de aanvraag zijn van Tjepkema Assurantie & Advies B.V. (WijZijnAOV), AFM-vergunning 12050654. Voordat je verdergaat, leg je bij ZP Zaken je naam, e-mailadres en eventueel telefoonnummer vast. ZP Zaken bewaart die gegevens en je toestemming, geeft ze door aan Tjepkema Assurantie & Advies voor de AOV en gebruikt ze om contact met je te houden over je aanmelding. Wat je bij de adviseur invult, ontvangt ZP Zaken niet.";
/** Byte-gelijk aan de controle in de databasefunctie aov_aanmelden. */
export const AOV_TOESTEMMING_TEKST =
  "Ik geef ZP Zaken toestemming mijn naam en contactgegevens door te geven aan Tjepkema Assurantie & Advies B.V. (WijZijnAOV), zodat ik de Movir Momentum AOV via hen kan berekenen en afsluiten.";
export const AOV_TOESTEMMING_UITLEG =
  "ZP Zaken geeft alleen je contactgegevens door. Advies en afsluiten lopen via Tjepkema Assurantie & Advies B.V., AFM-vergunning 12050654. Wat je daar invult, ontvangt ZP Zaken niet.";
export const AOV_GEEN_VERGOEDING =
  "ZP Zaken ontvangt geen vergoeding van Tjepkema Assurantie & Advies, Movir of Nationale-Nederlanden voor deze doorverwijzing.";
/** Leeg zolang de privacyverklaring geen termijn voor contact- en aanvraaggegevens noemt; vlag blijft dan uit. */
export const AOV_BEWAARTERMIJN = "XXX";
export const AOV_AFM_URL =
  "https://www.afm.nl/nl-nl/sector/registers/vergunningenregisters/financiele-dienstverleners/details?id=A6BF9913-6111-F011-998A-7C1E5272931F";
export const AOV_VERMELDING_VOOR =
  "Advies en afsluiten van de Movir Momentum AOV lopen via Tjepkema Assurantie & Advies B.V., Middenweg 344, 1097 TZ Amsterdam, ";
export const AOV_VERMELDING_AFM = "AFM-vergunning 12050654";
export const AOV_VERMELDING_NA = ". ZP Zaken geeft geen advies en bemiddelt niet in deze verzekering.";

export function aovNieuwTonen(hostname: string, publiek: boolean = AOV_NIEUW_PUBLIEK) {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return publiek || host.endsWith(".lovable.app") || host === "localhost" || host === "127.0.0.1";
}

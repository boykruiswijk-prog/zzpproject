// F9: één vlag voor de nieuwe AOV-pagina; uit = nieuwe pagina alleen in de preview, live blijft de huidige /aov.
export const AOV_NIEUW_PUBLIEK = false;
export const AOV_PAD = "/aov";
// TODO: vervangen door de directe Movir-afsluitlink van Tjepkema zodra die er is.
export const AOV_ADVISEUR_URL = "https://www.tjepkema.nu";
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

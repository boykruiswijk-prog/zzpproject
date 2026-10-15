// Eén vlag voor robots, vindbaarheid en links; prerender blijft altijd aan.
export const EVI_PAGINA_PUBLIEK = false;
export const EVI_PAGINA_PAD = "/pensioen-opbouwen-zzp";
export function eviPaginaRobots(publiek: boolean = EVI_PAGINA_PUBLIEK) {
  return publiek ? "index,follow" : "noindex,nofollow";
}
export function eviPaginaVindbaar(pad: string, publiek: boolean = EVI_PAGINA_PUBLIEK) {
  return pad !== EVI_PAGINA_PAD || publiek;
}
export function eviPaginaLinks(publiek: boolean = EVI_PAGINA_PUBLIEK) {
  return publiek ? [{ href: EVI_PAGINA_PAD, label: "Pensioen opbouwen als zzp'er" }] : [];
}
export const EVI_FORMULIER_NAAM = "Interesse pensioen via Evi";
export const EVI_BAV_URL = "/verzekeringen?bron=evi-pagina#combinatiepolis?pakket=jaarlijks";
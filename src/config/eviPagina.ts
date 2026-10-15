// Eén vlag voor openbare toegang, prerender, robots en links; uit = alleen preview.
export const EVI_PAGINA_PUBLIEK = false;
export const EVI_PAGINA_PAD = "/pensioen-opbouwen-zzp";
export function eviPaginaToegankelijk(hostname: string, publiek: boolean = EVI_PAGINA_PUBLIEK) {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return publiek || host.endsWith(".lovable.app") || host === "localhost" || host === "127.0.0.1";
}
export function eviPaginaPrerenderen(publiek: boolean = EVI_PAGINA_PUBLIEK) {
  return publiek;
}
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
// Stelt voor een niet-gevonden pad de meest specifieke bestemming voor:
// artikel met (bijna) dezelfde slug > onderwerp-pagina > /kennisbank.

const STOP = new Set(["de", "het", "een", "van", "voor", "en", "je", "als", "zzp", "zzper", "zzpers", "er", "ers", "in", "op", "met", "wat", "is", "te", "hoe", "zp", "om", "bij", "aan", "zijn", "ik", "mijn", "of", "niet"]);

function tokens(s: string): Set<string> {
  return new Set(s.split(/[-/]/).filter((t) => t && !STOP.has(t) && !/^\d+$/.test(t)));
}

const ONDERWERPEN: Array<[RegExp, string]> = [
  [/aov|arbeidsongeschikt/, "/aov"],
  [/pensioen/, "/pensioen"],
  [/zorgverzekering/, "/zorgverzekering"],
  [/bav|avb|aansprakelijk|verzekering/, "/verzekeringen"],
  [/belasting|btw|fiscaal|aftrek/, "/kennisbank/belastingen"],
  [/factuur|financ|hypotheek/, "/kennisbank/financien"],
  [/wet|dba|juridisch/, "/kennisbank/wet-en-regelgeving"],
  [/contact/, "/contact"],
];

export function stelRedirectVoor(pad: string, artikelSlugs: string[]): string {
  const schoon = pad.toLowerCase().replace(/^\/+|\/+$/g, "").replace(/\/page\/\d+$/, "");
  const laatste = schoon.split("/").pop() || "";
  if (artikelSlugs.includes(laatste)) return `/kennisbank/${laatste}`;
  const a = tokens(laatste);
  let beste: [number, string | null] = [0, null];
  if (a.size >= 2) {
    for (const slug of artikelSlugs) {
      const b = tokens(slug);
      const doorsnede = [...a].filter((t) => b.has(t)).length;
      const j = doorsnede / new Set([...a, ...b]).size;
      if (j > beste[0]) beste = [j, slug];
    }
  }
  if (beste[1] && beste[0] >= 0.5) return `/kennisbank/${beste[1]}`;
  for (const [rx, naar] of ONDERWERPEN) if (rx.test(schoon)) return naar;
  return "/kennisbank";
}

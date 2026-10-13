/** Haalt de build-kenmerken (gehashte script-/stylesheetnamen) uit index.html. */
export function buildKenmerk(html: string): string {
  const m = html.match(/<(?:script|link)[^>]+(?:src|href)="[^"]*\/assets\/[^"]+\.(?:js|css)"/g) ?? [];
  return m.map(x => x.replace(/^.*(?:src|href)="/, '').replace(/"$/, '')).sort().join('|');
}

/** Vergelijkt de live index.html met de geladen versie; true = herladen nodig. */
export async function nieuweVersieBeschikbaar(huidig: string, ophalen: typeof fetch = fetch): Promise<boolean> {
  if (!huidig) return false;
  try {
    const r = await ophalen(`/index.html?v=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return false;
    const nieuw = buildKenmerk(await r.text());
    return nieuw !== '' && nieuw !== huidig;
  } catch { return false; }
}

export const VERSIE_INTERVAL_MS = 10 * 60_000;

/** Start de versiecontrole elke 10 minuten; herlaadt bij een nieuwe build. Geeft een stopfunctie terug. */
export function startVersieControle(herlaad: () => void = () => window.location.reload(), ophalen: typeof fetch = fetch, huidig = buildKenmerk(document.documentElement.outerHTML)) {
  const t = setInterval(async () => { if (await nieuweVersieBeschikbaar(huidig, ophalen)) herlaad(); }, VERSIE_INTERVAL_MS);
  return () => clearInterval(t);
}

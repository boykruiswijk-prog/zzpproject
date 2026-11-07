// Controle: geen bestaande route (router of seoRoutes) mag als bron in
// legacyRedirects staan, anders stuurt de hosting de pagina live weg.
// Leest de bronbestanden als tekst, zodat dit zonder aliassen werkt.
import fs from "fs";
import path from "path";
import { legacyRedirects, isVangregel } from "../src/config/legacyRedirects";

const norm = (p: string) => p.replace(/^\/+|\/+$/g, "").toLowerCase();

export function bestaandeRoutes(root: string): Set<string> {
  const app = fs.readFileSync(path.join(root, "src/App.tsx"), "utf8");
  const seo = fs.readFileSync(path.join(root, "src/config/seoRoutes.ts"), "utf8");
  const routes = new Set<string>();
  // Routes die zelf al doorverwijzen (<Navigate>) tellen niet als echte pagina.
  for (const m of app.matchAll(/<Route[^>]*\spath="([^"]+)"[^>]*>/g)) if (!m[0].includes("<Navigate")) routes.add(norm(m[1]));
  for (const m of seo.matchAll(/\bpath:\s*"([^"]+)"/g)) routes.add(norm(m[1]));
  routes.delete("");
  for (const r of [...routes]) if (r.includes(":") || r.includes("*")) routes.delete(r);
  return routes;
}

export function redirectRouteConflicten(root: string): string[] {
  const routes = bestaandeRoutes(root);
  const exact = legacyRedirects.filter(r => !isVangregel(r)).map((r) => norm(r.from)).filter((f) => routes.has(f));
  // Een vangregel mag geen bestaande route opslokken (bijv. services/* naast /services/...).
  const vang = legacyRedirects
    .filter(isVangregel)
    .filter(r => [...routes].some(x => x.startsWith(norm(r.from.slice(0, -1)))
      || (r.from.endsWith("/*") && x === norm(r.from.slice(0, -2)))))
    .map(r => r.from);
  return [...exact, ...vang];
}

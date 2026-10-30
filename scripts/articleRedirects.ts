import { bestaandeRoutes } from "./routeConflicts";
import { legacyRedirects } from "../src/config/legacyRedirects";

const norm = (value: string) => value.replace(/^\/+|\/+$/g, "").toLowerCase();
const BEGIN = "# BEGIN gegenereerde root-artikelredirects";
const END = "# END gegenereerde root-artikelredirects";

/** Input is the exact published article list used by prerender's sitemap. */
export function rootArtikelRedirects(articles: ReadonlyArray<{ slug: string }>, root: string) {
  const routes = bestaandeRoutes(root);
  const existing = new Set(legacyRedirects.map((r) => norm(r.from)));
  const prefixes = legacyRedirects.filter((r) => r.from.endsWith("/*")).map((r) => norm(r.from.slice(0, -2)));
  const seen = new Set<string>();
  return articles.flatMap(({ slug }) => {
    const from = norm(slug);
    if (!from || from.includes("/") || from === "tv" || routes.has(from) || existing.has(from)
      || prefixes.some((prefix) => from === prefix || from.startsWith(`${prefix}/`)) || seen.has(from)) return [];
    seen.add(from);
    const canonicalSlug = slug.replace(/^\/+|\/+$/g, "");
    return [{ from: canonicalSlug, to: `/kennisbank/${canonicalSlug}` }];
  });
}

/** Idempotent block, before wildcard rules and the generic slash redirect. */
export function voegArtikelRedirectsToe(text: string, redirects: ReturnType<typeof rootArtikelRedirects>): string {
  const cleaned = text.replace(new RegExp(`${BEGIN}[\\s\\S]*?${END}\\n*`, "g"), "");
  const lines = cleaned.split("\n");
  const index = lines.findIndex((line) => /^\/(?:radio|services)\/\*\s/.test(line)
    || /^\/:path\/\s/.test(line) || /^\/\*\s/.test(line));
  if (index < 0) throw new Error("Geen veilig invoegpunt voor artikelredirects");
  lines.splice(index, 0, BEGIN, ...redirects.flatMap(({ from, to }) => [
    `/${from}    ${to}    301`,
    `/${from}/    ${to}    301`,
  ]), END, "");
  return lines.join("\n");
}
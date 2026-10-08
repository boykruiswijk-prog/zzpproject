// Prerender-stap voor crawlers zonder JavaScript (GPTBot, PerplexityBot,
// ClaudeBot, OAI-SearchBot, LinkedIn- en WhatsApp-linkpreviews).
//
// Leest dist/index.html als sjabloon en schrijft per publieke route een
// dist/<pad>/index.html met de juiste head, JSON-LD en een statisch
// fallback-blok binnen <div id="root">. React vervangt dat blok bij hydration.
//
// Alle SEO-tekst komt uit src/config/seoRoutes.ts, alle bedrijfsgegevens uit
// src/config/site.ts en alle premies uit src/data/bavPakketten.ts.

import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";
import { createServer, type ViteDevServer } from "vite";
import { seoRoutes, PRERENDER_EXCLUDE_PREFIXES, type SeoRoute } from "../src/config/seoRoutes";
import { SITE_CONFIG } from "../src/config/site";
import { bavPakketten } from "../src/data/bavPakketten";
import { faqItems } from "../src/data/faqItems";
import { ARTIKEL_FAQS } from "../src/config/artikelFaqs";
import { waaromFaqs } from "../src/config/waaromFaqs";
import { formatPageTitle } from "../src/lib/seoTitle";
import { resolveFiscaleTokens } from "../src/lib/fiscaleTokens";
import { markdownToSafeHtml } from "./markdownToSafeHtml";
import { generateArticleImages } from "./articleImages";
import { absoluteArticleImage, isGeneratedArticleImage } from "../src/lib/articleImage";
import {
  legacyRedirects,
  resolveRedirectTarget,
  categoryPageFor,
  type ArticleRedirectInfo,
} from "../src/config/legacyRedirects";
import {
  articleSchema,
  breadcrumbForPath,
  faqSchema,
  productSchema,
  type JsonLd,
} from "../src/lib/schema";

const LANGS = ["en", "de", "fr"] as const;
import { buildLlmsTxt, buildLlmsFullTxt } from "./llmsTxt";

/** Belangrijkste pagina's in het statische fallback-blok. */
const FALLBACK_LINKS: Array<{ href: string; label: string }> = [
  { href: "/", label: "Home" },
  { href: "/verzekeringen", label: "BAV & AVB verzekering" },
  { href: "/diensten", label: "Diensten" },
  { href: "/kennisbank", label: "Kennisbank" },
  { href: "/faq", label: "Veelgestelde vragen" },
  { href: "/over-ons", label: "Over ons" },
  { href: "/contact", label: "Contact" },
];

function esc(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isExcluded(routePath: string) {
  return PRERENDER_EXCLUDE_PREFIXES.some(
    (prefix) => routePath === prefix || routePath.startsWith(`${prefix}/`),
  );
}

function headFor(routePath: string, title: string, description: string, ogType: string) {
  const url = `${SITE_CONFIG.url}${routePath === "/" ? "/" : routePath}`;
  return {
    url,
    tags: [
      `<link rel="canonical" href="${url}" data-rh="true">`,
      `<meta name="twitter:title" content="${esc(title)}" data-rh="true">`,
      `<meta name="twitter:description" content="${esc(description)}" data-rh="true">`,
    ].join("\n    "),
    ogType,
  };
}

/** Pagina-specifieke JSON-LD. BreadcrumbList altijd waar die bestaat. */
function schemasFor(routePath: string): JsonLd[] {
  const schemas: JsonLd[] = [];
  const breadcrumb = breadcrumbForPath(routePath);
  if (breadcrumb) schemas.push(breadcrumb);
  if (routePath === "/faq") {
    schemas.push(faqSchema(faqItems.flatMap((c) => c.questions)));
  }
  if (routePath === "/waarom-zp-zaken") {
    // FAQSection rendert exact deze vragen en antwoorden op de pagina.
    schemas.push(faqSchema(waaromFaqs.map((f) => ({ question: f.q, answer: f.a }))));
  }
  if (routePath === "/verzekeringen") {
    for (const pakket of bavPakketten) schemas.push(productSchema(pakket));
  }
  return schemas;
}

function renderFallback(h1: string, intro: string, extra = "") {
  const links = FALLBACK_LINKS.map(
    (l) => `<li><a href="${l.href}">${esc(l.label)}</a></li>`,
  ).join("");
  // Wordt bij hydration volledig door React vervangen; bezoekers zien dit
  // alleen in het korte moment voordat de app is geladen.
  return [
    `<div id="prerender-fallback">`,
    `<h1>${esc(h1)}</h1>`,
    `<p>${esc(intro)}</p>`,
    extra,
    `<nav aria-label="Belangrijkste pagina's"><ul>${links}</ul></nav>`,
    `<p>${esc(SITE_CONFIG.legalName)} — telefoon ${esc(SITE_CONFIG.phone)}, e-mail ${esc(
      SITE_CONFIG.email,
    )}. AFM ${esc(SITE_CONFIG.registrations.afm)}, KvK ${esc(
      SITE_CONFIG.registrations.kvk,
    )}, Kifid ${esc(SITE_CONFIG.registrations.kifid)}.</p>`,
    `</div>`,
  ]
    .filter(Boolean)
    .join("\n      ");
}

/** Zichtbaar vraag-en-antwoordblok, zodat het schema gedekt is door de tekst. */
function renderFaqBlock(items: Array<{ question: string; answer: string }>): string {
  if (!items.length) return "";
  return [
    `<section aria-label="Veelgestelde vragen"><h2>Veelgestelde vragen</h2><dl>`,
    ...items.map((i) => `<dt>${esc(i.question)}</dt><dd>${esc(i.answer)}</dd>`),
    `</dl></section>`,
  ].join("");
}

/** Interne linklijst naar artikelen, zodat crawlers ze zonder JavaScript vinden. */
function renderArticleLinks(
  titel: string,
  items: Array<{ slug: string; title: string; excerpt?: string | null }>,
): string {
  if (!items.length) return "";
  return [
    `<section aria-label="${esc(titel)}"><h2>${esc(titel)}</h2><ul>`,
    ...items.map(
      (a) =>
        `<li><a href="/kennisbank/${esc(a.slug)}">${esc(a.title)}</a>${
          a.excerpt ? ` — ${esc(a.excerpt)}` : ""
        }</li>`,
    ),
    `</ul></section>`,
  ].join("");
}

/**
 * Statische redirect-stub: canonical naar de nieuwe bestemming plus een
 * meta-refresh, zodat een oude URL ook zonder hosting-redirects goed landt.
 */
function redirectStubHtml(from: string, to: string): string {
  const target = `${SITE_CONFIG.url}${to}`;
  return `<!DOCTYPE html>
<html lang="nl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Verplaatst naar ${esc(to)} | ${esc(SITE_CONFIG.name)}</title>
    <meta name="description" content="Deze pagina is verplaatst. Je wordt doorgestuurd naar ${esc(target)}." />
    <meta property="og:image" content="${esc(SITE_CONFIG.ogImage)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:type" content="image/jpeg" />
    <meta property="og:image:alt" content="ZP Zaken – BAV &amp; AVB voor zzp'ers" />
    <meta name="twitter:image" content="${esc(SITE_CONFIG.ogImage)}" />
    <meta name="robots" content="noindex, follow" />
    <link rel="canonical" href="${esc(target)}" />
    <meta http-equiv="refresh" content="0;url=${esc(to)}" />
    <script>window.location.replace(${JSON.stringify(to)});</script>
  </head>
  <body>
    <p>Deze pagina (<code>/${esc(from)}</code>) is verplaatst naar
      <a href="${esc(target)}">${esc(target)}</a>.</p>
  </body>
</html>
`;
}

/** Alle objectpaden onder een prefix in een publieke storage-bucket. */
async function listStorageFiles(
  base: string,
  key: string,
  bucket: string,
  prefix: string,
): Promise<string[]> {
  const res = await fetch(`${base}/storage/v1/object/list/${bucket}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prefix, limit: 1000, sortBy: { column: "name", order: "asc" } }),
  });
  if (!res.ok) throw new Error(`storage ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const rows = (await res.json()) as Array<{ name: string; id: string | null }>;
  const files: string[] = [];
  for (const row of rows) {
    const full = `${prefix}${row.name}`;
    // id === null betekent een map; die recursief uitlopen.
    if (row.id === null) files.push(...(await listStorageFiles(base, key, bucket, `${full}/`)));
    else files.push(full);
  }
  return files;
}

export function buildHtml(
  template: string,
  opts: {
    routePath: string;
    title: string;
    description: string;
    ogType: string;
    schemas: JsonLd[];
    fallback: string;
    /** Absolute URL van de deelafbeelding; leeg = algemene og-image. */
    image?: string;
    generatedImage?: boolean;
  },
) {
  const { url, tags, ogType } = headFor(
    opts.routePath,
    opts.title,
    opts.description,
    opts.ogType,
  );
  let html = template;
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(opts.title)}</title>`);
  html = html.replace(
    /<meta name="description" content="[\s\S]*?" \/>/,
    `<meta name="description" content="${esc(opts.description)}" data-rh="true" />`,
  );
  html = html.replace(
    /<meta property="og:title" content="[\s\S]*?" \/>/,
    `<meta property="og:title" content="${esc(opts.title)}" data-rh="true" />`,
  );
  html = html.replace(
    /<meta property="og:description" content="[\s\S]*?" \/>/,
    `<meta property="og:description" content="${esc(opts.description)}" data-rh="true" />`,
  );
  html = html.replace(
    /<meta property="og:url" content="[\s\S]*?" \/>/,
    `<meta property="og:url" content="${url}" data-rh="true" />`,
  );
  html = html.replace(
    /<meta property="og:type" content="[\s\S]*?" \/>/,
    `<meta property="og:type" content="${ogType}" data-rh="true" />`,
  );
  if (opts.image) {
    html = html.replace(
      /<meta property="og:image"[^>]*>/,
      `<meta property="og:image" content="${esc(opts.image)}" data-rh="true" />`,
    );
    html = html.replace(
      /<meta name="twitter:image"[^>]*>/,
      `<meta name="twitter:image" content="${esc(opts.image)}" data-rh="true" />`,
    );
    if (opts.generatedImage) {
      html = html.replace(/<meta property="og:image:width"[^>]*>/, '<meta property="og:image:width" content="1200" data-rh="true" />');
      html = html.replace(/<meta property="og:image:height"[^>]*>/, '<meta property="og:image:height" content="630" data-rh="true" />');
      html = html.replace(/<meta property="og:image:type"[^>]*>/, '<meta property="og:image:type" content="image/png" data-rh="true" />');
      html = html.replace(/<meta property="og:image:alt"[^>]*>/, `<meta property="og:image:alt" content="${esc(opts.title)}" data-rh="true" />`);
    } else if (opts.ogType === "article") {
      html = html.replace(/<meta property="og:image:(?:width|height|type)"[^>]*>/g, "");
    }
  }
  const jsonLd = opts.schemas
    .map((s) => `<script type="application/ld+json">${JSON.stringify(s)}</script>`)
    .join("\n    ");
  html = html.replace("</head>", `  ${tags}\n    ${jsonLd}\n  </head>`);
  html = html.replace('<div id="root"></div>', `<div id="root">\n      ${opts.fallback}\n    </div>`);
  return html;
}

type SsrRender = (
  url: string,
  preloaded?: Record<string, unknown>,
) => Promise<{ html: string; helmet?: { script?: { toString(): string } } }>;

/** In-memory Storage voor modules die bij import localStorage aanspreken. */
function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, String(v)),
    removeItem: (k) => void m.delete(k),
    clear: () => m.clear(),
    key: (i) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
  } as Storage;
}

/**
 * Start een Vite SSR-server en laadt src/entry-server.tsx. Mislukt dat, dan
 * valt de prerender terug op het korte statische blok (de build gaat door).
 */
async function loadSsr(root: string): Promise<{ render: SsrRender; close: () => Promise<void> } | null> {
  const g = globalThis as Record<string, unknown>;
  if (!g.localStorage) g.localStorage = memoryStorage();
  if (!g.sessionStorage) g.sessionStorage = memoryStorage();
  let vite: ViteDevServer | undefined;
  // De dev-server transformeert JSX naar de dev-runtime; React moet dan ook
  // in development-modus laden, anders ontbreekt jsxDEV.
  const prevEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";
  try {
    vite = await createServer({
      root,
      configFile: path.join(root, "vite.config.ts"),
      mode: "development",
      logLevel: "error",
      appType: "custom",
      server: { middlewareMode: true, hmr: false, watch: null },
      optimizeDeps: { noDiscovery: true, include: [] },
      ssr: { noExternal: ["react-helmet-async"] },
    });
    const mod = (await vite.ssrLoadModule("/src/entry-server.tsx")) as { render: SsrRender };
    const server = vite;
    return {
      render: mod.render,
      close: async () => {
        await server.close();
        process.env.NODE_ENV = prevEnv;
      },
    };
  } catch (error) {
    console.warn(
      `[prerender] WAARSCHUWING: SSR niet beschikbaar, korte fallback gebruikt: ${
        error instanceof Error ? error.stack || error.message : String(error)
      }`,
    );
    await vite?.close();
    process.env.NODE_ENV = prevEnv;
    return null;
  }
}

/** Datum (jjjj-mm-dd) van de laatste commit die een bestand wijzigde; null zonder git. */
function gitDate(root: string, files: string[]): string | null {
  try {
    const out = execFileSync("git", ["log", "-1", "--format=%cI", "--", ...files], {
      cwd: root,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
    return out ? out.slice(0, 10) : null;
  } catch {
    return null;
  }
}

/** Route → paginabestand(en), afgeleid uit src/App.tsx, voor de sitemap-lastmod. */
function routeSourceFiles(root: string): Map<string, string[]> {
  const app = fs.readFileSync(path.join(root, "src/App.tsx"), "utf8");
  const imports = new Map<string, string>();
  for (const m of app.matchAll(/const (\w+) = lazy\(\(\) => import\("\.\/([^"]+)"\)\)/g)) {
    imports.set(m[1], `src/${m[2]}.tsx`);
  }
  const map = new Map<string, string[]>();
  for (const m of app.matchAll(/<Route (index|path="([^"]*)") element=\{<(\w+)/g)) {
    const routePath = m[1] === "index" ? "/" : `/${m[2]}`;
    const file = imports.get(m[3]);
    if (file && !map.has(routePath)) map.set(routePath, [file]);
  }
  return map;
}

/**
 * Het homepagebestand is ook de terugval voor niet-geprerenderde paden. Alleen
 * taalversies (/en, /de, /fr) krijgen hier noindex; geldige NL-routes (ook nieuwe
 * artikelen) houden index en krijgen hun canonical van de app zelf. Echte 404's
 * zet NotFound/ArtikelDetail op noindex.
 */
const LANG_NOINDEX_GUARD = `<script>(function(){if(/^\\/(en|de|fr)(\\/|$)/.test(location.pathname)){var c=document.querySelector('link[rel="canonical"]');if(c)c.remove();var m=document.querySelector('meta[name="robots"]');if(!m){m=document.createElement("meta");m.name="robots";document.head.appendChild(m);}m.content="noindex, follow";}})();</script>`;

const HOME_CANONICAL_SCRIPT = `<script>(function(){if(location.pathname==="/"&&!document.querySelector('link[rel="canonical"]')){var l=document.createElement("link");l.rel="canonical";l.href="${SITE_CONFIG.url}/";l.setAttribute("data-rh","true");document.head.appendChild(l);}})();</script>`;

/** JSON-LD uit de Helmet-head van de SSR-render. */
function helmetJsonLd(helmetScript: string | undefined): JsonLd[] {
  if (!helmetScript) return [];
  const out: JsonLd[] = [];
  for (const m of helmetScript.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    try {
      const v = JSON.parse(m[1]);
      for (const item of Array.isArray(v) ? v : [v]) if (item && typeof item === "object" && (item as Record<string, unknown>)["@id"] !== `${SITE_CONFIG.url}/#organization`) out.push(item as JsonLd); // organisatie staat al in index.html
    } catch {
      /* ongeldig blok overslaan */
    }
  }
  return out;
}

/** Ontdubbelen: per @type (en @id/name) één blok; de prerender-versie wint. */
function mergeSchemas(base: JsonLd[], extra: JsonLd[]): JsonLd[] {
  const key = (s: JsonLd) => {
    const t = String((s as Record<string, unknown>)["@type"] ?? "");
    // Product/Offer kan meerdere keren voorkomen (één per pakket).
    const id = (s as Record<string, unknown>)["@id"] ?? ((t === "Product" || t === "Service") ? (s as Record<string, unknown>).name : "");
    return `${t}|${id ?? ""}`;
  };
  const seen = new Set(base.map(key));
  const result = [...base];
  for (const s of extra) {
    const k = key(s);
    if (seen.has(k)) continue;
    seen.add(k);
    result.push(s);
  }
  return result;
}

interface PublishedArticle {
  slug: string;
  title: string;
  excerpt: string | null;
  content: string | null;
  category: string | null;
  published_at: string | null;
  image_url: string | null;
  seo_title: string | null;
  seo_description: string | null;
  content_reviewed_at: string | null;
}

/** Eerste alinea uit markdown-content, zonder opmaaktekens. */
function firstParagraph(content: string | null | undefined): string {
  if (!content) return "";
  const plain = resolveFiscaleTokens(content)
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_>`|]/g, "");
  const paragraph = plain
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .find((p) => p.length > 60);
  return (paragraph || plain.replace(/\s+/g, " ").trim()).slice(0, 600);
}

/**
 * Gepubliceerde artikelen via de publieke REST-endpoint. Dezelfde tabel en
 * filter als useArticles(): articles met is_published = true.
 */
async function fetchPublishedArticles(env: Record<string, string>): Promise<PublishedArticle[]> {
  const base = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
  if (!base || !key) {
    console.warn("[prerender] Geen VITE_SUPABASE_* variabelen; artikelen worden overgeslagen.");
    return [];
  }
  const url =
    `${base}/rest/v1/articles` +
    `?select=*` +
    `&is_published=eq.true&order=published_at.desc&limit=1000`;
  // Altijd vers uit de database: geen HTTP-cache tussen builds.
  const res = await fetch(url, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Cache-Control": "no-cache" },
  });
  if (!res.ok) throw new Error(`REST ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as PublishedArticle[];
}

async function fetchCategoryList(env: Record<string, string>): Promise<unknown[]> {
  const base = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
  if (!base || !key) return [];
  const res = await fetch(
    `${base}/rest/v1/article_categories?select=slug,label,hub_slug,sort_order&order=sort_order.asc`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  );
  return res.ok ? ((await res.json()) as unknown[]) : [];
}

export async function prerender(distDir: string, env: Record<string, string> = {}) {
  const templatePath = path.join(distDir, "index.html");
  if (!fs.existsSync(templatePath)) {
    console.warn("[prerender] dist/index.html ontbreekt; prerender overgeslagen.");
    return;
  }
  const template = fs.readFileSync(templatePath, "utf8");
  const written: string[] = [];

  const write = (routePath: string, html: string) => {
    // Nooit een onopgeloste fiscale placeholder in de HTML laten belanden.
    const ruw = html.match(/\{\{\s*fiscaal:[^}]{0,60}\}\}/);
    if (ruw) throw new Error(`[prerender] onopgeloste placeholder op ${routePath}: ${html.slice(Math.max(0, (ruw.index ?? 0) - 200), (ruw.index ?? 0) + 80)}`);
    const dir = path.join(distDir, routePath === "/" ? "." : routePath.replace(/^\//, ""));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "index.html"), html);
    written.push(path.posix.join(routePath === "/" ? "/" : routePath, "index.html"));
  };

  // 1. Gepubliceerde artikelen eerst: nodig voor de interne linklijsten op het
  //    kennisbankoverzicht, de categoriepagina's en de redirect-bestemmingen.
  let articles: PublishedArticle[] = [];
  try {
    articles = (await fetchPublishedArticles(env)).filter((a) => a.slug);
  } catch (error) {
    console.warn(
      `[prerender] Artikelen ophalen mislukt, build gaat door: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  // 1b. Volledige componentboom per route (SSR). Querydata wordt vooraf
  //     gevuld, zodat artikel- en categoriepagina's direct hun inhoud tonen.
  // Projectmap (waar src/ staat), onafhankelijk van de dist-map.
  const root = fileURLToPath(new URL("..", import.meta.url));
  await generateArticleImages(distDir, root, env, articles);
  const ssr = await loadSsr(root);
  const categoryList = await fetchCategoryList(env).catch(() => []);
  const basePreload: Record<string, unknown> = {
    [JSON.stringify(["articles", "Alle"])]: articles,
    [JSON.stringify(["articles", null])]: articles,
    [JSON.stringify(["article-categories"])]: [
      "Alle",
      ...[...new Set(articles.map((a) => a.category).filter(Boolean))].sort(),
    ],
    [JSON.stringify(["article-category-list"])]: categoryList,
  };
  let ssrOk = 0;
  let ssrFail = 0;
  let lastHelmetLd: JsonLd[] = [];
  const ssrBody = async (url: string, extra: Record<string, unknown> = {}): Promise<string | null> => {
    lastHelmetLd = [];
    if (!ssr) return null;
    try {
      const { html, helmet } = await ssr.render(url, { ...basePreload, ...extra });
      lastHelmetLd = helmetJsonLd(helmet?.script?.toString());
      ssrOk++;
      return html;
    } catch (error) {
      ssrFail++;
      console.warn(`[prerender] SSR mislukt voor ${url}: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  };

  /** Artikelen die bij een categoriepagina horen. */
  const articlesForHub = (hubPath: string) =>
    articles.filter((a) => categoryPageFor(a.category) === hubPath);

  // 2. Statische routes uit de registry.
  for (const route of seoRoutes as SeoRoute[]) {
    if (isExcluded(route.path)) continue;
    let extra = "";
    if (route.path === "/waarom-zp-zaken") {
      extra = renderFaqBlock(waaromFaqs.map((f) => ({ question: f.q, answer: f.a })));
    } else if (route.path === "/kennisbank") {
      extra = renderArticleLinks("Alle artikelen", articles);
    } else if (route.path.startsWith("/kennisbank/")) {
      extra = renderArticleLinks("Artikelen in deze categorie", articlesForHub(route.path));
    }
    const body = await ssrBody(route.path);
    let html = buildHtml(template, {
      routePath: route.path,
      title: formatPageTitle(route.title),
      description: route.description,
      ogType: "website",
      image: SITE_CONFIG.ogImage,
      schemas: mergeSchemas(schemasFor(route.path), lastHelmetLd),
      fallback: body ?? renderFallback(route.h1, route.intro, extra),
    });
    if (route.path === "/") {
      // Hero-beeld (LCP) vroeg laden.
      const assetsDir = path.join(distDir, "assets");
      const hero = (fs.existsSync(assetsDir) ? fs.readdirSync(assetsDir) : []).find((f) => /^team-walking-.*\.webp$/.test(f));
      if (hero) html = html.replace("</head>", `  <link rel="preload" as="image" href="/assets/${hero}" fetchpriority="high" type="image/webp" imagesizes="100vw" data-width="1600" data-height="1067">\n  </head>`);
      // Taalversies: eigen bestand met noindex,follow en zonder canonical.
      for (const lang of LANGS) {
        const body = await ssrBody(`/${lang}`);
        let langHtml = buildHtml(template, {
          routePath: `/${lang}`,
          title: formatPageTitle(route.title),
          description: route.description,
          ogType: "website",
          image: SITE_CONFIG.ogImage,
          schemas: [],
          fallback: body ?? renderFallback(route.h1, route.intro, extra),
        });
        langHtml = langHtml
          .replace(/<link rel="canonical"[^>]*>/, "")
          .replace(/<meta name="robots" content="[^"]*" \/>/, '<meta name="robots" content="noindex, follow" data-rh="true" />');
        write(`/${lang}`, langHtml);
      }
      html = html.replace("</head>", `  ${LANG_NOINDEX_GUARD}\n  </head>`);
      // dist/index.html is ook de terugval voor niet-geprerenderde routes (nieuwe
      // artikelen): daar mag geen statische canonical naar "/" staan. Alleen op het
      // echte pad "/" wordt de canonical direct bij laden gezet; elders doet de app het.
      html = html
        .replace(/\s*<link rel="canonical"[^>]*>/, "")
        .replace("</head>", `  ${HOME_CANONICAL_SCRIPT}\n  </head>`);
    }
    write(route.path, html);
  }

  // 3. Kennisbankartikelen, met de volledige body in de statische HTML.
  for (const article of articles) {
    const routePath = `/kennisbank/${article.slug}`;
    const samenvatting = (article.excerpt || "").trim();
    const alinea = firstParagraph(article.content);
    const description = (article.seo_description || samenvatting || alinea).slice(0, 300);
    const titel = article.seo_title || article.title;
    const datePublished = article.published_at || new Date().toISOString();
    // Volledige artikeltekst, veilig omgezet naar HTML met een whitelist van
    // tags en attributen (zie markdownToSafeHtml).
    const bodyHtml = markdownToSafeHtml(resolveFiscaleTokens(article.content || ""));
    // Alleen vragen uit ARTIKEL_FAQS: die worden zichtbaar op de pagina
    // beantwoord (en hieronder ook in de statische HTML gezet).
    const artikelFaqs = (ARTIKEL_FAQS[article.slug] || []).map((f) => ({
      question: resolveFiscaleTokens(f.question),
      answer: resolveFiscaleTokens(f.answer),
    }));
    const articleBody = await ssrBody(routePath, {
      [JSON.stringify(["article", article.slug])]: article,
    });
    write(
      routePath,
      buildHtml(template, {
        routePath,
        title: formatPageTitle(titel),
        description,
        ogType: "article",
        image: absoluteArticleImage(article),
        generatedImage: isGeneratedArticleImage(article),
        schemas: [
          breadcrumbForPath("/kennisbank") ?? {},
          articleSchema({
            title: titel,
            description,
            slug: article.slug,
            datePublished,
            dateModified: article.content_reviewed_at || datePublished,
            image: absoluteArticleImage(article),
            category: article.category || "Kennisbank",
          }),
          ...(artikelFaqs.length ? [faqSchema(artikelFaqs)] : []),
          ...lastHelmetLd,
        ].filter((s) => Object.keys(s).length > 0).reduce<JsonLd[]>((acc, s) => mergeSchemas(acc, [s]), []),
        fallback: articleBody ?? renderFallback(
          article.title,
          samenvatting || alinea,
          [
            `<img src="${esc(absoluteArticleImage(article))}" alt="${esc(article.title)}" width="1200" height="630">`,
            `<article>${bodyHtml}</article>`,
            renderFaqBlock(artikelFaqs),
            renderArticleLinks(
              "Verder lezen",
              articles.filter((a) => a.slug !== article.slug).slice(0, 6),
            ),
          ].join(""),
        ),
      }),
    );
  }
  console.log(`[prerender] ${articles.length} kennisbankartikelen geprerenderd (volledige body).`);
  await ssr?.close();
  console.log(`[prerender] SSR: ${ssrOk} pagina's volledig gerenderd, ${ssrFail} met fallback.`);

  // 4. Redirect-stubs voor legacy WordPress-URL's. De hosting voert _redirects
  //    niet uit; deze statische pagina's doen het werk met canonical + refresh.
  const articleIndex = new Map<string, ArticleRedirectInfo>(
    articles.map((a) => [a.slug, { slug: a.slug, category: a.category, is_published: true }]),
  );
  const routePaths = new Set((seoRoutes as SeoRoute[]).map((r) => r.path));
  let stubs = 0;
  // Oude WordPress-artikel-URL's /<slug>/ en /blog/<slug>/ → /kennisbank/<slug>.
  const legacyFrom = new Set(legacyRedirects.map((r) => r.from));
  const articleStubs = articles.flatMap((a) =>
    [a.slug, `blog/${a.slug}`]
      .filter((from) => !legacyFrom.has(from))
      .map((from) => ({ from, to: `/kennisbank/${a.slug}` })),
  );
  for (const redirect of [...legacyRedirects, ...articleStubs]) {
    const routePath = `/${redirect.from}`;
    // Nooit een bestaande route overschrijven. Let op: een artikel met dezelfde
    // slug staat op /kennisbank/<slug>, niet op /<slug>; de oude URL heeft dus
    // juist wél een stub nodig.
    if (routePaths.has(routePath)) continue;
    const to = resolveRedirectTarget(redirect, articleIndex);
    const dir = path.join(distDir, redirect.from);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "index.html"), redirectStubHtml(redirect.from, to));
    stubs++;
  }
  console.log(`[prerender] ${stubs} redirect-stubs geschreven.`);

  // 4b. Oude WordPress/Yoast-sitemaps → index die naar /sitemap.xml wijst.
  //     Statische hosting kan geen 301 voor .xml geven; een sitemapindex is
  //     voor Google het equivalent.
  const sitemapIndexXml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    `  <sitemap><loc>${SITE_CONFIG.url}/sitemap.xml</loc></sitemap>`,
    "</sitemapindex>",
    "",
  ].join("\n");
  for (const name of ["sitemap_index.xml", "post-sitemap.xml", "page-sitemap.xml", "category-sitemap.xml", "post_tag-sitemap.xml", "author-sitemap.xml", "wp-sitemap.xml"]) {
    fs.writeFileSync(path.join(distDir, name), sitemapIndexXml);
  }

  // 5. Gemigreerde WordPress-media onder hetzelfde pad meeleveren, zodat oude
  //    /wp-content/uploads/... URL's blijven werken zonder hosting-redirects.
  const base = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
  if (base && key) {
    try {
      const files = await listStorageFiles(base, key, "article-images", "wp-content/uploads/");
      let copied = 0;
      for (const file of files) {
        const res = await fetch(
          `${base}/storage/v1/object/public/article-images/${file
            .split("/")
            .map(encodeURIComponent)
            .join("/")}`,
        );
        if (!res.ok) {
          console.warn(`[prerender] media niet gekopieerd (${res.status}): ${file}`);
          continue;
        }
        const target = path.join(distDir, file);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, Buffer.from(await res.arrayBuffer()));
        copied++;
      }
      console.log(`[prerender] ${copied}/${files.length} WordPress-mediabestanden meegeleverd.`);
    } catch (error) {
      console.warn(
        `[prerender] WAARSCHUWING: media meeleveren mislukt: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  // 6. Statische sitemap.xml, generated uit dezelfde bron als de pagina's. De
  //    dynamische Edge Function blijft leidend via robots.txt, maar deze versie
  //    werkt ook zonder hosting-rewrites en loopt nooit achter op de build.
  // lastmod: artikelen uit content_reviewed_at of published_at; pagina's uit de
  // laatste commit van het paginabestand. Onbekend = geen lastmod (nooit "vandaag").
  const sources = routeSourceFiles(root);
  const sitemapEntries = [
    ...(seoRoutes as SeoRoute[])
      .filter((r) => !isExcluded(r.path))
      .map((r) => ({
        loc: `${SITE_CONFIG.url}${r.path === "/" ? "/" : r.path}`,
        lastmod: gitDate(root, sources.get(r.path) ?? ["src/config/seoRoutes.ts"]),
      })),
    ...articles.map((a) => {
      const lastmod = (a.content_reviewed_at || a.published_at || "").slice(0, 10) || null;
      return { loc: `${SITE_CONFIG.url}/kennisbank/${a.slug}`, lastmod };
    }),
  ] as { loc: string; lastmod: string | null }[];
  const seen = new Set<string>();
  const sitemapXml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...sitemapEntries
      .filter((e) => (seen.has(e.loc) ? false : (seen.add(e.loc), true)))
      .map(
        (e) =>
          `  <url><loc>${esc(e.loc)}</loc>${e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : ""}</url>`,
      ),
    "</urlset>",
    "",
  ].join("\n");
  fs.writeFileSync(path.join(distDir, "sitemap.xml"), sitemapXml);
  console.log(`[prerender] sitemap.xml geschreven met ${seen.size} URL's.`);

  // 6b. Controle: elke sitemap-URL is een echte pagina (geen redirect-stub, geen
  //     noindex, geen beheer/portaal) met een canonical naar precies die URL.
  const sitemapFouten: string[] = [];
  for (const loc of seen) {
    const pad = loc.slice(SITE_CONFIG.url.length) || "/";
    if (/^\/(admin|portal|mijn-zp)(\/|$)/.test(pad)) { sitemapFouten.push(`${pad}: afgeschermd pad`); continue; }
    const file = path.join(distDir, pad === "/" ? "index.html" : path.join(pad, "index.html"));
    if (!fs.existsSync(file)) { sitemapFouten.push(`${pad}: geen HTML-bestand`); continue; }
    const html = fs.readFileSync(file, "utf8");
    if (/http-equiv="refresh"/i.test(html)) sitemapFouten.push(`${pad}: redirect`);
    if (/<meta name="robots" content="[^"]*noindex/i.test(html)) sitemapFouten.push(`${pad}: noindex`);
    const canon = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
    if (pad !== "/" && canon !== loc) sitemapFouten.push(`${pad}: canonical ${canon ?? "ontbreekt"}`);
  }
  if (sitemapFouten.length) {
    throw new Error(`[prerender] sitemap bevat ${sitemapFouten.length} ongeldige URL's:\n${sitemapFouten.join("\n")}`);
  }
  console.log(`[prerender] sitemapcontrole: alle ${seen.size} URL's 200, self-canonical, zonder noindex.`);

  // 7. llms.txt en llms-full.txt uit dezelfde bronnen als de pagina's.
  const publicRoutes = (seoRoutes as SeoRoute[]).filter((r) => !isExcluded(r.path));
  fs.writeFileSync(path.join(distDir, "llms.txt"), buildLlmsTxt(publicRoutes, articles));
  fs.writeFileSync(path.join(distDir, "llms-full.txt"), buildLlmsFullTxt(publicRoutes));
  console.log("[prerender] llms.txt en llms-full.txt geschreven.");

  console.log(`[prerender] ${written.length} HTML-bestanden gegenereerd.`);
  console.log(`[prerender] voorbeeld: ${written.slice(0, 2).join(", ")}`);
}

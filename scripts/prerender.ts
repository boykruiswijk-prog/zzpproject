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
import { seoRoutes, PRERENDER_EXCLUDE_PREFIXES, type SeoRoute } from "../src/config/seoRoutes";
import { SITE_CONFIG } from "../src/config/site";
import { bavPakketten } from "../src/data/bavPakketten";
import { faqItems } from "../src/data/faqItems";
import { ARTIKEL_FAQS } from "../src/config/artikelFaqs";
import { waaromFaqs } from "../src/config/waaromFaqs";
import { formatPageTitle } from "../src/lib/seoTitle";
import { resolveFiscaleTokens } from "../src/lib/fiscaleTokens";
import { markdownToSafeHtml } from "./markdownToSafeHtml";
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

/**
 * Pagina-specifieke deelafbeelding per route, op basis van de bronbestandsnaam
 * in src/assets. De gehashte bestandsnaam in dist/assets wordt bij de build
 * opgezocht; is die er niet, dan valt de route terug op SITE_CONFIG.ogImage.
 */
const ROUTE_OG_IMAGES: Record<string, string> = {
  "/": "hero-corporate",
  "/verzekeringen": "service-verzekeringen",
  "/aov": "service-verzekeringen",
  "/creditcontrol": "creditcontrol-hero",
  "/over-ons": "team-cheers",
  "/historie": "zp-logo-glass",
  "/partners": "office-logo",
  "/contact": "team-boy-calling",
  "/zo-werken-wij": "zp-boy-laptop",
  "/waarom-zp-zaken": "office-coffee",
};

/** Gehashte assetnaam in dist/assets voor een bronbestandsnaam zonder extensie. */
function buildAssetLookup(distDir: string): Map<string, string> {
  const map = new Map<string, string>();
  const dir = path.join(distDir, "assets");
  if (!fs.existsSync(dir)) return map;
  for (const file of fs.readdirSync(dir)) {
    // Alleen afbeeldingen: gelijknamige JS-chunks mogen nooit als og-image
    // gekozen worden.
    if (!/\.(webp|jpg|jpeg|png)$/i.test(file)) continue;
    const base = file.replace(/-[A-Za-z0-9_]{8,}\.[a-z0-9]+$/, "");
    if (base && !map.has(base)) map.set(base, `/assets/${file}`);
  }
  return map;
}

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
  const alternates = [
    `<link rel="alternate" hreflang="nl" href="${SITE_CONFIG.url}${routePath === "/" ? "/" : routePath}">`,
    ...LANGS.map(
      (lang) =>
        `<link rel="alternate" hreflang="${lang}" href="${SITE_CONFIG.url}/${lang}${
          routePath === "/" ? "" : routePath
        }">`,
    ),
    `<link rel="alternate" hreflang="x-default" href="${SITE_CONFIG.url}${
      routePath === "/" ? "/" : routePath
    }">`,
  ];
  return {
    url,
    tags: [
      `<link rel="canonical" href="${url}">`,
      ...alternates,
      `<meta name="twitter:title" content="${esc(title)}">`,
      `<meta name="twitter:description" content="${esc(description)}">`,
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
    <link rel="canonical" href="${esc(target)}" />
    <meta http-equiv="refresh" content="0;url=${esc(to)}" />
    <meta name="robots" content="noindex, follow" />
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

function buildHtml(
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
      /<meta property="og:image" content="[\s\S]*?" \/>/,
      `<meta property="og:image" content="${esc(opts.image)}" data-rh="true" />`,
    );
    html = html.replace(
      /<meta name="twitter:image" content="[\s\S]*?" \/>/,
      `<meta name="twitter:image" content="${esc(opts.image)}" data-rh="true" />`,
    );
  }
  const jsonLd = opts.schemas
    .map((s) => `<script type="application/ld+json">${JSON.stringify(s)}</script>`)
    .join("\n    ");
  html = html.replace("</head>", `  ${tags}\n    ${jsonLd}\n  </head>`);
  html = html.replace('<div id="root"></div>', `<div id="root">\n      ${opts.fallback}\n    </div>`);
  return html;
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
    `?select=slug,title,excerpt,content,category,published_at,image_url,seo_title,seo_description` +
    `&is_published=eq.true&order=published_at.desc&limit=1000`;
  const res = await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!res.ok) throw new Error(`REST ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as PublishedArticle[];
}

export async function prerender(distDir: string, env: Record<string, string> = {}) {
  const templatePath = path.join(distDir, "index.html");
  if (!fs.existsSync(templatePath)) {
    console.warn("[prerender] dist/index.html ontbreekt; prerender overgeslagen.");
    return;
  }
  const template = fs.readFileSync(templatePath, "utf8");
  const assets = buildAssetLookup(distDir);
  const written: string[] = [];

  /** Absolute URL van de route-specifieke deelafbeelding, of undefined. */
  const ogImageFor = (routePath: string): string | undefined => {
    const base = ROUTE_OG_IMAGES[routePath];
    const asset = base ? assets.get(base) : undefined;
    return asset ? `${SITE_CONFIG.url}${asset}` : undefined;
  };

  const write = (routePath: string, html: string) => {
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
    write(
      route.path,
      buildHtml(template, {
        routePath: route.path,
        title: formatPageTitle(route.title),
        description: route.description,
        ogType: "website",
        image: ogImageFor(route.path),
        schemas: schemasFor(route.path),
        fallback: renderFallback(route.h1, route.intro, extra),
      }),
    );
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
    write(
      routePath,
      buildHtml(template, {
        routePath,
        title: formatPageTitle(titel),
        description,
        ogType: "article",
        image: article.image_url || undefined,
        schemas: [
          breadcrumbForPath("/kennisbank") ?? {},
          articleSchema({
            title: titel,
            description,
            slug: article.slug,
            datePublished,
            dateModified: article.content_reviewed_at || datePublished,
            image: article.image_url || undefined,
            category: article.category || "Kennisbank",
          }),
          ...(artikelFaqs.length ? [faqSchema(artikelFaqs)] : []),
        ].filter((s) => Object.keys(s).length > 0),
        fallback: renderFallback(
          article.title,
          samenvatting || alinea,
          [
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

  // 4. Redirect-stubs voor legacy WordPress-URL's. De hosting voert _redirects
  //    niet uit; deze statische pagina's doen het werk met canonical + refresh.
  const articleIndex = new Map<string, ArticleRedirectInfo>(
    articles.map((a) => [a.slug, { slug: a.slug, category: a.category, is_published: true }]),
  );
  const routePaths = new Set((seoRoutes as SeoRoute[]).map((r) => r.path));
  let stubs = 0;
  for (const redirect of legacyRedirects) {
    const routePath = `/${redirect.from}`;
    // Nooit een bestaande route of geprerenderd artikel overschrijven.
    if (routePaths.has(routePath) || articleIndex.has(redirect.from)) continue;
    const to = resolveRedirectTarget(redirect, articleIndex);
    const dir = path.join(distDir, redirect.from);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "index.html"), redirectStubHtml(redirect.from, to));
    stubs++;
  }
  console.log(`[prerender] ${stubs} redirect-stubs geschreven.`);

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

  console.log(`[prerender] ${written.length} HTML-bestanden gegenereerd.`);
  console.log(`[prerender] voorbeeld: ${written.slice(0, 2).join(", ")}`);
}

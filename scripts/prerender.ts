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
import {
  articleSchema,
  breadcrumbForPath,
  faqSchema,
  productSchema,
  type JsonLd,
} from "../src/lib/schema";

const LANGS = ["en", "de", "fr"] as const;

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

function buildHtml(
  template: string,
  opts: {
    routePath: string;
    title: string;
    description: string;
    ogType: string;
    schemas: JsonLd[];
    fallback: string;
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
}

/** Eerste alinea uit markdown-content, zonder opmaaktekens. */
function firstParagraph(content: string | null | undefined): string {
  if (!content) return "";
  const plain = content
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
  const written: string[] = [];

  const write = (routePath: string, html: string) => {
    const dir = path.join(distDir, routePath === "/" ? "." : routePath.replace(/^\//, ""));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "index.html"), html);
    written.push(path.posix.join(routePath === "/" ? "/" : routePath, "index.html"));
  };

  // 1. Statische routes uit de registry.
  for (const route of seoRoutes as SeoRoute[]) {
    if (isExcluded(route.path)) continue;
    write(
      route.path,
      buildHtml(template, {
        routePath: route.path,
        title: route.title,
        description: route.description,
        ogType: route.path === "/" ? "website" : "website",
        schemas: schemasFor(route.path),
        fallback: renderFallback(route.h1, route.intro),
      }),
    );
  }

  // 2. Kennisbankartikelen. Faalt de fetch, dan alleen waarschuwen.
  try {
    const articles = await fetchPublishedArticles(env);
    for (const article of articles) {
      if (!article.slug) continue;
      const routePath = `/kennisbank/${article.slug}`;
      const samenvatting = (article.excerpt || "").trim();
      const alinea = firstParagraph(article.content);
      const description = (article.seo_description || samenvatting || alinea).slice(0, 300);
      const titel = article.seo_title || article.title;
      const datePublished = article.published_at || new Date().toISOString();
      write(
        routePath,
        buildHtml(template, {
          routePath,
          title: `${titel} | Kennisbank | ZP Zaken`,
          description,
          ogType: "article",
          schemas: [
            breadcrumbForPath("/kennisbank") ?? {},
            articleSchema({
              title: titel,
              description,
              slug: article.slug,
              datePublished,
              dateModified: datePublished,
              image: article.image_url || undefined,
              category: article.category || "Kennisbank",
            }),
          ].filter((s) => Object.keys(s).length > 0),
          fallback: renderFallback(
            article.title,
            samenvatting || alinea,
            samenvatting && alinea ? `<p>${esc(alinea)}</p>` : "",
          ),
        }),
      );
    }
    console.log(`[prerender] ${articles.length} kennisbankartikelen geprerenderd.`);
  } catch (error) {
    console.warn(
      `[prerender] Artikelen ophalen mislukt, build gaat door: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  console.log(`[prerender] ${written.length} HTML-bestanden gegenereerd.`);
  console.log(`[prerender] voorbeeld: ${written.slice(0, 2).join(", ")}`);
}

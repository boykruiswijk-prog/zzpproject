import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";
import {
  legacyRedirects,
  resolveRedirectTarget,
  type ArticleRedirectInfo,
} from "./src/config/legacyRedirects";

const SITEMAP_FUNCTION_URL = "https://eugkavokktjwpqaqlwsj.supabase.co/functions/v1/sitemap";

/** Storage-bucket waarin de gemigreerde WordPress-media staat. */
const MEDIA_BUCKET = "article-images";

/**
 * Slug → publicatiestatus + categorie, live uit de database. Faalt de fetch,
 * dan een lege map: resolveRedirectTarget() valt dan terug op de handmatige
 * bestemming uit legacyRedirects.ts.
 */
async function fetchArticleIndex(
  env: Record<string, string>,
): Promise<Map<string, ArticleRedirectInfo>> {
  const base = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
  const map = new Map<string, ArticleRedirectInfo>();
  if (!base || !key) {
    console.warn(
      "[redirects] WAARSCHUWING: geen VITE_SUPABASE_* variabelen. " +
        "Redirects vallen terug op de handmatige lijst in legacyRedirects.ts.",
    );
    return map;
  }
  try {
    const res = await fetch(
      `${base}/rest/v1/articles?select=slug,category,is_published&limit=2000`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } },
    );
    if (!res.ok) throw new Error(`REST ${res.status}: ${(await res.text()).slice(0, 200)}`);
    for (const row of (await res.json()) as ArticleRedirectInfo[]) {
      if (row.slug) map.set(row.slug, row);
    }
  } catch (error) {
    console.warn(
      "[redirects] WAARSCHUWING: artikelen ophalen mislukt " +
        `(${error instanceof Error ? error.message : String(error)}). ` +
        "Redirects vallen terug op de handmatige lijst in legacyRedirects.ts.",
    );
  }
  return map;
}

/**
 * Genereert public/_redirects uit src/config/legacyRedirects.ts, waarbij de
 * bestemming van een legacy-URL met bijbehorend kennisbankartikel automatisch
 * meebeweegt met de publicatiestatus van dat artikel.
 */
function redirectsPlugin(env: Record<string, string>): Plugin {
  return {
    name: "zp-generate-redirects",
    async buildStart() {
      const articles = await fetchArticleIndex(env);
      const storageBase = env.VITE_SUPABASE_URL
        ? `${env.VITE_SUPABASE_URL}/storage/v1/object/public/${MEDIA_BUCKET}`
        : null;

      const rules = legacyRedirects.map((r) => {
        const to = resolveRedirectTarget(r, articles);
        const article = articles.get(r.from);
        const note = !article
          ? ""
          : article.is_published
            ? "  # gepubliceerd artikel"
            : "  # concept → categoriepagina";
        return `/${r.from}    ${to}    301${note}`;
      });

      const lines = [
        "# Automatisch gegenereerd door vite (zie src/config/legacyRedirects.ts).",
        "# Niet handmatig aanpassen.",
        "",
        `/sitemap.xml    ${SITEMAP_FUNCTION_URL}    200`,
        "",
        "# Oude WordPress-media staan onder hetzelfde pad in de storage-bucket.",
        ...(storageBase
          ? [`/wp-content/uploads/*    ${storageBase}/wp-content/uploads/:splat    301`]
          : ["# WAARSCHUWING: geen VITE_SUPABASE_URL, media-redirect overgeslagen."]),
        "",
        ...rules,
        "",
        "# Pad met afsluitende slash → zelfde pad zonder slash (homepage uitgezonderd).",
        "/:path/    /:path    301!",
        "",
        "# SPA-fallback: moet als laatste staan, na alle 301-regels.",
        "/*    /index.html    200",
        "",
      ];
      fs.mkdirSync(path.resolve(__dirname, "public"), { recursive: true });
      fs.writeFileSync(path.resolve(__dirname, "public/_redirects"), lines.join("\n"));
      console.log(
        `[redirects] ${rules.length} legacy-regels geschreven` +
          (articles.size ? ` (${articles.size} artikelen uit de database).` : " (terugvallijst)."),
      );
    },
  };
}

/**
 * Schrijft na de build per publieke route een statische HTML met de juiste head
 * en echte tekst, zodat crawlers zonder JavaScript geen lege shell zien.
 */
function prerenderPlugin(env: Record<string, string>): Plugin {
  return {
    name: "zp-prerender",
    apply: "build",
    async closeBundle() {
      const { prerender } = await import("./scripts/prerender");
      await prerender(path.resolve(__dirname, "dist"), env);
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  optimizeDeps: {
    force: true,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    mcpPlugin(),
    redirectsPlugin(env),
    prerenderPlugin(env),
  ].filter(Boolean),

  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // Grote libraries in eigen chunks, zodat ze niet in de entry landen.
        manualChunks(id: string) {
          // Vite's preload-helper en de kleine gedeelde utils horen bij de
          // entry; anders trekt de entry een zware vendorchunk mee.
          if (id.includes("commonjsHelpers") || id.includes("vite/preload-helper") || id.includes("vite/modulepreload")) return "vendor-react";
          if (!id.includes("node_modules")) return;
          if (/[\\/]node_modules[\\/](clsx|tailwind-merge|class-variance-authority|react-is|use-sync-external-store|object-assign|tslib)[\\/]/.test(id))
            return "vendor-react";
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return "vendor-react";
          if (id.includes("react-router")) return "vendor-router";
          if (id.includes("@tanstack")) return "vendor-query";
          if (id.includes("@supabase")) return "vendor-supabase";
          if (id.includes("i18next")) return "vendor-i18n";
          if (id.includes("@radix-ui") || id.includes("lucide-react") || id.includes("cmdk")) return "vendor-ui";
          // Overige dependencies blijven bij de chunk die ze importeert, zodat
          // ze de lazy-grens niet doorbreken en niet in de entry belanden.
          return undefined;
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  };
});

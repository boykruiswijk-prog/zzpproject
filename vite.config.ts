import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";
import { legacyRedirects } from "./src/config/legacyRedirects";

const SITEMAP_FUNCTION_URL = "https://eugkavokktjwpqaqlwsj.supabase.co/functions/v1/sitemap";

/** Genereert public/_redirects (Netlify-formaat) uit src/config/legacyRedirects.ts. */
function redirectsPlugin(): Plugin {
  return {
    name: "zp-generate-redirects",
    buildStart() {
      const lines = [
        "# Automatisch gegenereerd door vite (zie src/config/legacyRedirects.ts).",
        "# Niet handmatig aanpassen.",
        "",
        `/sitemap.xml    ${SITEMAP_FUNCTION_URL}    200`,
        "",
        ...legacyRedirects.map((r) => `/${r.from}    ${r.to}    301`),
        "",
      ];
      fs.mkdirSync(path.resolve(__dirname, "public"), { recursive: true });
      fs.writeFileSync(path.resolve(__dirname, "public/_redirects"), lines.join("\n"));
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
    redirectsPlugin(),
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
          if (id.includes("commonjsHelpers") || id.includes("commonjs-proxy") || id.includes("vite/preload-helper") || id.includes("vite/modulepreload")) return "vendor-react";
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

import { defineConfig, type Plugin } from "vite";
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

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
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
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));

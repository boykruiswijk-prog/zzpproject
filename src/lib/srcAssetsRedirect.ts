import { zoekLegacyDoel } from "@/config/legacyRedirects";

// Vite includes every remaining source asset, including otherwise unused files.
export const srcAssetUrls = import.meta.glob<string>("/src/assets/**/*", {
  eager: true,
  query: "?url&no-inline",
  import: "default",
});

export function zoekSrcAssetDoel(pad: string): string | null {
  const expliciet = zoekLegacyDoel(pad);
  if (expliciet) return expliciet;
  const bron = pad.replace(/^\/(?:en|de|fr)(?=\/)/, "").replace(/\/+$/, "");
  return Object.hasOwn(srcAssetUrls, bron) ? srcAssetUrls[bron] : null;
}
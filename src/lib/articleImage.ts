import { SITE_CONFIG } from "../config/site";

export interface ArticleImageSource { slug: string; image_url?: string | null }

/** Merkafbeelding die altijd in de build staat; laatste vangnet. */
export const BRAND_FALLBACK_IMAGE = "/og/zpzaken-og-2026.jpg";

/** Existing images always win; fallback files are generated during the build. */
export function articleImage(article: ArticleImageSource): string {
  return article.image_url || `/images/kennisbank/${encodeURIComponent(article.slug)}.png`;
}

/** Huisstijlafbeelding (build of storage/generated): 1200x630 typografisch ontwerp. */
export function isGeneratedArticleImage(article: ArticleImageSource): boolean {
  return !article.image_url || article.image_url.includes("/article-images/generated/");
}

export function isArticleIllustration(article: ArticleImageSource): boolean {
  return Boolean(article.image_url?.includes('/article-images/generated/') && article.image_url.endsWith('-illustration.png'));
}

export function absoluteArticleImage(article: ArticleImageSource): string {
  return new URL(articleImage(article), `${SITE_CONFIG.url}/`).href;
}

/** Paired OG composition exists only for the new AI illustrations. */
export function absoluteArticleOgImage(article: ArticleImageSource): string {
  const image = absoluteArticleImage(article);
  return image.includes('/article-images/generated/') && image.endsWith('-illustration.png')
    ? image.replace(/-illustration\.png$/, '-og.png') : image;
}

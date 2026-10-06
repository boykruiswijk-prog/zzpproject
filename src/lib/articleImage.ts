import { SITE_CONFIG } from "../config/site";

export interface ArticleImageSource { slug: string; image_url?: string | null }

/** Existing images always win; fallback files are generated during the build. */
export function articleImage(article: ArticleImageSource): string {
  return article.image_url || `/images/kennisbank/${encodeURIComponent(article.slug)}.png`;
}

export function absoluteArticleImage(article: ArticleImageSource): string {
  return new URL(articleImage(article), `${SITE_CONFIG.url}/`).href;
}
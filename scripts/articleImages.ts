import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
// Geen React-import: die zou React in productiemodus laden vóór de SSR-prerender
// (development) en daarmee de render laten crashen. Satori accepteert gewone objecten.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createElement(type: string, props: Record<string, unknown> | null, ...children: unknown[]): any {
  const kids = children.flat().filter((c) => c !== null && c !== undefined && c !== false);
  return { type, key: null, props: { ...(props ?? {}), children: kids.length === 0 ? undefined : kids.length === 1 ? kids[0] : kids } };
}
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import postgres from "postgres";
import { categoryDesign } from "../supabase/functions/artikel-afbeelding/design";

export interface ImageArticle {
  slug: string; title: string; category: string | null; image_url: string | null;
}

const require = createRequire(import.meta.url);
const fonts = ([700, 800] as const).map((weight) => ({
  name: "Plus Jakarta Sans",
  data: fs.readFileSync(require.resolve(`@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-${weight}-normal.woff`)),
  weight, style: "normal" as const,
}));

export async function renderArticleImage(article: ImageArticle, root: string): Promise<Buffer> {
  const palette = categoryDesign(article.category);
  const logo = fs.readFileSync(path.join(root, "public/logo.png"));
  const svg = await satori(createElement("div", { style: {
    width: 1200, height: 630, display: "flex", flexDirection: "column",
    padding: "110px 110px 0", position: "relative",
    backgroundColor: palette.background,
    fontFamily: "Plus Jakarta Sans",
  } },
  ...[0, 1, 2, 3, 4].map((i) => createElement("div", { style: {
    position: "absolute", right: 40 + i * 70, top: 35 + i * 50, width: 340, height: 340,
    border: `2px solid ${palette.accent}`, opacity: 0.08, transform: `rotate(${15 + i * 7}deg)`,
  } })),
  createElement("div", { style: {
    fontSize: 26, fontWeight: 700, letterSpacing: "0.12em", color: palette.accent,
  } }, (article.category || "KENNISBANK").toUpperCase()),
  createElement("div", { style: {
    display: "block", marginTop: 28, fontSize: 60, fontWeight: 800,
    lineHeight: 1.05, letterSpacing: 0, color: palette.ink,
    lineClamp: 3, textOverflow: "ellipsis", overflow: "hidden", maxHeight: 189,
    wordBreak: "break-word",
  } }, article.title),
  createElement("img", { src: `data:image/png;base64,${logo.toString("base64")}`, height: 56,
    style: { position: "absolute", left: 110, bottom: 60, height: 56, objectFit: "contain" } }),
  createElement("div", { style: {
    position: "absolute", right: 110, bottom: 60, fontSize: 28, fontWeight: 700, color: palette.ink,
  } }, "zpzaken.nl")), { width: 1200, height: 630, fonts });
  return new Resvg(svg).render().asPng();
}

/** Build-only read of draft metadata; never expose credentials or draft content. */
export async function generateArticleImages(distDir: string, root: string, env: Record<string, string>, published: ImageArticle[]) {
  const databaseUrl = process.env.SUPABASE_DB_URL || env.SUPABASE_DB_URL;
  // Zonder beveiligde buildverbinding (bijv. publicatiebuild) alleen gepubliceerde
  // artikelen; de bouw mag hierdoor nooit mislukken.
  let drafts: ImageArticle[] = [];
  if (!databaseUrl) {
    console.warn("[article-images] Geen buildverbinding; conceptafbeeldingen overgeslagen.");
  } else {
    const sql = postgres(databaseUrl, { max: 1, connect_timeout: 15 });
    try {
      drafts = await sql<ImageArticle[]>`select slug, title, category, image_url from public.articles where is_published = false`;
    } catch {
      console.warn("[article-images] Conceptmetadata niet leesbaar; conceptafbeeldingen overgeslagen.");
    } finally { await sql.end().catch(() => {}); }
  }
  const output = path.join(distDir, "images/kennisbank");
  fs.mkdirSync(output, { recursive: true });
  let count = 0;
  for (const article of [...published, ...drafts]) {
    if (!article.slug) continue;
    if (!/^[\p{L}\p{N}_-]+$/u.test(article.slug)) throw new Error("[article-images] Ongeldige artikelslug.");
    if (article.image_url) {
      const url = new URL(article.image_url, 'https://zpzaken.nl');
      const response = await fetch(url);
      const contentType = response.headers.get('content-type') ?? '';
      if (!response.ok || !contentType.startsWith('image/')) throw new Error(`[article-images] Afbeelding niet bereikbaar: ${article.slug}`);
      const image = Buffer.from(await response.arrayBuffer());
      if (!image.length) throw new Error(`[article-images] Lege afbeelding: ${article.slug}`);
      const extension = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
      fs.writeFileSync(path.join(output, `${article.slug}.${extension}`), image);
      if (article.image_url.includes('/article-images/generated/') && article.image_url.endsWith('-illustration.png')) {
        const og = await fetch(article.image_url.replace(/-illustration\.png$/, '-og.png'));
        if (!og.ok || !og.headers.get('content-type')?.startsWith('image/')) throw new Error(`[article-images] Deelbeeld ontbreekt: ${article.slug}`);
        fs.writeFileSync(path.join(output, `${article.slug}-og.png`), Buffer.from(await og.arrayBuffer()));
      }
      continue;
    }
    fs.writeFileSync(path.join(output, `${article.slug}.png`), await renderArticleImage(article, root));
    count++;
  }
  // Harde controle: elk gepubliceerd artikel heeft een eigen image_url of een
  // bestand in de build. Anders faalt de build (nooit een kapotte afbeelding live).
  const ontbrekend = published.filter((a) => a.slug && !a.image_url && !fs.existsSync(path.join(output, `${a.slug}.png`)));
  if (ontbrekend.length) throw new Error(`[article-images] Afbeelding ontbreekt voor: ${ontbrekend.map((a) => a.slug).join(", ")}`);
  console.log(`[article-images] Controle: alle ${published.length} gepubliceerde artikelen hebben een afbeelding.`);
  console.log(`[article-images] ${count} PNG-afbeeldingen gemaakt (1200x630, inclusief concepten).`);
}
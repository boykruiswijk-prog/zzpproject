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

export interface ImageArticle {
  slug: string; title: string; category: string | null; image_url: string | null;
}

const require = createRequire(import.meta.url);
const palette = {
  backgroundStart: "#1F2D47", backgroundEnd: "#16213A",
  accent: "#EE3E2C", glow: "rgba(238,62,44,0.13)",
  title: "#FFFFFF", footer: "#B8C2D6",
};
const fonts = ([700, 800] as const).map((weight) => ({
  name: "Plus Jakarta Sans",
  data: fs.readFileSync(require.resolve(`@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-${weight}-normal.woff`)),
  weight, style: "normal" as const,
}));

export async function renderArticleImage(article: ImageArticle, root: string): Promise<Buffer> {
  const logo = fs.readFileSync(path.join(root, "public/logo.png"));
  const svg = await satori(createElement("div", { style: {
    width: 1200, height: 630, display: "flex", flexDirection: "column",
    padding: "110px 110px 0", position: "relative",
    backgroundImage: `linear-gradient(160deg, ${palette.backgroundStart}, ${palette.backgroundEnd})`,
    fontFamily: "Plus Jakarta Sans",
  } },
  createElement("div", { style: {
    position: "absolute", top: 0, right: 0, width: 800, height: 630,
    backgroundImage: `radial-gradient(ellipse at top right, ${palette.glow}, transparent 70%)`,
  } }),
  createElement("div", { style: {
    fontSize: 26, fontWeight: 700, letterSpacing: "0.12em", color: palette.accent,
  } }, (article.category || "KENNISBANK").toUpperCase()),
  createElement("div", { style: {
    display: "block", marginTop: 28, fontSize: 60, fontWeight: 800,
    lineHeight: 1.05, letterSpacing: "-0.02em", color: palette.title,
    lineClamp: 3, textOverflow: "ellipsis", overflow: "hidden", maxHeight: 189,
    wordBreak: "break-word",
  } }, article.title),
  createElement("img", { src: `data:image/png;base64,${logo.toString("base64")}`, height: 56,
    style: { position: "absolute", left: 110, bottom: 60, height: 56, objectFit: "contain" } }),
  createElement("div", { style: {
    position: "absolute", right: 110, bottom: 60, fontSize: 28, fontWeight: 700, color: palette.footer,
  } }, "zpzaken.nl")), { width: 1200, height: 630, fonts });
  return new Resvg(svg).render().asPng();
}

/** Build-only read of draft metadata; never expose credentials or draft content. */
export async function generateArticleImages(distDir: string, root: string, env: Record<string, string>, published: ImageArticle[]) {
  const databaseUrl = process.env.SUPABASE_DB_URL || env.SUPABASE_DB_URL;
  if (!databaseUrl) throw new Error("[article-images] Beveiligde buildverbinding ontbreekt; conceptafbeeldingen kunnen niet worden gemaakt.");
  const sql = postgres(databaseUrl, { max: 1, connect_timeout: 15 });
  let drafts: ImageArticle[];
  try {
    drafts = await sql<ImageArticle[]>`select slug, title, category, image_url from public.articles where is_published = false`;
  } catch {
    throw new Error("[article-images] Conceptmetadata kon niet veilig worden gelezen.");
  } finally { await sql.end(); }
  const output = path.join(distDir, "images/kennisbank");
  fs.mkdirSync(output, { recursive: true });
  let count = 0;
  for (const article of [...published, ...drafts]) {
    if (article.image_url || !article.slug) continue;
    if (!/^[\p{L}\p{N}_-]+$/u.test(article.slug)) throw new Error("[article-images] Ongeldige artikelslug.");
    fs.writeFileSync(path.join(output, `${article.slug}.png`), await renderArticleImage(article, root));
    count++;
  }
  console.log(`[article-images] ${count} PNG-afbeeldingen gemaakt (1200x630, inclusief concepten).`);
}
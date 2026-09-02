// deno-lint-ignore-file no-explicit-any
// Zet WordPress/Elementor-HTML om naar markdown (articles.content is markdown,
// gerenderd met react-markdown + remark-gfm). Koppen, lijsten, tabellen en
// links blijven behouden.
import { parse } from "https://esm.sh/node-html-parser@6.1.13";

const NOISE_CLASS =
  /(elementor-widget-(button|form|nav-menu|breadcrumbs|share-buttons|post-navigation|sidebar|author-box|google_maps|shortcode)|elementor-location-(header|footer)|elementor-shape|screen-reader-text|skip-link|jet-|wpcf7|cookie)/i;

export interface ConvertResult {
  markdown: string;
  images: string[];
  wordCount: number;
}

export interface LinkRewriter {
  (href: string): string;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#8217;|&rsquo;/gi, "’")
    .replace(/&#8216;|&lsquo;/gi, "‘")
    .replace(/&#8220;|&ldquo;/gi, "“")
    .replace(/&#8221;|&rdquo;/gi, "”")
    .replace(/&#8211;|&ndash;/gi, "–")
    .replace(/&#8230;|&hellip;/gi, "…")
    .replace(/&euro;/gi, "€")
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_m, d) => String.fromCharCode(Number(d)));
}

const clean = (s: string) => decodeEntities(s).replace(/\s+/g, " ");

export function htmlToMarkdown(html: string, rewriteLink: LinkRewriter): ConvertResult {
  const root: any = parse(html, { blockTextElements: { script: false, style: false } });

  for (const sel of ["script", "style", "svg", "noscript", "form", "iframe", "nav", "footer", "header", "button"]) {
    root.querySelectorAll(sel).forEach((n: any) => n.remove());
  }
  root.querySelectorAll("[class]").forEach((n: any) => {
    const cls = n.getAttribute("class") || "";
    if (NOISE_CLASS.test(cls)) n.remove();
  });

  const images: string[] = [];
  const blocks: string[] = [];

  const inline = (node: any): string => {
    if (!node) return "";
    if (node.nodeType === 3) return clean(node.rawText ?? "");
    const tag = (node.rawTagName || "").toLowerCase();
    const kids = () => (node.childNodes || []).map(inline).join("");
    switch (tag) {
      case "br":
        return "  \n";
      case "strong":
      case "b": {
        const t = kids().trim();
        return t ? `**${t}**` : "";
      }
      case "em":
      case "i": {
        const t = kids().trim();
        return t ? `*${t}*` : "";
      }
      case "code": {
        const t = kids().trim();
        return t ? `\`${t}\`` : "";
      }
      case "a": {
        const t = kids().trim();
        const href = (node.getAttribute("href") || "").trim();
        if (!t) return "";
        if (!href || href.startsWith("#") || href.startsWith("javascript:")) return t;
        return `[${t}](${rewriteLink(decodeEntities(href))})`;
      }
      case "img": {
        const src = (node.getAttribute("src") || "").trim();
        if (!src) return "";
        images.push(src);
        const alt = clean(node.getAttribute("alt") || "").trim();
        return `![${alt}](${src})`;
      }
      default:
        return kids();
    }
  };

  const listMd = (node: any, ordered: boolean, depth: number): string => {
    const items: string[] = [];
    let i = 1;
    for (const li of node.childNodes || []) {
      if ((li.rawTagName || "").toLowerCase() !== "li") continue;
      const nested: string[] = [];
      let text = "";
      for (const child of li.childNodes || []) {
        const t = (child.rawTagName || "").toLowerCase();
        if (t === "ul" || t === "ol") {
          nested.push(listMd(child, t === "ol", depth + 1));
        } else {
          text += inline(child);
        }
      }
      const marker = ordered ? `${i}.` : "-";
      const indent = "  ".repeat(depth);
      const line = `${indent}${marker} ${text.trim()}`.trimEnd();
      if (text.trim() || nested.length) items.push([line, ...nested].filter(Boolean).join("\n"));
      i++;
    }
    return items.join("\n");
  };

  const tableMd = (node: any): string => {
    const rows: string[][] = [];
    node.querySelectorAll("tr").forEach((tr: any) => {
      const cells = (tr.childNodes || [])
        .filter((c: any) => ["td", "th"].includes((c.rawTagName || "").toLowerCase()))
        .map((c: any) => inline(c).replace(/\s*\n\s*/g, " ").replace(/\|/g, "\\|").trim());
      if (cells.length) rows.push(cells);
    });
    if (!rows.length) return "";
    const width = Math.max(...rows.map((r) => r.length));
    const norm = rows.map((r) => [...r, ...Array(width - r.length).fill("")]);
    const head = norm[0];
    const body = norm.slice(1);
    const lines = [`| ${head.join(" | ")} |`, `| ${head.map(() => "---").join(" | ")} |`];
    for (const r of body) lines.push(`| ${r.join(" | ")} |`);
    return lines.join("\n");
  };

  const seen = new Set<string>();
  const push = (md: string) => {
    const t = md.trim();
    if (!t) return;
    const key = t.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    blocks.push(t);
  };

  const walk = (node: any) => {
    for (const child of node.childNodes || []) {
      if (child.nodeType === 3) continue;
      const tag = (child.rawTagName || "").toLowerCase();
      if (/^h[1-6]$/.test(tag)) {
        const level = Number(tag[1]);
        const text = inline(child).replace(/\s*\n\s*/g, " ").trim();
        // H1 hoort bij de paginatitel, niet in de markdown-content.
        if (level > 1 && text) push(`${"#".repeat(Math.min(level, 6))} ${text}`);
        continue;
      }
      if (tag === "p") {
        push(inline(child).trim());
        continue;
      }
      if (tag === "ul" || tag === "ol") {
        push(listMd(child, tag === "ol", 0));
        continue;
      }
      if (tag === "table") {
        push(tableMd(child));
        continue;
      }
      if (tag === "blockquote") {
        const inner = (child.childNodes || []).map(inline).join(" ").trim();
        if (inner) push(inner.split("\n").map((l: string) => `> ${l.trim()}`).join("\n"));
        continue;
      }
      if (tag === "figure") {
        const img = child.querySelector("img");
        const cap = child.querySelector("figcaption");
        const parts: string[] = [];
        if (img) parts.push(inline(img));
        if (cap) {
          const c = inline(cap).trim();
          if (c) parts.push(`*${c}*`);
        }
        push(parts.join("\n\n"));
        continue;
      }
      if (tag === "img") {
        push(inline(child));
        continue;
      }
      if (tag === "hr") {
        continue;
      }
      walk(child);
    }
  };

  walk(root);

  let markdown = blocks.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
  markdown = trimBoilerplate(markdown);
  const wordCount = markdown
    .replace(/[#>*`|_-]/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .split(/\s+/)
    .filter(Boolean).length;

  return { markdown, images: [...new Set(images)], wordCount };
}

// Site-brede CTA-/navigatieblokken die WordPress onder elke pagina rendert.
const BOILERPLATE_HEADINGS = [
  /^#{1,6}\s*De beste oplossing voor jou/i,
  /^#{1,6}\s*Zorgeloos zzp['\u2019]?en/i,
  /^#{1,6}\s*Blijf op de hoogte/i,
  /^#{1,6}\s*Meer weten\?/i,
  /^#{1,6}\s*Gerelateerde artikelen/i,
  /^#{1,6}\s*Volg ons/i,
];

export function trimBoilerplate(markdown: string): string {
  const lines = markdown.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (BOILERPLATE_HEADINGS.some((r) => r.test(lines[i].trim()))) {
      return lines.slice(0, i).join("\n").replace(/\n{3,}/g, "\n\n").trim();
    }
  }
  return markdown;
}

export function stripHtml(html: string): string {
  return clean(html.replace(/<[^>]+>/g, " ")).trim();
}

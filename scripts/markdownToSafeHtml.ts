// Markdown → veilige HTML voor de prerender-fallback.
//
// Uitgangspunt is een whitelist: alle brontekst wordt eerst geëscapeerd, daarna
// bouwt deze module zelf uitsluitend toegestane tags op. Ruwe HTML, <script>,
// <style>, event-handlers (onclick=...) en javascript:-URL's uit de
// artikelinhoud kunnen daardoor per definitie niet in de output belanden.
//
// Toegestane tags: p h2 h3 h4 ul ol li strong em a code pre blockquote hr img
//                  table thead tbody tr th td br
// Toegestane attributen: a[href] img[src,alt,loading]

const SAFE_URL = /^(https?:\/\/|\/|#|mailto:|tel:)/i;

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function safeUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!SAFE_URL.test(trimmed)) return null;
  return esc(trimmed);
}

/** Inline-opmaak binnen een regel. Tekst is al geëscapeerd voordat er tags bijkomen. */
function inline(raw: string): string {
  let s = esc(raw);
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g, (_m, alt: string, src: string) => {
    const url = safeUrl(src);
    return url ? `<img src="${url}" alt="${alt}" loading="lazy">` : alt;
  });
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)[^)]*\)/g, (_m, text: string, href: string) => {
    const url = safeUrl(href);
    return url ? `<a href="${url}">${text}</a>` : text;
  });
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  return s;
}

function headingTag(level: number): "h2" | "h3" | "h4" {
  if (level <= 2) return "h2";
  if (level === 3) return "h3";
  return "h4";
}

/** Volledige markdown-body als veilige HTML. Lege input geeft een lege string. */
export function markdownToSafeHtml(markdown: string | null | undefined): string {
  if (!markdown) return "";
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let paragraph: string[] = [];
  let listType: "ul" | "ol" | null = null;
  let quote: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      out.push(`<p>${inline(paragraph.join(" "))}</p>`);
      paragraph = [];
    }
  };
  const flushList = () => {
    if (listType) {
      out.push(`</${listType}>`);
      listType = null;
    }
  };
  const flushQuote = () => {
    if (quote.length) {
      out.push(`<blockquote><p>${inline(quote.join(" "))}</p></blockquote>`);
      quote = [];
    }
  };
  const flushAll = () => {
    flushParagraph();
    flushList();
    flushQuote();
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Codeblok: inhoud letterlijk, alleen geëscapeerd.
    if (/^```/.test(trimmed)) {
      flushAll();
      const buffer: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i].trim())) buffer.push(lines[i++]);
      out.push(`<pre><code>${esc(buffer.join("\n"))}</code></pre>`);
      continue;
    }

    if (!trimmed) {
      flushAll();
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushAll();
      const tag = headingTag(heading[1].length);
      out.push(`<${tag}>${inline(heading[2])}</${tag}>`);
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      flushAll();
      out.push("<hr>");
      continue;
    }

    if (trimmed.startsWith(">")) {
      flushParagraph();
      flushList();
      quote.push(trimmed.replace(/^>\s?/, ""));
      continue;
    }

    // Tabel: kopregel gevolgd door een scheidingsregel met streepjes.
    if (
      trimmed.startsWith("|") &&
      i + 1 < lines.length &&
      /^\|?[\s:|-]+\|[\s:|-]*$/.test(lines[i + 1].trim())
    ) {
      flushAll();
      const cells = (row: string) =>
        row
          .trim()
          .replace(/^\|/, "")
          .replace(/\|$/, "")
          .split("|")
          .map((c) => c.trim());
      const head = cells(trimmed);
      i += 2;
      const body: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) body.push(cells(lines[i++]));
      i--;
      out.push(
        "<table><thead><tr>" +
          head.map((c) => `<th>${inline(c)}</th>`).join("") +
          "</tr></thead><tbody>" +
          body
            .map((row) => `<tr>${row.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`)
            .join("") +
          "</tbody></table>",
      );
      continue;
    }

    const bullet = trimmed.match(/^[-*+]\s+(.*)$/);
    const numbered = trimmed.match(/^\d+[.)]\s+(.*)$/);
    if (bullet || numbered) {
      flushParagraph();
      flushQuote();
      const wanted: "ul" | "ol" = bullet ? "ul" : "ol";
      if (listType !== wanted) {
        flushList();
        out.push(`<${wanted}>`);
        listType = wanted;
      }
      out.push(`<li>${inline((bullet || numbered)![1])}</li>`);
      continue;
    }

    flushList();
    flushQuote();
    paragraph.push(trimmed);
  }

  flushAll();
  return out.join("\n");
}

import { useEffect, useMemo, useState } from "react";
import { List } from "lucide-react";

interface TocItem {
  id: string;
  text: string;
  level: number;
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

/**
 * Parses markdown content for H2/H3 headings and renders a sticky table of contents.
 * Only renders when there are 3+ headings (long-form articles).
 */
export function TableOfContents({ content }: { content: string }) {
  const items = useMemo<TocItem[]>(() => {
    if (!content) return [];
    const lines = content.split("\n");
    const result: TocItem[] = [];
    for (const line of lines) {
      const m = /^(#{2,3})\s+(.+?)\s*$/.exec(line);
      if (m) {
        const level = m[1].length;
        const text = m[2].replace(/[*_`]/g, "").trim();
        result.push({ id: slugify(text), text, level });
      }
    }
    return result;
  }, [content]);

  const [active, setActive] = useState<string>("");

  useEffect(() => {
    if (items.length === 0) return;
    // Assign IDs to rendered headings (react-markdown doesn't by default).
    const root = document.querySelector("[data-article-body]");
    if (!root) return;
    const headings = root.querySelectorAll("h2, h3");
    headings.forEach((h) => {
      const id = slugify(h.textContent || "");
      if (id && !h.id) h.id = id;
    });

    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-80px 0px -70% 0px", threshold: 0 },
    );
    headings.forEach((h) => obs.observe(h));
    return () => obs.disconnect();
  }, [items]);

  if (items.length < 3) return null;

  return (
    <aside
      className="hidden lg:block sticky top-24 self-start max-h-[calc(100vh-8rem)] overflow-y-auto pl-6 border-l border-border/50"
      aria-label="Inhoudsopgave"
    >
      <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 inline-flex items-center gap-1.5">
        <List className="h-3.5 w-3.5" /> In dit artikel
      </div>
      <ul className="space-y-2 text-sm">
        {items.map((it) => (
          <li key={it.id} className={it.level === 3 ? "pl-3" : ""}>
            <a
              href={`#${it.id}`}
              className={`block leading-snug transition-colors hover:text-accent ${
                active === it.id
                  ? "text-accent font-semibold"
                  : "text-muted-foreground"
              }`}
            >
              {it.text}
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}

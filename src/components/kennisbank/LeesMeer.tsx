import { ArrowRight } from "lucide-react";
import { LocalizedLink } from "@/components/LocalizedLink";
import { useArticles } from "@/hooks/useArticles";

interface Props {
  /** Slugs die als eerste getoond worden, in deze volgorde (als ze gepubliceerd zijn). */
  voorkeur: string[];
  titel?: string;
  max?: number;
}

/** "Lees meer"-blok met 4 tot 6 relevante kennisbankartikelen uit Verzekeringen. */
export function LeesMeer({ voorkeur, titel = "Lees meer", max = 6 }: Props) {
  const { data: articles } = useArticles("Alle");
  if (!articles?.length) return null;
  const bySlug = new Map(articles.map((a) => [a.slug, a]));
  const eerst = voorkeur.map((s) => bySlug.get(s)).filter(Boolean) as typeof articles;
  const rest = articles.filter(
    (a) => (a.category || "").toLowerCase() === "verzekeringen" && !voorkeur.includes(a.slug),
  );
  const lijst = [...eerst, ...rest].slice(0, max);
  if (lijst.length < 4) return null;
  return (
    <section className="section-padding bg-secondary/30" aria-labelledby="lees-meer">
      <div className="container-wide max-w-5xl">
        <h2 id="lees-meer" className="mb-6 text-center">{titel}</h2>
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {lijst.map((a) => (
            <li key={a.slug}>
              <LocalizedLink
                to={`/kennisbank/${a.slug}`}
                className="group block h-full bg-card border border-border/50 rounded-xl p-5 hover:border-accent/40 hover:shadow-md transition-all"
              >
                <h3 className="font-semibold text-base mb-2 group-hover:text-accent transition-colors">{a.title}</h3>
                {a.excerpt && <p className="text-sm text-muted-foreground line-clamp-3">{a.excerpt}</p>}
                <span className="inline-flex items-center gap-1 mt-3 text-sm font-medium text-accent">
                  Lees artikel <ArrowRight className="h-4 w-4" />
                </span>
              </LocalizedLink>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

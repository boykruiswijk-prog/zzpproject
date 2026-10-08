import { useEffect, useRef, useState, type ImgHTMLAttributes } from "react";
import { articleImage } from "@/lib/articleImage";

interface Props extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> {
  article: { slug: string; title: string; category?: string | null; image_url?: string | null };
}

/** Toont de artikelafbeelding; bij een fout nooit een kapot icoon maar een huisstijlblok. */
export function ArticleImage({ article, className, ...rest }: Props) {
  const [kapot, setKapot] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  // Fout vóór hydratatie (geprerenderde HTML) alsnog opvangen.
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setKapot(true);
  }, []);
  if (kapot) {
    return (
      <div role="img" aria-label={article.title}
        className={`${className ?? ""} flex flex-col justify-center gap-3 bg-primary p-[6%] text-left`}>
        <span className="text-xs sm:text-sm font-bold uppercase tracking-widest text-accent">
          {article.category || "Kennisbank"}
        </span>
        <span className="line-clamp-3 text-lg sm:text-2xl font-extrabold leading-tight text-primary-foreground">
          {article.title}
        </span>
      </div>
    );
  }
  return <img ref={ref} {...rest} src={articleImage(article)} alt={article.title} className={className} onError={() => setKapot(true)} />;
}

import { useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { LocalizedLink } from "@/components/LocalizedLink";
import { Helmet } from "react-helmet-async";
import { Layout } from "@/components/layout/Layout";
import { useArticle, useArticles } from "@/hooks/useArticles";
import {
  ArrowLeft, ArrowRight, Calendar, Check, ChevronRight, Clock,
  ExternalLink, Linkedin, Mail, Phone, Share2, Twitter, User, Link as LinkIcon, Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { formatDateNL } from "@/lib/dateFormat";
import { toast } from "@/hooks/use-toast";
import { ReadingProgress } from "@/components/kennisbank/ReadingProgress";
import { TableOfContents } from "@/components/kennisbank/TableOfContents";

const BAV_AVB_SLUG = "zp-zaken-zorgeloos-zzpen-goedkoopste-bav-avb";

// Categorie → kleur-classes
const CATEGORY_STYLES: Record<string, string> = {
  "Wet- en regelgeving": "bg-blue-100 text-blue-800 border-blue-200",
  "Wetgeving": "bg-blue-100 text-blue-800 border-blue-200",
  "Belastingen": "bg-orange-100 text-orange-800 border-orange-200",
  "Fiscaal": "bg-orange-100 text-orange-800 border-orange-200",
  "Verzekeringen": "bg-green-100 text-green-800 border-green-200",
  "Ondernemen": "bg-purple-100 text-purple-800 border-purple-200",
  "Financiën": "bg-pink-100 text-pink-800 border-pink-200",
};
const defaultCategoryStyle = "bg-accent/10 text-accent border-accent/20";

const CATEGORY_SLUGS: Record<string, string> = {
  "Wet- en regelgeving": "wet-en-regelgeving",
  "Wetgeving": "wet-en-regelgeving",
  "Regelgeving": "wet-en-regelgeving",
  "Belastingen": "belastingen",
  "Fiscaal": "belastingen",
  "Ondernemen": "ondernemen",
  "Financiën": "financien",
  "Verzekeringen": "wet-en-regelgeving",
  "Nieuws": "wet-en-regelgeving",
};

const FALLBACK_OG_IMAGE = "https://www.zpzaken.nl/og-image.jpg";

function stripMarkdown(s: string) {
  return s
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_~`-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function makeFallbackDescription(content: string | null | undefined, excerpt?: string | null) {
  if (excerpt) return excerpt.length > 160 ? excerpt.slice(0, 155).trimEnd() + "…" : excerpt;
  if (!content) return "Kennisbank artikel van ZP Zaken voor zzp'ers.";
  const plain = stripMarkdown(content);
  return plain.length > 160 ? plain.slice(0, 155).trimEnd() + "…" : plain;
}

function countWords(content: string | null | undefined) {
  if (!content) return 0;
  return stripMarkdown(content).split(/\s+/).filter(Boolean).length;
}

function estimateReadTime(content?: string | null) {
  if (!content) return "3 min";
  const words = content.trim().split(/\s+/).length;
  return `${Math.max(1, Math.round(words / 200))} min`;
}

const InlineCTA = () => (
  <div
    className="my-8 rounded-lg p-5"
    style={{ background: "#FFF5F5", borderLeft: "4px solid #E53E2F" }}
  >
    <div className="text-xs font-semibold uppercase tracking-wide text-accent mb-1">
      Direct geregeld
    </div>
    <h3 className="text-lg font-bold mb-1 text-foreground">
      Sluit direct online af vanaf €55 per maand
    </h3>
    <p className="text-sm text-muted-foreground mb-4">
      Geen eigen risico. Dagelijks opzegbaar. BAV + AVB gecombineerd.
    </p>
    <Button variant="accent" asChild>
      <LocalizedLink to="/verzekeringen">
        Direct online afsluiten <ArrowRight className="h-4 w-4" />
      </LocalizedLink>
    </Button>
  </div>
);

const renderContentWithCTA = (content: string) => {
  const parts = content.split(/\n\n+/);
  if (parts.length < 3) {
    return <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>;
  }
  const before = parts.slice(0, 2).join("\n\n");
  const after = parts.slice(2).join("\n\n");
  return (
    <>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{before}</ReactMarkdown>
      <InlineCTA />
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{after}</ReactMarkdown>
    </>
  );
};

function ShareButtons({ url, title }: { url: string; title: string }) {
  const copy = () => {
    navigator.clipboard.writeText(url);
    toast({ title: "Link gekopieerd" });
  };
  const enc = encodeURIComponent;
  const linkedin = `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`;
  const twitter = `https://twitter.com/intent/tweet?text=${enc(title)}&url=${enc(url)}`;
  const email = `mailto:?subject=${enc(title)}&body=${enc(url)}`;
  const cls = "h-9 w-9 rounded-full bg-muted hover:bg-accent hover:text-accent-foreground flex items-center justify-center text-muted-foreground transition-colors";
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground mr-1 inline-flex items-center gap-1"><Share2 className="h-3.5 w-3.5" /> Deel:</span>
      <a className={cls} href={linkedin} target="_blank" rel="noopener noreferrer" aria-label="Deel op LinkedIn"><Linkedin className="h-4 w-4" /></a>
      <a className={cls} href={twitter} target="_blank" rel="noopener noreferrer" aria-label="Deel op X / Twitter"><Twitter className="h-4 w-4" /></a>
      <a className={cls} href={email} aria-label="Deel via e-mail"><Mail className="h-4 w-4" /></a>
      <button type="button" className={cls} onClick={copy} aria-label="Link kopiëren"><LinkIcon className="h-4 w-4" /></button>
    </div>
  );
}

export default function ArtikelDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { data: article, isLoading, error } = useArticle(slug || "");
  const { data: allArticles } = useArticles();

  useEffect(() => { window.scrollTo({ top: 0, behavior: "auto" }); }, [slug]);

  const related = useMemo(() => {
    if (!article || !allArticles) return [];
    const same = allArticles.filter((a) => a.category === article.category && a.slug !== article.slug);
    const others = allArticles.filter((a) => a.category !== article.category && a.slug !== article.slug);
    return [...same, ...others].slice(0, 3);
  }, [article, allArticles]);

  if (isLoading) {
    return (
      <Layout>
        <div className="container-wide section-padding max-w-3xl mx-auto">
          <Skeleton className="h-6 w-48 mb-6" />
          <Skeleton className="h-12 w-3/4 mb-4" />
          <Skeleton className="h-6 w-1/2 mb-8" />
          <Skeleton className="h-64 w-full mb-8 rounded-xl" />
          <div className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      </Layout>
    );
  }

  if (error || !article) {
    return (
      <Layout>
        <div className="container-wide section-padding text-center">
          <h1 className="text-2xl font-bold mb-4">Artikel niet gevonden</h1>
          <p className="text-muted-foreground mb-6">Het artikel dat je zoekt bestaat niet of is verwijderd.</p>
          <Button asChild>
            <LocalizedLink to="/kennisbank">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Terug naar kennisbank
            </LocalizedLink>
          </Button>
        </div>
      </Layout>
    );
  }

  const formattedDate = article.published_at ? formatDateNL(article.published_at) : null;
  const readTime = article.read_time || estimateReadTime(article.content);
  const categoryStyle = CATEGORY_STYLES[article.category] || defaultCategoryStyle;
  const categorySlug = CATEGORY_SLUGS[article.category];
  const articleUrl = `https://www.zpzaken.nl/kennisbank/${article.slug}`;
  const wordCount = countWords(article.content);
  const ogImage = article.image_url || FALLBACK_OG_IMAGE;
  const metaDescription = article.seo_description || makeFallbackDescription(article.content, article.excerpt);
  const seoTitle = article.seo_title || article.title;
  const publishedAt = article.published_at || new Date().toISOString();

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: seoTitle,
    description: metaDescription,
    image: [ogImage],
    datePublished: publishedAt,
    dateModified: publishedAt,
    author: { "@type": "Organization", name: "ZP Zaken", url: "https://www.zpzaken.nl" },
    publisher: {
      "@type": "Organization",
      name: "ZP Zaken",
      logo: { "@type": "ImageObject", url: "https://www.zpzaken.nl/favicon.png" },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": articleUrl },
    articleSection: article.category,
    wordCount,
    inLanguage: "nl-NL",
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://www.zpzaken.nl/" },
      { "@type": "ListItem", position: 2, name: "Kennisbank", item: "https://www.zpzaken.nl/kennisbank" },
      { "@type": "ListItem", position: 3, name: article.category, item: categorySlug ? `https://www.zpzaken.nl/kennisbank/${categorySlug}` : "https://www.zpzaken.nl/kennisbank" },
      { "@type": "ListItem", position: 4, name: article.title, item: articleUrl },
    ],
  };

  const isBavAvb = article.slug === BAV_AVB_SLUG;

  return (
    <Layout>
      <ReadingProgress />
      <Helmet>
        <title>{seoTitle} | Kennisbank | ZP Zaken</title>
        <meta name="description" content={metaDescription} />
        <link rel="canonical" href={articleUrl} />

        <meta property="og:type" content="article" />
        <meta property="og:site_name" content="ZP Zaken" />
        <meta property="og:title" content={seoTitle} />
        <meta property="og:description" content={metaDescription} />
        <meta property="og:url" content={articleUrl} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:locale" content="nl_NL" />
        <meta property="article:published_time" content={publishedAt} />
        <meta property="article:modified_time" content={publishedAt} />
        <meta property="article:section" content={article.category} />
        <meta property="article:author" content="ZP Zaken" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={seoTitle} />
        <meta name="twitter:description" content={metaDescription} />
        <meta name="twitter:image" content={ogImage} />

        {article.image_url && <link rel="preload" as="image" href={article.image_url} />}

        <script type="application/ld+json">{JSON.stringify(articleSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>
      </Helmet>


      <article className="bg-background">
        {/* Hero */}
        <header className="border-b border-border/40 bg-gradient-to-b from-secondary/40 to-background">
          <div className="container-wide max-w-4xl mx-auto px-4 sm:px-6 pt-8 pb-10 md:pt-12 md:pb-14">
            {/* Breadcrumbs */}
            <nav className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground mb-6" aria-label="Breadcrumb">
              <LocalizedLink to="/" className="hover:text-foreground transition-colors">Home</LocalizedLink>
              <ChevronRight className="h-3 w-3" />
              <LocalizedLink to="/kennisbank" className="hover:text-foreground transition-colors">Kennisbank</LocalizedLink>
              <ChevronRight className="h-3 w-3" />
              {categorySlug ? (
                <LocalizedLink to={`/kennisbank/${categorySlug}`} className="hover:text-foreground transition-colors">{article.category}</LocalizedLink>
              ) : (
                <span>{article.category}</span>
              )}
              <ChevronRight className="h-3 w-3" />
              <span className="text-foreground/70 line-clamp-1">{article.title}</span>
            </nav>

            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider border ${categoryStyle} mb-4`}>
              <Shield className="h-3 w-3" />
              {article.category}
            </span>

            <h1 className="text-[28px] md:text-[36px] lg:text-[42px] leading-tight font-bold text-foreground mb-4">
              {article.title}
            </h1>

            {article.excerpt && (
              <p className="text-lg md:text-xl text-slate-600 font-normal leading-relaxed mb-6 max-w-3xl">
                {article.excerpt}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <User className="h-4 w-4" />
                Redactie ZP Zaken
              </span>
              {formattedDate && (
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  {formattedDate}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                {readTime} lezen
              </span>
              {article.source_name && article.source_url && (
                <a href={article.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors">
                  <ExternalLink className="h-4 w-4" />
                  Bron: {article.source_name}
                </a>
              )}
            </div>
          </div>
        </header>

        {/* Featured image */}
        {article.image_url && (
          <div className="container-wide max-w-4xl mx-auto px-4 sm:px-6 -mt-2 mb-8">
            <figure>
              <img
                src={article.image_url}
                alt={article.title}
                width={1600}
                height={900}
                loading="eager"
                fetchPriority="high"
                className="w-full aspect-[16/9] object-cover rounded-xl shadow-md"
              />
            </figure>
          </div>
        )}

        {/* Body with optional TOC sidebar */}
        <div className="container-wide max-w-6xl mx-auto px-4 sm:px-6 pb-16">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_240px] gap-10">
            <div className="max-w-[720px] mx-auto w-full">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-border/40">
                <ShareButtons url={articleUrl} title={article.title} />
              </div>

              <div
                data-article-body
                className="prose prose-lg max-w-none
                  prose-headings:text-foreground prose-headings:font-semibold prose-headings:scroll-mt-24
                  prose-h2:text-[24px] md:prose-h2:text-[28px] prose-h2:mt-12 prose-h2:mb-4
                  prose-h3:text-[20px] md:prose-h3:text-[22px] prose-h3:mt-8 prose-h3:mb-3
                  prose-h4:text-[18px] prose-h4:mt-6
                  prose-p:text-slate-700 prose-p:text-base md:prose-p:text-[18px] prose-p:leading-[1.75] prose-p:mb-6
                  prose-a:text-accent prose-a:underline hover:prose-a:opacity-80
                  prose-strong:text-foreground
                  prose-ul:my-6 prose-ul:space-y-2 prose-ul:pl-6 prose-li:text-slate-700 prose-li:marker:text-accent
            prose-ol:my-6 prose-ol:space-y-2 prose-ol:pl-6
            prose-blockquote:border-l-4 prose-blockquote:border-accent prose-blockquote:bg-slate-50 prose-blockquote:py-4 prose-blockquote:px-6 prose-blockquote:rounded-r-lg prose-blockquote:not-italic prose-blockquote:my-8
            prose-code:bg-slate-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:before:content-none prose-code:after:content-none
            prose-img:rounded-lg prose-img:shadow-md prose-img:my-8
            prose-table:my-8 prose-th:bg-secondary prose-th:px-4 prose-th:py-3 prose-th:text-left prose-th:font-semibold prose-td:px-4 prose-td:py-3 prose-td:border-t prose-td:border-border/50
            prose-hr:my-10 prose-hr:border-border/40">
            {isBavAvb
              ? renderContentWithCTA(article.content || "")
              : <ReactMarkdown remarkPlugins={[remarkGfm]}>{article.content || ""}</ReactMarkdown>}
          </div>

          {/* CTA-blok */}
          <div className="mt-12 rounded-2xl p-7 md:p-9 text-white" style={{ background: "linear-gradient(135deg, #1f2937 0%, #0f172a 100%)" }}>
            <h3 className="text-2xl font-bold mb-2">Vragen na het lezen?</h3>
            <p className="text-white/80 mb-6">Heb je vragen? Bel of mail ons voor een reactie binnen 24 uur.</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <a href="tel:0204573077" className="inline-flex items-center justify-center gap-2 bg-accent hover:opacity-90 text-accent-foreground px-5 py-3 rounded-lg font-semibold transition">
                <Phone className="h-4 w-4" /> Bel 020 - 457 3077
              </a>
              <a href="mailto:info@zpzaken.nl" className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white px-5 py-3 rounded-lg font-semibold transition">
                <Mail className="h-4 w-4" /> Stuur een mail
              </a>
            </div>
          </div>

          <div className="mt-8">
            <ShareButtons url={articleUrl} title={article.title} />
          </div>
        </div>

        {/* Related articles */}
        {related.length > 0 && (
          <section className="border-t border-border/40 bg-secondary/30">
            <div className="container-wide max-w-5xl mx-auto px-4 sm:px-6 py-14">
              <h2 className="text-2xl md:text-3xl font-bold mb-8">Verder lezen</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {related.map((r) => {
                  const rStyle = CATEGORY_STYLES[r.category] || defaultCategoryStyle;
                  return (
                    <LocalizedLink
                      key={r.id}
                      to={`/kennisbank/${r.slug}`}
                      className="group bg-background border border-border/50 rounded-xl overflow-hidden hover:shadow-lg transition-shadow"
                    >
                      {r.image_url ? (
                        <img src={r.image_url} alt={r.title} className="w-full aspect-[16/9] object-cover" />
                      ) : (
                        <div className="w-full aspect-[16/9] bg-gradient-to-br from-secondary to-muted" />
                      )}
                      <div className="p-5">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${rStyle} mb-3`}>
                          {r.category}
                        </span>
                        <h3 className="font-semibold text-foreground group-hover:text-accent transition-colors line-clamp-2 mb-2">{r.title}</h3>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{r.published_at ? formatDateNL(r.published_at) : ""}</span>
                          <span className="inline-flex items-center gap-1 text-accent font-semibold">Lees meer <ArrowRight className="h-3 w-3" /></span>
                        </div>
                      </div>
                    </LocalizedLink>
                  );
                })}
              </div>
            </div>
          </section>
        )}
      </article>
    </Layout>
  );
}

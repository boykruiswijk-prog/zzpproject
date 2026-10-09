import { useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { LocalizedLink } from "@/components/LocalizedLink";
import { Helmet } from "react-helmet-async";
import { articleSchema, breadcrumbSchema, faqSchema } from "@/lib/schema";
import { ARTIKEL_FAQS } from "@/config/artikelFaqs";
import { formatPageTitle } from "@/lib/seoTitle";
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
import { ThreeOptionCTA } from "@/components/shared/ThreeOptionCTA";
import { resolveFiscaleTokens } from "@/lib/fiscaleTokens";
import { SITE_CONFIG } from "@/config/site";
import NotFound from "@/pages/NotFound";
import { articleImage, absoluteArticleImage, absoluteArticleOgImage, isGeneratedArticleImage, isArticleIllustration } from "@/lib/articleImage";
import { ArticleImage } from "@/components/kennisbank/ArticleImage";

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
  "Verzekeringen": "verzekeringen",
  "Nieuws": "ondernemen",
};


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

type ArticleFaq = { question: string; answer: string };

function extractMarkdownFaqs(content: string | null | undefined): ArticleFaq[] {
  if (!content) return [];
  const sectionMatch = content.match(/^## Veelgestelde vragen\s*$([\s\S]*?)(?=^##\s|(?![\s\S]))/m);
  if (!sectionMatch) return [];

  return [...sectionMatch[1].matchAll(/^###\s+(.+)\n([\s\S]*?)(?=^###\s|(?![\s\S]))/gm)]
    .map((match) => ({
      question: stripMarkdown(match[1]),
      answer: stripMarkdown(match[2]),
    }))
    .filter((item) => item.question && item.answer);
}

/** Categorieën met een commerciële afsluiter; hoofdletterongevoelig. */
const COMMERCIAL_CATEGORIES = ["verzekeringen", "wet- en regelgeving", "belastingen", "financiën", "wetgeving", "regelgeving", "fiscaal"];

const isVerzekeringen = (c?: string | null) => (c || "").trim().toLowerCase() === "verzekeringen";

/** Stabiele hash, zodat prerender en browser dezelfde "Verder lezen" tonen. */
function slugHash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

const InlineCTA = ({ aov = false }: { aov?: boolean }) => (
  <div className="not-prose my-8 rounded-lg p-5 bg-accent/5 border-l-4 border-accent">
    <div className="text-xs font-semibold uppercase tracking-wide text-accent mb-1">
      Direct geregeld
    </div>
    <h3 className="text-lg font-bold mb-1 text-foreground">
      Vraag online aan vanaf €55 per maand
    </h3>
    <p className="text-sm text-muted-foreground mb-4">
      Geen eigen risico. Dagelijks opzegbaar. BAV + AVB gecombineerd.
    </p>
    <div className="flex flex-wrap gap-3">
      <Button variant="accent" asChild>
        <LocalizedLink to="/verzekeringen">
          BAV + AVB direct afsluiten <ArrowRight className="h-4 w-4" />
        </LocalizedLink>
      </Button>
      <Button variant="outline" asChild>
        <LocalizedLink to="/offerte">Vrijblijvende offerte</LocalizedLink>
      </Button>
      {aov && (
        <Button variant="outline" asChild>
          <LocalizedLink to="/aov">Meer over de AOV</LocalizedLink>
        </Button>
      )}
    </div>
  </div>
);

const renderContentWithCTA = (rawContent: string, aov = false) => {
  // Fiscale tokens ({{fiscaal:...}}) worden vervangen door de actuele waarden
  // uit src/data/fiscaleCijfers.ts, zodat bedragen nooit verouderen.
  const content = resolveFiscaleTokens(rawContent);
  const parts = content.split(/\n\n+/);
  if (parts.length < 3) {
    return <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>;
  }
  const before = parts.slice(0, 2).join("\n\n");
  const after = parts.slice(2).join("\n\n");
  return (
    <>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{before}</ReactMarkdown>
      <InlineCTA aov={aov} />
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
    // Eerst dezelfde categorie, per artikel een andere startpositie, zodat
    // niet elk artikel naar dezelfde vaste artikelen linkt.
    const rotate = <T,>(list: T[]) => {
      if (!list.length) return list;
      const off = slugHash(article.slug) % list.length;
      return [...list.slice(off), ...list.slice(0, off)];
    };
    const cat = (article.category || "").toLowerCase();
    const same = rotate(allArticles.filter((a) => (a.category || "").toLowerCase() === cat && a.slug !== article.slug));
    const others = rotate(allArticles.filter((a) => (a.category || "").toLowerCase() !== cat && a.slug !== article.slug));
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
    // Onbekende slug: echte "niet gevonden"-pagina met noindex, geen canonical.
    return <NotFound />;
  }

  const bijgewerktOp = (article as any).content_reviewed_at || article.published_at;
  const formattedDate = bijgewerktOp ? formatDateNL(bijgewerktOp) : null;
  const readTime = article.read_time || estimateReadTime(article.content);
  const categoryStyle = CATEGORY_STYLES[article.category] || defaultCategoryStyle;
  const categorySlug = CATEGORY_SLUGS[article.category];
  const articleUrl = `https://zpzaken.nl/kennisbank/${article.slug}`;
  const wordCount = countWords(article.content);
  const gegenereerd = isGeneratedArticleImage(article);
  const ogImage = absoluteArticleOgImage(article);
  const metaDescription = article.seo_description || makeFallbackDescription(article.content, article.excerpt);
  const seoTitle = article.seo_title || article.title;
  // Eén merknaam achteraan, max 60 tekens; zie formatPageTitle.
  const pageTitle = formatPageTitle(seoTitle);
  const publishedAt = article.published_at || new Date().toISOString();

  const jsonLdArticle = articleSchema({
    title: seoTitle,
    description: metaDescription,
    slug: article.slug,
    datePublished: publishedAt,
    // Inhoudelijke controledatum; een cosmetische wijziging (updated_at) mag
    // niet als inhoudelijke update aan Google worden gemeld.
    dateModified: (article as any).content_reviewed_at || publishedAt,
    image: absoluteArticleImage(article),
    category: article.category,
    wordCount,
  });

  const jsonLdBreadcrumb = breadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "Kennisbank", url: "/kennisbank" },
    { name: article.category, url: categorySlug ? `/kennisbank/${categorySlug}` : "/kennisbank" },
    { name: article.title, url: `/kennisbank/${article.slug}` },
  ]);

  // FAQPage-schema: alleen vragen die zichtbaar in het artikel beantwoord worden.
  // Antwoorden komen uit dezelfde fiscale tokens als de artikeltekst.
  const configuredFaqItems = ARTIKEL_FAQS[article.slug];
  const markdownFaqItems = extractMarkdownFaqs(resolveFiscaleTokens(article.content));
  const schemaFaqItems = configuredFaqItems || markdownFaqItems;
  const jsonLdFaq = schemaFaqItems.length > 0
    ? faqSchema(
        schemaFaqItems.map((f) => ({
          question: resolveFiscaleTokens(f.question),
          answer: resolveFiscaleTokens(f.answer),
        })),
      )
    : null;

  const toonInlineCTA = article.slug === BAV_AVB_SLUG || isVerzekeringen(article.category);
  const isAov = /aov|arbeidsongeschikt/i.test(article.slug);
  const showCommercialCTA = COMMERCIAL_CATEGORIES.includes((article.category || "").trim().toLowerCase());

  return (
    <Layout>
      <ReadingProgress />
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={metaDescription} />
        <link rel="canonical" href={articleUrl} />
        <link rel="alternate" hrefLang="nl" href={articleUrl} />
        <link rel="alternate" hrefLang="en" href={articleUrl} />
        <link rel="alternate" hrefLang="de" href={articleUrl} />
        <link rel="alternate" hrefLang="fr" href={articleUrl} />
        <link rel="alternate" hrefLang="x-default" href={articleUrl} />

        <meta property="og:type" content="article" />
        <meta property="og:site_name" content="ZP Zaken" />
        <meta property="og:title" content={seoTitle} />
        <meta property="og:description" content={metaDescription} />
        <meta property="og:url" content={articleUrl} />
        <meta property="og:image" content={ogImage} />
        {gegenereerd && <meta property="og:image:width" content="1200" />}
        {gegenereerd && <meta property="og:image:height" content="630" />}
        {gegenereerd && <meta property="og:image:type" content="image/png" />}
        <meta property="og:image:alt" content={article.title} />
        <meta property="og:locale" content="nl_NL" />
        <meta property="article:published_time" content={publishedAt} />
        <meta property="article:modified_time" content={(article as any).content_reviewed_at || publishedAt} />
        <meta property="article:section" content={article.category} />
        <meta property="article:author" content="ZP Zaken" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={seoTitle} />
        <meta name="twitter:description" content={metaDescription} />
        <meta name="twitter:image" content={ogImage} />

        <link rel="preload" as="image" href={articleImage(article)} />

        <script type="application/ld+json">{JSON.stringify(jsonLdArticle)}</script>
        <script type="application/ld+json">{JSON.stringify(jsonLdBreadcrumb)}</script>
        {jsonLdFaq && <script type="application/ld+json">{JSON.stringify(jsonLdFaq)}</script>}
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
                  Laatst bijgewerkt: {formattedDate}
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
        {(
          <div className="container-wide max-w-4xl mx-auto px-4 sm:px-6 -mt-2 mb-8">
            <figure>
              <ArticleImage decoding="async"
                article={article}
                width={gegenereerd && !isArticleIllustration(article) ? 1200 : 1600}
                height={gegenereerd && !isArticleIllustration(article) ? 630 : 900}
                loading="eager"
                fetchpriority="high"
                className={!gegenereerd || isArticleIllustration(article) ? "w-full aspect-[16/9] object-cover rounded-xl shadow-md" : "w-full aspect-[1200/630] object-contain rounded-xl shadow-md"}
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
                  prose-headings:text-foreground prose-headings:font-bold prose-headings:tracking-tight prose-headings:scroll-mt-24
                  prose-h2:text-[26px] md:prose-h2:text-[32px] prose-h2:mt-16 prose-h2:mb-5 prose-h2:pb-2 prose-h2:border-b prose-h2:border-border/60
                  prose-h3:text-[20px] md:prose-h3:text-[24px] prose-h3:mt-10 prose-h3:mb-3 prose-h3:font-semibold
                  prose-h4:text-[18px] prose-h4:mt-8 prose-h4:font-semibold
                  prose-p:text-slate-700 prose-p:text-base md:prose-p:text-[18px] prose-p:leading-[1.8] prose-p:mb-6
                  prose-p:first-of-type:text-xl md:prose-p:first-of-type:text-[22px] prose-p:first-of-type:text-slate-600 prose-p:first-of-type:font-light prose-p:first-of-type:leading-[1.7] prose-p:first-of-type:mb-10
                  prose-a:text-accent prose-a:underline prose-a:underline-offset-2 hover:prose-a:opacity-80
                  prose-strong:text-foreground prose-strong:font-semibold
                  prose-ul:my-6 prose-ul:space-y-2.5 prose-ul:pl-6 prose-ul:list-disc prose-ul:marker:text-accent
                  prose-ol:my-6 prose-ol:space-y-2.5 prose-ol:pl-6 prose-ol:marker:text-accent prose-ol:marker:font-semibold
                  prose-li:text-slate-700 prose-li:pl-2 prose-li:leading-relaxed
                  prose-blockquote:border-l-4 prose-blockquote:border-accent prose-blockquote:bg-slate-50 prose-blockquote:py-4 prose-blockquote:px-6 prose-blockquote:rounded-r-lg prose-blockquote:not-italic prose-blockquote:my-8 prose-blockquote:text-slate-700
                  prose-code:bg-slate-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-medium prose-code:before:content-none prose-code:after:content-none
                  prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-pre:rounded-lg prose-pre:p-4
                  prose-img:rounded-xl prose-img:shadow-sm prose-img:my-10
                  prose-table:w-full prose-table:my-8 prose-table:border-collapse
                  prose-thead:bg-secondary prose-th:border prose-th:border-border/60 prose-th:px-4 prose-th:py-3 prose-th:text-left prose-th:font-semibold
                  prose-td:border prose-td:border-border/60 prose-td:px-4 prose-td:py-3
                  prose-hr:my-12 prose-hr:border-border/60">
                {toonInlineCTA
                  ? renderContentWithCTA(article.content || "", isAov)
                  : <ReactMarkdown remarkPlugins={[remarkGfm]}>{resolveFiscaleTokens(article.content || "")}</ReactMarkdown>}
              </div>

              {/* Zichtbare FAQ: dekt het FAQPage-schema hierboven, zodat schema
                  en zichtbare tekst altijd overeenkomen. */}
              {configuredFaqItems && configuredFaqItems.length > 0 && (
                <section aria-labelledby="artikel-faq" className="mt-14 border-t border-border/40 pt-10">
                  <h2 id="artikel-faq" className="text-2xl md:text-[28px] font-bold mb-6">
                    Veelgestelde vragen
                  </h2>
                  <dl className="space-y-5">
                    {configuredFaqItems.map((f) => (
                      <div key={f.question} className="rounded-xl border border-border/50 bg-secondary/30 p-5">
                        <dt className="font-semibold text-foreground mb-2">
                          {resolveFiscaleTokens(f.question)}
                        </dt>
                        <dd className="text-slate-700 leading-relaxed">
                          {resolveFiscaleTokens(f.answer)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </section>
              )}

              {showCommercialCTA ? (
                <div className="mt-12">
                  <ThreeOptionCTA />
                </div>
              ) : (
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
              )}

              <div className="mt-8">
                <ShareButtons url={articleUrl} title={article.title} />
              </div>
            </div>

            <TableOfContents content={resolveFiscaleTokens(article.content || "")} />
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
                      <ArticleImage loading="lazy" decoding="async" article={r} className={!isGeneratedArticleImage(r) || isArticleIllustration(r) ? "w-full aspect-[16/9] object-cover" : "w-full aspect-[1200/630] object-contain"} />
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

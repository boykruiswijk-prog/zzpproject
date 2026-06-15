import { Helmet } from "react-helmet-async";
import { Layout } from "@/components/layout/Layout";
import { PageHero } from "@/components/layout/PageHero";
import { LocalizedLink } from "@/components/LocalizedLink";
import { ArrowLeft, ArrowRight, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ArticleCard } from "@/components/kennisbank/ArticleCard";
import { useArticles } from "@/hooks/useArticles";
import { Skeleton } from "@/components/ui/skeleton";
import officeFlowers from "@/assets/zp-boy-laptop.jpg";

interface Props {
  slug: string;
  title: string;
  intro: string;
  // Category-tag(s) zoals in articles.category in DB. Eerste match wint.
  // Indien artikelen nog niet bestaan toont de pagina een lege state.
  categoryTags: string[];
  metaTitle: string;
  metaDescription: string;
}

export function KennisbankCategoryPage({
  slug,
  title,
  intro,
  categoryTags,
  metaTitle,
  metaDescription,
}: Props) {
  const url = `https://zpzaken.nl/kennisbank/${slug}`;
  // Fetch all and filter client-side, since useArticles accepts single category.
  const { data: articles, isLoading } = useArticles("Alle");
  const filtered = (articles || []).filter((a) =>
    categoryTags.some((t) => a.category?.toLowerCase() === t.toLowerCase()),
  );

  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: metaTitle,
    description: metaDescription,
    url,
    isPartOf: {
      "@type": "WebSite",
      name: "ZP Zaken",
      url: "https://zpzaken.nl",
    },
  };

  return (
    <Layout>
      <Helmet>
        <title>{metaTitle}</title>
        <meta name="description" content={metaDescription} />
        <link rel="canonical" href={url} />
        <meta property="og:title" content={metaTitle} />
        <meta property="og:description" content={metaDescription} />
        <meta property="og:url" content={url} />
        <meta property="og:type" content="website" />
        <script type="application/ld+json">{JSON.stringify(collectionSchema)}</script>
      </Helmet>

      <PageHero
        title={title}
        subtitle={intro}
        badge={{ icon: <BookOpen className="h-4 w-4" />, text: "Kennisbank" }}
        backgroundImage={officeFlowers}
      />

      <section className="section-padding bg-background">
        <div className="container-wide">
          <div className="mb-8">
            <Button variant="ghost" size="sm" asChild>
              <LocalizedLink to="/kennisbank">
                <ArrowLeft className="h-4 w-4" />
                Terug naar kennisbank
              </LocalizedLink>
            </Button>
          </div>

          {isLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-card rounded-2xl overflow-hidden border border-border/50">
                  <Skeleton className="h-48 w-full" />
                  <div className="p-6 space-y-3">
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((a, i) => (
                <ArticleCard key={a.id} article={a} index={i} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-secondary/30 rounded-2xl">
              <p className="text-muted-foreground mb-4">
                Nog geen artikelen in deze categorie. Bekijk alle artikelen in de
                kennisbank.
              </p>
              <Button variant="outline" asChild>
                <LocalizedLink to="/kennisbank">
                  Alle artikelen
                  <ArrowRight className="h-4 w-4" />
                </LocalizedLink>
              </Button>
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
}

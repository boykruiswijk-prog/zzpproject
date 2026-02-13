import { useState } from "react";
import { LocalizedLink } from "@/components/LocalizedLink";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { Layout } from "@/components/layout/Layout";
import { PageHero } from "@/components/layout/PageHero";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, BookOpen, Shield } from "lucide-react";
import { useArticles, useArticleCategories } from "@/hooks/useArticles";
import { ArticleCard } from "@/components/kennisbank/ArticleCard";
import { CategoryFilter } from "@/components/kennisbank/CategoryFilter";
import officeFlowers from "@/assets/office-flowers.jpg";

export default function Kennisbank() {
  const { t } = useTranslation();
  const [activeCategory, setActiveCategory] = useState("Alle");
  const { data: articles, isLoading: articlesLoading } = useArticles(activeCategory);
  const { data: categories = ["Alle"] } = useArticleCategories();

  return (
    <Layout>
      <Helmet>
        <title>{t("kennisbank.badge")} | ZP Zaken</title>
        <meta name="description" content={t("kennisbank.subtitle")} />
        <link rel="canonical" href="https://zpzaken.nl/kennisbank" />
      </Helmet>

      <PageHero
        title={t("kennisbank.title")}
        subtitle={t("kennisbank.subtitle")}
        badge={{ icon: <BookOpen className="h-4 w-4" />, text: t("kennisbank.badge") }}
        backgroundImage={officeFlowers}
      />

      <CategoryFilter categories={categories} activeCategory={activeCategory} onCategoryChange={setActiveCategory} />

      <section className="section-padding bg-background">
        <div className="container-wide">
          {articlesLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-card rounded-2xl overflow-hidden border border-border/50">
                  <Skeleton className="h-48 w-full" />
                  <div className="p-6 space-y-3"><Skeleton className="h-6 w-3/4" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-2/3" /></div>
                </div>
              ))}
            </div>
          ) : articles && articles.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {articles.map((article, index) => (
                <ArticleCard key={article.id} article={article} index={index} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">{t("kennisbank.noArticles")}</p>
              <Button variant="outline" onClick={() => setActiveCategory("Alle")}>{t("kennisbank.showAll")}</Button>
            </div>
          )}
        </div>
      </section>

      <section className="section-padding bg-primary text-primary-foreground">
        <div className="container-wide">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="mb-4">{t("kennisbank.stayUpdated")}</h2>
            <div className="flex flex-wrap justify-center gap-3 mb-6">
              {(t("kennisbank.tags", { returnObjects: true }) as string[]).map((tag: string) => (
                <span key={tag} className="inline-flex items-center gap-2 bg-primary-foreground/10 backdrop-blur-sm border border-primary-foreground/20 text-primary-foreground px-4 py-2 rounded-full text-sm">
                  <Shield className="h-4 w-4 text-accent" />{tag}
                </span>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto">
              <input type="email" placeholder={t("kennisbank.emailPlaceholder")} className="flex-1 px-4 py-3 rounded-lg border-0 bg-primary-foreground/10 text-primary-foreground placeholder:text-primary-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary-foreground/30" />
              <Button variant="accent" size="lg">{t("kennisbank.subscribe")}</Button>
            </div>
          </div>
        </div>
      </section>

      <section className="section-padding bg-background">
        <div className="container-wide">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="mb-4">{t("kennisbank.personalAdvice")}</h2>
            <p className="text-lg text-muted-foreground mb-8">{t("kennisbank.personalAdviceDesc")}</p>
            <Button variant="accent" size="lg" asChild>
              <LocalizedLink to="/contact">{t("kennisbank.personalAdviceButton")}<ArrowRight className="h-5 w-5" /></LocalizedLink>
            </Button>
          </div>
        </div>
      </section>
    </Layout>
  );
}

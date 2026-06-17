import { useState } from "react";
import { LocalizedLink } from "@/components/LocalizedLink";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { Layout } from "@/components/layout/Layout";
import { PageHero } from "@/components/layout/PageHero";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, BookOpen, Scale, Briefcase, Calculator, Wallet, Shield } from "lucide-react";
import { useArticles, useArticleCategories } from "@/hooks/useArticles";
import { ArticleCard } from "@/components/kennisbank/ArticleCard";
import { CategoryFilter } from "@/components/kennisbank/CategoryFilter";
import officeFlowers from "@/assets/zp-boy-laptop.jpg";

const categoryCards = [
  { icon: Scale, title: "Wet en regelgeving", desc: "Wet DBA, zelfstandigenregelingen en juridische zaken.", href: "/kennisbank/wet-en-regelgeving" },
  { icon: Briefcase, title: "Ondernemen", desc: "Groei, klantrelaties en risicomanagement voor zzp'ers.", href: "/kennisbank/ondernemen" },
  { icon: Calculator, title: "Belastingen", desc: "Belastingaangifte, BTW en fiscale aftrekposten.", href: "/kennisbank/belastingen" },
  { icon: Wallet, title: "Financiën", desc: "Financieel beheer, pensioen en sparen.", href: "/kennisbank/financien" },
];

export default function Kennisbank() {
  const { t } = useTranslation();
  const [activeCategory, setActiveCategory] = useState("Alle");
  const { data: articles, isLoading: articlesLoading } = useArticles(activeCategory);
  const { data: categories = ["Alle"] } = useArticleCategories();

  return (
    <Layout>
      <Helmet>
        <title>Kennisbank ZZP Verzekeringen | Artikelen & Nieuws | ZP Zaken</title>
        <meta name="description" content="Blijf op de hoogte van wet DBA, verzekeringen en regelgeving voor zzp'ers. Praktische artikelen door specialisten met 13 jaar ervaring." />
        <link rel="canonical" href="https://zpzaken.nl/kennisbank" />
      </Helmet>

      <PageHero
        title={t("kennisbank.title")}
        subtitle={t("kennisbank.subtitle")}
        badge={{ icon: <BookOpen className="h-4 w-4" />, text: t("kennisbank.badge") }}
        backgroundImage={officeFlowers}
      />

      <section className="section-padding bg-secondary/30">
        <div className="container-wide">
          <div className="max-w-2xl mx-auto text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">Categorieën</h2>
            <p className="text-muted-foreground">Bekijk de thema-pagina's.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-6xl mx-auto">
            {categoryCards.map((c) => (
              <LocalizedLink key={c.href} to={c.href} className="bg-card border border-border/50 rounded-2xl p-6 hover:border-accent/40 hover:shadow-md transition-all group">
                <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center mb-3 group-hover:bg-accent/20 transition-colors">
                  <c.icon className="h-5 w-5 text-accent" />
                </div>
                <h3 className="font-semibold mb-1 group-hover:text-accent transition-colors">{c.title}</h3>
                <p className="text-sm text-muted-foreground mb-3">{c.desc}</p>
                <span className="inline-flex items-center gap-1 text-sm font-medium text-accent">
                  Bekijk artikelen <ArrowRight className="h-4 w-4" />
                </span>
              </LocalizedLink>
            ))}
          </div>
        </div>
      </section>

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
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button variant="accent" size="lg" asChild>
                <LocalizedLink to="/contact">{t("kennisbank.personalAdviceButton")}<ArrowRight className="h-5 w-5" /></LocalizedLink>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <LocalizedLink to="/verzekeringen">Bekijk verzekeringen<ArrowRight className="h-5 w-5" /></LocalizedLink>
              </Button>
            </div>
          </div>

          {/* Internal linking: content clusters */}
          <div className="mt-16 grid sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <LocalizedLink to="/verzekeringen#combinatiepolis" className="bg-card border border-border/50 rounded-xl p-6 hover:border-accent/30 hover:shadow-md transition-all group">
              <Shield className="h-6 w-6 text-accent mb-3" />
              <h3 className="font-semibold text-sm mb-1 group-hover:text-accent transition-colors">BAV + AVB Combinatiepolis</h3>
              <p className="text-xs text-muted-foreground">Onze bundel voor kantoorberoepen vanaf €55 per maand</p>
            </LocalizedLink>
            <LocalizedLink to="/faq" className="bg-card border border-border/50 rounded-xl p-6 hover:border-accent/30 hover:shadow-md transition-all group">
              <Shield className="h-6 w-6 text-accent mb-3" />
              <h3 className="font-semibold text-sm mb-1 group-hover:text-accent transition-colors">Veelgestelde vragen</h3>
              <p className="text-xs text-muted-foreground">Antwoorden op de meest gestelde vragen over verzekeringen</p>
            </LocalizedLink>
            <LocalizedLink to="/diensten" className="bg-card border border-border/50 rounded-xl p-6 hover:border-accent/30 hover:shadow-md transition-all group">
              <Shield className="h-6 w-6 text-accent mb-3" />
              <h3 className="font-semibold text-sm mb-1 group-hover:text-accent transition-colors">Alle diensten</h3>
              <p className="text-xs text-muted-foreground">Van verzekeringen tot administratie en factoring</p>
            </LocalizedLink>
          </div>
        </div>
      </section>
    </Layout>
  );
}

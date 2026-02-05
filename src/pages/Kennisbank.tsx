 import { useState } from "react";
 import { Link } from "react-router-dom";
 import { Helmet } from "react-helmet-async";
import { Layout } from "@/components/layout/Layout";
import { PageHero } from "@/components/layout/PageHero";
import { Button } from "@/components/ui/button";
 import { Skeleton } from "@/components/ui/skeleton";
 import { ArrowRight, BookOpen, Shield } from "lucide-react";
 import { useArticles, useArticleCategories } from "@/hooks/useArticles";
 import { ArticleCard } from "@/components/kennisbank/ArticleCard";
 import { CategoryFilter } from "@/components/kennisbank/CategoryFilter";

import teamMeeting from "@/assets/team-meeting.jpg";

export default function Kennisbank() {
   const [activeCategory, setActiveCategory] = useState("Alle");
   const { data: articles, isLoading: articlesLoading } = useArticles(activeCategory);
   const { data: categories = ["Alle"] } = useArticleCategories();
 
   // Structured data for articles
   const articlesSchema = {
     "@context": "https://schema.org",
     "@type": "CollectionPage",
     name: "Kennisbank ZP Zaken",
     description:
       "Blijf op de hoogte van de laatste ontwikkelingen rondom wetgeving, verzekeringen en alles wat je als zzp'er moet weten.",
     hasPart: (articles || []).map((a) => ({
       "@type": "Article",
       headline: a.title,
       description: a.excerpt,
       datePublished: a.published_at,
       articleSection: a.category,
     })),
   };
 
  return (
    <Layout>
       <Helmet>
         <title>Kennisbank | ZP Zaken - Artikelen voor ZZP'ers</title>
         <meta
           name="description"
           content="Blijf op de hoogte van de laatste ontwikkelingen rondom wetgeving, verzekeringen en alles wat je als zzp'er moet weten."
         />
         <link rel="canonical" href="https://zpzaken.nl/kennisbank" />
         <script type="application/ld+json">
           {JSON.stringify(articlesSchema)}
         </script>
       </Helmet>

      <PageHero
        title="De nieuwste kennis artikelen van ZP Zaken"
        subtitle="Blijf op de hoogte van de laatste ontwikkelingen rondom wetgeving, verzekeringen en alles wat je als zzp'er moet weten."
        badge={{
          icon: <BookOpen className="h-4 w-4" />,
          text: "Kennisbank"
        }}
        backgroundImage={teamMeeting}
      />

       <CategoryFilter
         categories={categories}
         activeCategory={activeCategory}
         onCategoryChange={setActiveCategory}
       />

      {/* Articles Grid */}
      <section className="section-padding bg-background">
        <div className="container-wide">
           {articlesLoading ? (
             <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
               {[...Array(6)].map((_, i) => (
                 <div key={i} className="bg-card rounded-2xl overflow-hidden border border-border/50">
                   <Skeleton className="h-48 w-full" />
                   <div className="p-6 space-y-3">
                     <Skeleton className="h-6 w-3/4" />
                     <Skeleton className="h-4 w-full" />
                     <Skeleton className="h-4 w-2/3" />
                   </div>
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
               <p className="text-muted-foreground mb-4">
                 Geen artikelen gevonden in deze categorie.
               </p>
               <Button variant="outline" onClick={() => setActiveCategory("Alle")}>
                 Toon alle artikelen
               </Button>
             </div>
           )}
        </div>
      </section>

      {/* Newsletter CTA */}
      <section className="section-padding bg-primary text-primary-foreground">
        <div className="container-wide">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="mb-4">Blijf op de hoogte</h2>
            
            {/* Benefits as Shield Tags */}
            <div className="flex flex-wrap justify-center gap-3 mb-6">
              {["Nieuwste artikelen", "Geen spam", "Relevante updates"].map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-2 bg-primary-foreground/10 backdrop-blur-sm border border-primary-foreground/20 text-primary-foreground px-4 py-2 rounded-full text-sm"
                >
                  <Shield className="h-4 w-4 text-accent" />
                  {tag}
                </span>
              ))}
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto">
              <input
                type="email"
                placeholder="Je e-mailadres"
                className="flex-1 px-4 py-3 rounded-lg border-0 bg-primary-foreground/10 text-primary-foreground placeholder:text-primary-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary-foreground/30"
              />
              <Button variant="accent" size="lg">
                Aanmelden
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section-padding bg-background">
        <div className="container-wide">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="mb-4">Persoonlijk advies nodig?</h2>
            <p className="text-lg text-muted-foreground mb-8">
              Onze adviseurs helpen je graag met al je vragen over verzekeringen, 
              wetgeving en ondernemerschap.
            </p>
            <Button variant="accent" size="lg" asChild>
              <Link to="/contact">
                Gratis adviesgesprek plannen
                <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </Layout>
  );
}
